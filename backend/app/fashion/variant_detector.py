# ==============================================================================
# PURPOSE: Apparel Variant Detection — Parses product names to detect parent/child
#          variant relationships, sizes, and colors during CSV import.
# DATA FLOW: CSV DataFrame -> detect_variants() -> VariantDetectionResult
# EXTENSION POINTS: Add brand-specific naming conventions, numeric waist sizes,
#                   Shopify CSV format support.
# ==============================================================================

import re
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger("eve.fashion.variant_detector")

# Standard apparel sizes (ordered)
STANDARD_SIZES = {
    "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL",
    "2XL", "3XL", "4XL", "5XL",
    "ONE SIZE", "OS", "OSFA", "FREE SIZE",
}

# Numeric sizes (pants, shoes)
NUMERIC_SIZES = {str(n) for n in range(0, 50)}

# Common color names
COMMON_COLORS = {
    "BLACK", "WHITE", "RED", "BLUE", "NAVY", "GREEN", "GREY", "GRAY",
    "PINK", "PURPLE", "ORANGE", "YELLOW", "BROWN", "BEIGE", "CREAM",
    "TAN", "IVORY", "TEAL", "CORAL", "MAROON", "BURGUNDY", "OLIVE",
    "KHAKI", "CHARCOAL", "INDIGO", "LAVENDER", "MINT", "SAGE",
    "RUST", "WINE", "ROSE", "BLUSH", "SAND", "STONE", "SLATE",
    "HEATHER GREY", "HEATHER GRAY", "LIGHT BLUE", "DARK BLUE",
    "LIGHT GREY", "DARK GREY", "LIGHT GRAY", "DARK GRAY",
    "LIGHT PINK", "DARK GREEN", "FOREST GREEN", "SKY BLUE",
    "ROYAL BLUE", "BABY BLUE", "DUSTY PINK", "DUSTY ROSE",
    "OFF WHITE", "OFF-WHITE", "MULTICOLOR", "MULTI",
}

# Separator patterns between parent name and variant info
SEPARATOR_PATTERNS = [
    r"\s*-\s*",      # "Classic Tee - Black / S"
    r"\s*\|\s*",     # "Classic Tee | Black | S"
    r"\s*\((.+?)\)",  # "Classic Tee (Black, S)"
]

# Variant delimiter within variant part
VARIANT_DELIMITERS = [
    r"\s*/\s*",    # "Black / S"
    r"\s*,\s*",    # "Black, S"
    r"\s*\|\s*",   # "Black | S"
]


@dataclass
class DetectedVariant:
    """A single detected variant from a product name."""
    sku: str
    original_name: str
    parent_name: str
    size: Optional[str] = None
    color: Optional[str] = None
    parent_product_id: Optional[str] = None


@dataclass
class VariantGroup:
    """A group of variants sharing the same parent product."""
    parent_name: str
    parent_product_id: str
    variants: List[DetectedVariant] = field(default_factory=list)
    detected_sizes: List[str] = field(default_factory=list)
    detected_colors: List[str] = field(default_factory=list)


@dataclass
class VariantDetectionResult:
    """Complete result of variant detection on a DataFrame."""
    variant_groups: List[VariantGroup] = field(default_factory=list)
    unmatched_products: List[Dict[str, str]] = field(default_factory=list)
    total_products: int = 0
    total_variants_detected: int = 0
    detection_confidence: float = 0.0


def _normalize_parent_id(parent_name: str) -> str:
    """Convert a parent product name to a stable ID string."""
    cleaned = re.sub(r"[^a-zA-Z0-9\s\-]", "", parent_name)
    return re.sub(r"\s+", "-", cleaned.strip().upper())


def _classify_token(token: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Classify a token as (size, color) or (None, None).
    Returns (size_value, None) or (None, color_value) or (None, None).
    """
    upper = token.strip().upper()
    
    # Check standard sizes first
    if upper in STANDARD_SIZES:
        return (token.strip(), None)
    
    # Check numeric sizes (only single numbers, not years or quantities)
    if upper in NUMERIC_SIZES and len(upper) <= 2:
        return (token.strip(), None)
    
    # Check colors
    if upper in COMMON_COLORS:
        return (None, token.strip())
    
    # Check for multi-word colors
    for color in COMMON_COLORS:
        if upper == color:
            return (None, token.strip())
    
    return (None, None)


def _parse_variant_name(name: str) -> Tuple[str, Optional[str], Optional[str]]:
    """
    Parse a product name into (parent_name, size, color).
    
    Handles patterns like:
    - "Classic Cotton Tee - Black / S"
    - "Classic Cotton Tee - Black / M"
    - "Slim Fit Jeans (Navy, 32)"
    - "Summer Dress | Red | M"
    - "Basic Tee - S"
    
    Returns (parent_name, size, color)
    """
    size = None
    color = None
    parent_name = name.strip()
    
    # Try parenthesized variant: "Product Name (Color, Size)"
    paren_match = re.search(r"^(.+?)\s*\((.+?)\)\s*$", name)
    if paren_match:
        parent_name = paren_match.group(1).strip()
        variant_part = paren_match.group(2).strip()
        # Split variant part by comma or slash
        for delim in VARIANT_DELIMITERS:
            tokens = re.split(delim, variant_part)
            if len(tokens) >= 2:
                for token in tokens:
                    s, c = _classify_token(token)
                    if s and not size:
                        size = s
                    if c and not color:
                        color = c
                if size or color:
                    return (parent_name, size, color)
        # Single token in parens
        s, c = _classify_token(variant_part)
        if s:
            size = s
        if c:
            color = c
        if size or color:
            return (parent_name, size, color)
    
    # Try separator patterns: "Product Name - Color / Size" or "Product Name | Color | Size"
    for sep in [r"\s+-\s+", r"\s+\|\s+"]:
        parts = re.split(sep, name, maxsplit=1)
        if len(parts) == 2:
            candidate_parent = parts[0].strip()
            variant_part = parts[1].strip()
            
            # Split variant part by / or , or |
            found_size = None
            found_color = None
            for delim in VARIANT_DELIMITERS:
                tokens = re.split(delim, variant_part)
                for token in tokens:
                    s, c = _classify_token(token)
                    if s and not found_size:
                        found_size = s
                    if c and not found_color:
                        found_color = c
            
            # If no delimiter worked, try the whole variant_part as a single token
            if not found_size and not found_color:
                s, c = _classify_token(variant_part)
                found_size = s
                found_color = c
            
            if found_size or found_color:
                return (candidate_parent, found_size, found_color)
    
    return (parent_name, None, None)


def detect_variants(products: List[Dict[str, str]]) -> VariantDetectionResult:
    """
    Detect variant relationships from a list of product dicts.
    
    Each dict must have 'sku' and 'name' keys.
    Optionally may have 'size', 'color', 'parent_product_id' (explicit overrides).
    
    Returns a VariantDetectionResult with grouped variants and unmatched products.
    """
    result = VariantDetectionResult(total_products=len(products))
    
    # Phase 1: Parse each product name
    parsed_items = []
    for prod in products:
        sku = prod.get("sku", "").strip()
        name = prod.get("name", "").strip()
        
        if not sku or not name:
            continue
        
        # Check for explicit overrides
        explicit_size = prod.get("size")
        explicit_color = prod.get("color")
        explicit_parent = prod.get("parent_product_id")
        
        if explicit_parent:
            # Explicit mapping provided — use as-is
            parsed_items.append(DetectedVariant(
                sku=sku,
                original_name=name,
                parent_name=explicit_parent,
                size=explicit_size,
                color=explicit_color,
                parent_product_id=explicit_parent,
            ))
        else:
            parent_name, detected_size, detected_color = _parse_variant_name(name)
            parsed_items.append(DetectedVariant(
                sku=sku,
                original_name=name,
                parent_name=parent_name,
                size=explicit_size or detected_size,
                color=explicit_color or detected_color,
            ))
    
    # Phase 2: Group by parent name
    parent_groups: Dict[str, List[DetectedVariant]] = {}
    for item in parsed_items:
        key = item.parent_name.upper().strip()
        if key not in parent_groups:
            parent_groups[key] = []
        parent_groups[key].append(item)
    
    # Phase 3: Build variant groups (only group if >1 variant with same parent)
    for parent_key, items in parent_groups.items():
        has_variant_info = any(v.size or v.color for v in items)
        
        if len(items) > 1 and has_variant_info:
            parent_id = _normalize_parent_id(items[0].parent_name)
            for item in items:
                item.parent_product_id = parent_id
            
            sizes = sorted(set(v.size for v in items if v.size))
            colors = sorted(set(v.color for v in items if v.color))
            
            group = VariantGroup(
                parent_name=items[0].parent_name,
                parent_product_id=parent_id,
                variants=items,
                detected_sizes=sizes,
                detected_colors=colors,
            )
            result.variant_groups.append(group)
            result.total_variants_detected += len(items)
        else:
            for item in items:
                result.unmatched_products.append({
                    "sku": item.sku,
                    "name": item.original_name,
                })
    
    # Compute confidence
    if result.total_products > 0:
        result.detection_confidence = round(
            result.total_variants_detected / result.total_products, 2
        )
    
    logger.info(
        f"Variant detection: {result.total_variants_detected}/{result.total_products} products "
        f"grouped into {len(result.variant_groups)} parent products "
        f"(confidence: {result.detection_confidence})"
    )
    
    return result
