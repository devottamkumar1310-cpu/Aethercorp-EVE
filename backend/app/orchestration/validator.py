# ==============================================================================
# PURPOSE: Agent Task Output Validator.
# DATA FLOW: Takes agent output result dictionary -> runs business rules check ->
#            returns verification boolean and error strings.
# EXTENSION POINTS: Add custom validation rules per product category or size curves.
# ARCHITECTURAL DECISION:
# - Performs verification before marking task nodes as completed, allowing the
#   orchestrator to reject bad agent replies.
# ==============================================================================

import logging
from typing import Dict, Any, Tuple

logger = logging.getLogger("eve.orchestration.validator")


class Validator:
    """
    Evaluates agent output correctness.
    """

    @classmethod
    def validate_node_output(cls, agent_role: str, output: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Runs mathematical and format verification based on the executing agent role.
        """
        logger.info(f"Validator examining output for role '{agent_role}'...")
        
        if not output:
            return False, "Output payload is empty."

        # Route validation based on agent role
        if agent_role == "inventory":
            return cls._validate_inventory_output(output)
        elif agent_role == "pricing":
            return cls._validate_pricing_output(output)
        elif agent_role == "sourcing":
            return cls._validate_sourcing_output(output)
        elif agent_role == "market":
            return cls._validate_market_output(output)

        # Default fallback for unconfigured validation schemas
        return True, ""

    @classmethod
    def _validate_inventory_output(cls, output: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Verifies inventory health data outputs.
        """
        # Checks: Average risk score must be between 0 and 100
        risk = output.get("average_risk_score")
        if risk is not None:
            try:
                risk_val = float(risk)
                if not (0.0 <= risk_val <= 100.0):
                    return False, f"Invalid average risk score: {risk_val}. Must be between 0 and 100."
            except ValueError:
                return False, "Average risk score must be a numeric value."

        # Items list checks
        items = output.get("items_at_risk")
        if items is not None:
            if not isinstance(items, list):
                return False, "Items at risk must be a list."
            for idx, it in enumerate(items):
                sku = it.get("sku")
                if not sku:
                    return False, f"Item at index {idx} is missing unique SKU."
                
                safety = it.get("safety_stock")
                if safety is not None and int(safety) < 0:
                    return False, f"Safety stock for SKU '{sku}' cannot be negative: {safety}"

        return True, ""

    @classmethod
    def _validate_pricing_output(cls, output: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Verifies dynamic pricing suggestions outputs.
        """
        impact = output.get("estimated_profit_impact")
        if impact is not None:
            try:
                float(impact)
            except ValueError:
                return False, "Estimated profit impact must be a numeric value."

        recs = output.get("recommendations")
        if recs is not None:
            if not isinstance(recs, list):
                return False, "Recommendations must be a list."
            for idx, r in enumerate(recs):
                sku = r.get("sku")
                price = r.get("recommended_price")
                cost = r.get("unit_cost")
                
                if not sku:
                    return False, f"Recommendation at index {idx} is missing SKU."
                    
                if price is not None:
                    try:
                        p_val = float(price)
                        if p_val <= 0:
                            return False, f"Recommended price for SKU '{sku}' must be positive: {p_val}"
                    except ValueError:
                        return False, f"Recommended price for SKU '{sku}' must be numeric."
                        
                if cost is not None and price is not None:
                    # Retail price should not normally be lower than cost
                    if float(price) < float(cost) * 0.8: # Allow minor loss-leader clearout but flag excessive drops
                        return False, f"Recommended price for SKU '{sku}' (${price}) is excessively lower than COGS (${cost})"

        return True, ""

    @classmethod
    def _validate_sourcing_output(cls, output: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Verifies supplier recommendations outputs.
        """
        suppliers = output.get("suppliers")
        if suppliers is not None:
            if not isinstance(suppliers, list):
                return False, "Suppliers must be a list."
            for idx, s in enumerate(suppliers):
                name = s.get("supplier_name")
                moq = s.get("minimum_order_qty")
                if not name:
                    return False, f"Supplier at index {idx} is missing name."
                if moq is not None and int(moq) < 0:
                    return False, f"Supplier '{name}' MOQ cannot be negative."

        return True, ""

    @classmethod
    def _validate_market_output(cls, output: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Verifies competitor pricing monitoring outputs.
        """
        price = output.get("competitor_price")
        if price is not None:
            try:
                p_val = float(price)
                if p_val < 0:
                    return False, f"Scraped competitor price cannot be negative: {p_val}"
            except ValueError:
                return False, "Competitor price must be numeric."

        return True, ""
