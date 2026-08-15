# ==============================================================================
# PURPOSE: Rate-limit-aware HTTP client for the Shopify Admin REST API.
# DATA FLOW: SyncService -> ShopifyAdminClient -> Shopify Admin API -> JSON pages.
# EXTENSION POINTS: Add a GraphQL method if bulk operations become necessary for
#          catalogues larger than a few thousand variants.
# ARCHITECTURAL DECISION:
# - REST with cursor pagination rather than GraphQL bulk operations. EVE syncs a
#   D2C fashion catalogue (hundreds to low thousands of variants); bulk operations
#   add async job polling and a JSONL download path that buys nothing at this size.
# - Rate limiting is proactive, driven by the X-Shopify-Shop-Api-Call-Limit header.
#   Shopify's REST bucket refills at 2/sec; waiting when the bucket is nearly full
#   avoids the 429s that would otherwise make a large sync slower overall.
# ==============================================================================

import asyncio
import logging
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse, parse_qs

import httpx

logger = logging.getLogger("eve.services.shopify.client")

# Shopify's REST leaky bucket is 40 calls deep, refilling at 2/second. Pausing once
# usage crosses this fraction keeps headroom for the webhook path, which shares the
# same bucket and cannot be delayed.
_THROTTLE_THRESHOLD = 0.75
_THROTTLE_SLEEP_SECONDS = 1.0

_MAX_RETRIES = 3
_RETRY_STATUSES = {429, 500, 502, 503, 504}
_REQUEST_TIMEOUT = 30.0


class ShopifyAPIError(Exception):
    """Raised when Shopify returns an unrecoverable error for a request."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class ShopifyAuthError(ShopifyAPIError):
    """Raised on 401/403 — the stored token is revoked or lacks the needed scope."""


def normalize_shop_domain(shop: str) -> Optional[str]:
    """
    Normalises and validates a myshopify domain.

    Rejecting anything that is not `<store>.myshopify.com` matters: the domain is
    used to build the URL we send the access token to, so an unvalidated value is a
    credential-exfiltration vector (`evil.com` would receive the merchant's token).
    """
    if not shop:
        return None

    candidate = shop.strip().lower()
    # Tolerate a pasted URL rather than making the founder strip the scheme.
    if "://" in candidate:
        candidate = urlparse(candidate).netloc or ""
    candidate = candidate.split("/")[0].strip()

    if not candidate.endswith(".myshopify.com"):
        return None

    store = candidate[: -len(".myshopify.com")]
    if not store or len(store) > 60:
        return None
    # Shopify store handles are ASCII lowercase alphanumeric plus hyphens.
    # str.isalnum() is Unicode-aware and accepts homographs (e.g. Cyrillic "а",
    # U+0430), which would let two visually identical shop domains occupy two
    # rows and defeat the unique constraint that ties a store to one workspace.
    # The ASCII check is what makes the identity comparison meaningful.
    if not all(("a" <= char <= "z") or ("0" <= char <= "9") or char == "-" for char in store):
        return None
    if store.startswith("-") or store.endswith("-"):
        return None

    return candidate


class ShopifyAdminClient:
    """Async REST client scoped to one connected store."""

    def __init__(self, shop_domain: str, access_token: str, api_version: str = "2024-07"):
        normalized = normalize_shop_domain(shop_domain)
        if not normalized:
            raise ValueError(f"Invalid Shopify shop domain: {shop_domain!r}")
        self.shop_domain = normalized
        self._access_token = access_token
        self.api_version = api_version

    @property
    def base_url(self) -> str:
        return f"https://{self.shop_domain}/admin/api/{self.api_version}"

    def _headers(self) -> Dict[str, str]:
        return {
            "X-Shopify-Access-Token": self._access_token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    @staticmethod
    def _parse_next_page_info(link_header: Optional[str]) -> Optional[str]:
        """
        Extracts the `page_info` cursor from Shopify's RFC-5988 Link header.
        Returns None on the last page.
        """
        if not link_header:
            return None
        for part in link_header.split(","):
            section = part.split(";")
            if len(section) < 2:
                continue
            if 'rel="next"' not in section[1].replace(" ", "").replace("'", '"'):
                continue
            url = section[0].strip().strip("<>")
            page_info = parse_qs(urlparse(url).query).get("page_info")
            if page_info:
                return page_info[0]
        return None

    @staticmethod
    async def _respect_rate_limit(response: httpx.Response) -> None:
        """Pauses when the shop's REST call bucket is close to full."""
        header = response.headers.get("X-Shopify-Shop-Api-Call-Limit")
        if not header or "/" not in header:
            return
        try:
            used, cap = (int(value) for value in header.split("/", 1))
        except ValueError:
            return
        if cap > 0 and used / cap >= _THROTTLE_THRESHOLD:
            logger.debug("Shopify bucket at %s; pausing before next call.", header)
            await asyncio.sleep(_THROTTLE_SLEEP_SECONDS)

    async def get(
        self, path: str, params: Optional[Dict[str, Any]] = None
    ) -> Tuple[Dict[str, Any], Optional[str]]:
        """
        Performs one authenticated GET.
        Returns (json_body, next_page_info_cursor).
        """
        url = f"{self.base_url}{path}"
        attempt = 0

        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as http:
            while True:
                attempt += 1
                try:
                    response = await http.get(url, headers=self._headers(), params=params)
                except httpx.HTTPError as exc:
                    if attempt >= _MAX_RETRIES:
                        raise ShopifyAPIError(
                            f"Network failure calling Shopify {path}: {exc}"
                        ) from exc
                    await asyncio.sleep(min(2**attempt, 8))
                    continue

                if response.status_code in (401, 403):
                    # Not retried: a revoked token or missing scope will never
                    # succeed on retry, and hammering it risks the app being flagged.
                    raise ShopifyAuthError(
                        f"Shopify rejected credentials for {self.shop_domain} "
                        f"({response.status_code}).",
                        status_code=response.status_code,
                    )

                if response.status_code in _RETRY_STATUSES and attempt < _MAX_RETRIES:
                    # Shopify sends Retry-After on 429; honour it rather than guessing.
                    retry_after = response.headers.get("Retry-After")
                    try:
                        delay = float(retry_after) if retry_after else min(2**attempt, 8)
                    except ValueError:
                        delay = min(2**attempt, 8)
                    logger.warning(
                        "Shopify %s on %s; retrying in %.1fs (attempt %d).",
                        response.status_code,
                        path,
                        delay,
                        attempt,
                    )
                    await asyncio.sleep(delay)
                    continue

                if response.status_code >= 400:
                    raise ShopifyAPIError(
                        f"Shopify returned {response.status_code} for {path}: "
                        f"{response.text[:300]}",
                        status_code=response.status_code,
                    )

                await self._respect_rate_limit(response)
                try:
                    body = response.json()
                except ValueError as exc:
                    raise ShopifyAPIError(
                        f"Shopify returned a non-JSON body for {path}"
                    ) from exc

                return body, self._parse_next_page_info(response.headers.get("Link"))

    async def paginate(
        self,
        path: str,
        collection_key: str,
        params: Optional[Dict[str, Any]] = None,
        page_limit: int = 250,
        max_pages: int = 200,
    ) -> List[Dict[str, Any]]:
        """
        Walks every page of a collection endpoint and returns the flattened records.

        max_pages is a hard stop, not a tuning knob: without it a pagination bug
        (a cursor that never advances) would loop against Shopify indefinitely.
        """
        collected: List[Dict[str, Any]] = []
        request_params: Dict[str, Any] = dict(params or {})
        request_params["limit"] = page_limit

        page_info: Optional[str] = None
        for page in range(max_pages):
            if page_info:
                # Shopify forbids sending filters alongside a page_info cursor.
                request_params = {"limit": page_limit, "page_info": page_info}

            body, page_info = await self.get(path, params=request_params)
            records = body.get(collection_key, []) or []
            collected.extend(records)

            if not page_info:
                return collected

        logger.warning(
            "Stopped paginating %s at %d pages for %s; results may be incomplete.",
            path,
            max_pages,
            self.shop_domain,
        )
        return collected

    # ------------------------------------------------------------------ resources

    async def get_products(self) -> List[Dict[str, Any]]:
        """Full product catalogue, each product carrying its variants."""
        return await self.paginate("/products.json", "products")

    async def get_inventory_levels(
        self, inventory_item_ids: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Stock levels for the given inventory items across all locations.

        Shopify caps inventory_item_ids at 50 per request, so this chunks rather
        than fetching every level in the shop (which would pull locations EVE has
        no product mapping for).
        """
        levels: List[Dict[str, Any]] = []
        for start in range(0, len(inventory_item_ids), 50):
            chunk = inventory_item_ids[start : start + 50]
            if not chunk:
                continue
            levels.extend(
                await self.paginate(
                    "/inventory_levels.json",
                    "inventory_levels",
                    params={"inventory_item_ids": ",".join(chunk)},
                )
            )
        return levels

    async def get_orders(
        self,
        updated_at_min: Optional[str] = None,
        created_at_min: Optional[str] = None,
        created_at_max: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Orders for sales history.

        `status=any` includes cancelled and archived orders because the mapper needs
        to see refunds and voids in order to net them out; filtering them here would
        silently overstate sell-through.

        created_at_min/max bound the ORDER DATE rather than the edit time. The
        webhook path needs that: to restate a day it must fetch every order placed
        on that day, and updated_at would miss orders that were placed then but not
        touched since.
        """
        params: Dict[str, Any] = {"status": "any"}
        if updated_at_min:
            params["updated_at_min"] = updated_at_min
        if created_at_min:
            params["created_at_min"] = created_at_min
        if created_at_max:
            params["created_at_max"] = created_at_max
        return await self.paginate("/orders.json", "orders", params=params)

    async def get_shop(self) -> Dict[str, Any]:
        """Shop metadata. Also serves as a cheap credential health check."""
        body, _ = await self.get("/shop.json")
        return body.get("shop", {}) or {}

    async def post(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Authenticated POST, used for webhook subscription management."""
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as http:
            response = await http.post(url, headers=self._headers(), json=payload)
            if response.status_code in (401, 403):
                raise ShopifyAuthError(
                    f"Shopify rejected credentials for {self.shop_domain} "
                    f"({response.status_code}).",
                    status_code=response.status_code,
                )
            if response.status_code >= 400:
                raise ShopifyAPIError(
                    f"Shopify returned {response.status_code} for {path}: "
                    f"{response.text[:300]}",
                    status_code=response.status_code,
                )
            await self._respect_rate_limit(response)
            return response.json()

    async def delete(self, path: str) -> None:
        """Authenticated DELETE, used to remove webhooks on disconnect."""
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as http:
            response = await http.delete(url, headers=self._headers())
            # 404 means the webhook is already gone, which is the desired end state.
            if response.status_code >= 400 and response.status_code != 404:
                raise ShopifyAPIError(
                    f"Shopify returned {response.status_code} deleting {path}",
                    status_code=response.status_code,
                )
