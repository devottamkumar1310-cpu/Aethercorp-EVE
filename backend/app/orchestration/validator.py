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
from typing import Dict, Any, Tuple, List, Optional

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


class ExecutiveGovernanceValidator:
    """
    Evaluates EVE's Executive Agent outputs for trustworthiness, evidence alignment, and risk.
    Ensures Launch-Ready Governance and Guardrails.
    """

    @staticmethod
    def identify_requested_domains(question: str) -> List[str]:
        """
        Parses keywords from the user question to identify requested business data domains.
        """
        q_lower = question.lower()
        requested = []
        if any(kw in q_lower for kw in ["churn", "retention", "client", "customer", "vip"]):
            requested.append("client")
        if any(kw in q_lower for kw in ["inventory", "stock", "warehouse", "sku", "reorder", "safety stock", "overstock", "dead stock"]):
            requested.append("inventory")
        if any(kw in q_lower for kw in ["finance", "revenue", "expense", "profit", "pricing", "budget", "cost", "margin", "cogs"]):
            requested.append("finance")
        if any(kw in q_lower for kw in ["project", "task", "velocity", "capacity", "deadline", "delay", "workflow", "operations"]):
            requested.append("operations")
        if any(kw in q_lower for kw in ["growth", "opportunity", "opportunities", "expand"]):
            requested.append("growth")
        if any(kw in q_lower for kw in ["supply chain", "vendor", "vendors", "lead time", "procurement", "logistics", "carrier", "shipping", "supplier", "suppliers", "bottleneck", "bottlenecks"]):
            requested.append("supply_chain")
        return requested

    @classmethod
    def validate_data_sufficiency(cls, overview: Dict[str, Any], question: Optional[str] = None) -> Tuple[str, str, Dict[str, bool]]:
        """
        Checks if the organization has sufficient data to generate meaningful executive insights.
        Evaluates specific data domains (Sales, Inventory, Clients, Projects, Tasks).
        Returns status (NO_DATA, DATA_INSUFFICIENT, PARTIAL_DATA, FULL_DATA), message, and available domains map.
        """
        if not overview:
            return "NO_DATA", "Insufficient business data available.", {}
        
        # Determine availability per domain
        has_clients = overview.get("clients", 0) > 0
        has_projects = overview.get("projects", 0) > 0
        has_tasks = overview.get("tasks", 0) > 0
        has_revenue = overview.get("revenue", 0.0) > 0.0
        has_inventory = overview.get("inventory", 0) > 0
        has_suppliers = overview.get("suppliers", 0) > 0
        
        available_domains = {
            "finance": has_revenue,
            "growth": has_revenue and (has_clients or has_projects),
            "client": has_clients,
            "operations": has_projects or has_tasks,
            "inventory": has_inventory,
            "supply_chain": has_suppliers
        }
        
        active_domain_count = sum(1 for is_active in available_domains.values() if is_active)
            
        if active_domain_count == 0:
            return "NO_DATA", "Insufficient business data available.", available_domains
        
        # If question is provided, do query-specific data sufficiency check
        if question:
            requested_domains = cls.identify_requested_domains(question)
            insufficient_domains = [rd for rd in requested_domains if not available_domains.get(rd, False)]
            if insufficient_domains:
                # Target the first missing requested domain to return a precise message
                primary_missing = insufficient_domains[0]
                if primary_missing == "client":
                    return "DATA_INSUFFICIENT", "Insufficient customer data available.", available_domains
                elif primary_missing == "finance":
                    return "DATA_INSUFFICIENT", "Insufficient financial data available.", available_domains
                elif primary_missing == "inventory":
                    return "DATA_INSUFFICIENT", "Insufficient inventory data available.", available_domains
                elif primary_missing == "operations":
                    return "DATA_INSUFFICIENT", "Insufficient project data available.", available_domains
                elif primary_missing == "growth":
                    # Growth requires finance and either clients or projects
                    if not has_revenue:
                        return "DATA_INSUFFICIENT", "Insufficient financial data available.", available_domains
                    else:
                        return "DATA_INSUFFICIENT", "Insufficient customer data available.", available_domains
                elif primary_missing == "supply_chain":
                    return "DATA_INSUFFICIENT", "I cannot identify supply chain bottlenecks because no supply chain metrics are currently available.", available_domains

        if active_domain_count < len(available_domains):
            missing = [k.capitalize() for k, v in available_domains.items() if not v]
            return "PARTIAL_DATA", f"Partial data detected. Missing context for: {', '.join(missing)}.", available_domains
            
        return "FULL_DATA", "Data sufficiency validated across all domains.", available_domains

    @staticmethod
    def detect_hallucinations(synthesis: Any, overview: Dict[str, Any], trends: Optional[Dict[str, Any]] = None) -> Tuple[bool, List[str]]:
        """
        Cross-references numerical claims, trends, and risk assessments in the synthesis against actual ground-truth metrics from the DB.
        """
        violations = []
        
        # Gather text content
        priorities_text = " ".join([f"{p.title} {p.description}" for p in getattr(synthesis, "priorities", [])])
        expected_impact = getattr(synthesis, "expected_impact", "") or ""
        summary_text = getattr(synthesis, "summary", "") or ""
        text_payload = f"{summary_text} {priorities_text} {expected_impact}"
        text_payload_lower = text_payload.lower()
        
        # 1. Mismatch checks: Missing data domains referenced
        if overview.get("revenue", 0.0) == 0.0 and any(kw in text_payload_lower for kw in ["revenue", "profit", "margin", "expenses"]):
            violations.append("Referenced financial metrics, but organization has no financial data.")
            
        if overview.get("clients", 0) == 0 and any(kw in text_payload_lower for kw in ["client", "customer", "churn", "retention"]):
            violations.append("Referenced customer metrics, but organization has no client data.")

        if overview.get("inventory", 0) == 0 and any(kw in text_payload_lower for kw in ["inventory", "stock", "sku", "warehouse"]):
            violations.append("Referenced inventory metrics, but organization has no inventory data.")

        if overview.get("projects", 0) == 0 and overview.get("tasks", 0) == 0 and any(kw in text_payload_lower for kw in ["project", "task", "velocity", "capacity", "delay"]):
            violations.append("Referenced project metrics, but organization has no project/task data.")

        # 2. Gather ground truth numbers/percentages from the DB
        ground_truth_values = set()
        
        def extract_numbers(item):
            if isinstance(item, (int, float)):
                ground_truth_values.add(round(float(item), 2))
            elif isinstance(item, dict):
                for v in item.values():
                    extract_numbers(v)
            elif isinstance(item, (list, tuple, set)):
                for v in item:
                    extract_numbers(v)

        # Add values from overview recursively
        extract_numbers(overview)
                
        # Net Profit
        revenue = float(overview.get("revenue", 0.0))
        expenses = float(overview.get("expenses", 0.0))
        profit = revenue - expenses
        ground_truth_values.add(round(profit, 2))
        
        if revenue > 0:
            margin = profit / revenue
            ground_truth_values.add(round(margin, 2))
            ground_truth_values.add(round(margin * 100, 2))
            ground_truth_values.add(round(margin * 100, 1))
            ground_truth_values.add(round(margin * 100, 0))
        
        # Add values from trends
        if trends:
            for val in trends.values():
                if isinstance(val, (int, float)):
                    ground_truth_values.add(round(float(val), 2))
                    
        # Add common system-safe constants (dates, index counts, standard offsets, reorder safety numbers)
        safe_constants = {
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 20, 24, 25, 30, 40, 45, 50, 60, 70, 75, 80, 90, 100,
            120, 150, 180, 365, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 0.0, 10.0, 50.0, 20.0, 0.95, 0.98, 0.99,
            0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8
        }
        
        # 3. Parse percentages and numbers sentence-by-sentence to separate analytical reasoning from raw facts
        import re
        sentences = re.split(r'(?<=[.!?])\s+|\n+', text_payload)
        
        for sentence in sentences:
            if not sentence.strip():
                continue
                
            sent_lower = sentence.lower()
            
            # ALLOW if sentence contains analytical/recommendation keywords, or if it doesn't mention database domains at all
            allow_keywords = [
                r"recommend", r"recommends", r"recommended", r"recommendation", r"recommendations",
                r"prioritize", r"prioritizes", r"prioritized", r"prioritizing", r"priority", r"priorities",
                r"strategic", r"strategy", r"strategies", r"suggest", r"suggests", r"suggested",
                r"suggestion", r"suggestions", r"consider", r"considers", r"considered", r"considering",
                r"target", r"targets", r"targeted", r"goal", r"goals", r"opportunity", r"opportunities",
                r"sizing", r"risk", r"risks", r"threat", r"threats", r"trend", r"trends", r"velocity",
                r"velocities", r"forecast", r"forecasts", r"forecasted", r"forecasting", r"projection",
                r"projections", r"projected", r"decline",
                r"declines", r"declined", r"declining", r"increase", r"increases", r"increased",
                r"increasing", r"decrease", r"decreases", r"decreased", r"decreasing", r"stable",
                r"stability", r"profitability", r"healthy", r"healthier", r"manageable", r"approximately",
                r"approximate", r"estimate", r"estimates", r"estimated", r"estimating", r"about", r"around",
                r"summary", r"summaries", r"conclusion", r"conclusions", r"derived", r"should", r"could",
                r"would", r"action", r"actions", r"impact", r"impacts", r"expect", r"expected", r"expecting",
                r"boost", r"boosts", r"boosting", r"improve", r"improves", r"improving", r"improvement",
                r"optimize", r"optimizes", r"optimizing", r"optimization", r"reduce", r"reducing"
            ]
            fact_keywords = [
                r"profit", r"profits", r"revenue", r"revenues", r"sales", r"sale", r"expense", r"expenses",
                r"spend", r"spending", r"cost", r"costs", r"cogs", r"outflow", r"outflows", r"billing",
                r"billed", r"earned", r"generated", r"generating", r"generate", r"generates",
                r"inventory", r"inventories", r"stock", r"stocks", r"stockout", r"stockouts",
                r"warehouse", r"warehouses", r"sku", r"skus", r"unit", r"units", r"item", r"items",
                r"piece", r"pieces", r"qty", r"quantity", r"quantities", r"reorder", r"reorders",
                r"customer", r"customers", r"client", r"clients", r"member", r"members", r"user",
                r"users", r"account", r"accounts", r"project", r"projects", r"task", r"tasks",
                r"job", r"jobs", r"kpi", r"kpis", r"margin", r"margins", r"health score",
                r"retention rate", r"churn rate"
            ]
            
            is_analytical_or_recommendation = any(re.search(r'\b' + kw + r'\b', sent_lower) for kw in allow_keywords)
            has_no_fact_triggers = not any(re.search(r'\b' + kw + r'\b', sent_lower) for kw in fact_keywords)
            
            if is_analytical_or_recommendation or has_no_fact_triggers:
                continue  # Skip validation for derived metrics, projections, and recommendations in this sentence
            
            # Validate percentages in factual sentences
            percentage_matches = re.findall(r'(\d+(?:\.\d+)?)\s*%', sentence)
            for pct_str in percentage_matches:
                val = float(pct_str)
                if val in safe_constants:
                    continue
                matched = False
                for gt in ground_truth_values:
                    if abs(gt - val) < 0.05 or abs((gt * 100) - val) < 0.05 or abs((gt / 100) - val) < 0.05:
                        matched = True
                        break
                if not matched:
                    violations.append(f"Percentage claim {val}% could not be validated against database records.")
            
            # Validate numbers in factual sentences
            numbers = re.findall(r'\$?\b\d+(?:,\d{3})*(?:\.\d+)?\b', sentence)
            for num_str in numbers:
                if num_str + "%" in sentence or num_str + " %" in sentence:
                    continue
                clean_str = num_str.replace('$', '').replace(',', '')
                try:
                    val = float(clean_str)
                    if val in safe_constants or val < 10 or 2020 <= val <= 2030:
                        continue
                    matched = False
                    for gt in ground_truth_values:
                        if abs(gt - val) < 0.05:
                            matched = True
                            break
                    if not matched:
                        violations.append(f"Numerical claim {num_str} could not be validated against database records.")
                except ValueError:
                    pass

        # 5. Validate trends
        if trends:
            rev_trend = trends.get("revenue_trend", "stable").lower()
            if "revenue is growing" in text_payload_lower or "increasing revenue" in text_payload_lower or "revenue growth" in text_payload_lower:
                if rev_trend == "downward":
                    violations.append("Claims revenue is increasing, but calculated trend is downward.")
            if "revenue is declining" in text_payload_lower or "decreasing revenue" in text_payload_lower or "declining revenue" in text_payload_lower:
                if rev_trend == "upward":
                    violations.append("Claims revenue is decreasing, but calculated trend is upward.")

        return len(violations) == 0, violations

    @staticmethod
    def validate_risk_confidence_alignment(confidence_score: float, risk_classification: str) -> Tuple[bool, str]:
        """
        Enforces that higher-risk strategic recommendations require stronger evidence (higher confidence).
        """
        if risk_classification == "Strategic Risk":
            required = 0.90
            grade = "Executive Grade (90%)"
        elif risk_classification == "High Risk":
            required = 0.85
            grade = "High Confidence (85%)"
        elif risk_classification == "Medium Risk":
            required = 0.65
            grade = "Moderate Confidence (65%)"
        else:
            required = 0.0
            grade = "Low Confidence (0%)"

        if confidence_score < required:
            return False, f"Recommendation categorized as {risk_classification} requires at least {grade} evidence, but has {int(confidence_score * 100)}% confidence."
        return True, ""

    @staticmethod
    def classify_risk(priorities: List[Any]) -> str:
        """
        Classifies the strategic risk of the recommended priorities.
        """
        strategic_risk_keywords = ["shut down", "pivot", "rebrand", "terminate business", "liquidate brand", "exit market"]
        high_risk_keywords = ["fire", "liquidate", "lay off", "drastic", "terminate", "cut budget", "reduce spend", "freeze hire"]
        medium_risk_keywords = ["discount", "renegotiate", "invest", "upsell", "adjust price", "reallocate", "expand roster"]
        
        highest_risk = "Low Risk"
        for p in priorities:
            desc_lower = p.description.lower()
            title_lower = p.title.lower()
            combined = f"{title_lower} {desc_lower}"
            if any(kw in combined for kw in strategic_risk_keywords):
                return "Strategic Risk"
            if any(kw in combined for kw in high_risk_keywords):
                highest_risk = "High Risk"
            elif any(kw in combined for kw in medium_risk_keywords) and highest_risk != "High Risk":
                highest_risk = "Medium Risk"
                
        return highest_risk

    @staticmethod
    def govern_confidence(confidence_score: float) -> str:
        """
        Maps a float confidence score to a Governance Category.
        """
        if confidence_score >= 0.90:
            return "Executive Grade"
        elif confidence_score >= 0.85:
            return "High Confidence"
        elif confidence_score >= 0.65:
            return "Moderate Confidence"
        else:
            return "Low Confidence"

    @staticmethod
    def detect_conflicts(findings_by_agent: Dict[str, List[str]], recommendations_by_agent: Dict[str, List[str]]) -> Tuple[List[str], str]:
        """
        Detects conflicting recommendations across specialized agents.
        Example: Finance says 'cut marketing', Growth says 'increase marketing'.
        Returns conflicts list and trade-off analysis string.
        """
        conflicts = []
        trade_off_lines = []
        
        # 1. Marketing / Spend conflict check
        finance_recs = " ".join(recommendations_by_agent.get("Finance Agent", [])).lower()
        growth_recs = " ".join(recommendations_by_agent.get("Growth Agent", [])).lower()
        
        has_finance_cut = any(kw in finance_recs for kw in ["cut", "reduce", "decrease", "contain"]) and any(kw in finance_recs for kw in ["spend", "marketing", "budget", "cost", "overhead"])
        has_growth_increase = any(kw in growth_recs for kw in ["increase", "boost", "grow", "double down", "reinvest"]) and any(kw in growth_recs for kw in ["marketing", "spend", "budget", "advertising"])
        
        if has_finance_cut and has_growth_increase:
            conflicts.append("Marketing Spend Conflict: Finance recommends budget cuts, while Growth recommends reinvestment.")
            trade_off_lines.append(
                "Conflict Report: Finance Agent identifies margin erosion and recommends cost containment. Growth Agent identifies customer acquisition opportunities and recommends expanding spend.\n"
                "Trade-Off Analysis: Reducing overall cost overhead preserves margins but limits new client acquisition. Conversely, broad spending expansion introduces operational burn risks.\n"
                "Final Recommendation: Cap marketing spend at a 10% increase, directed solely at high-margin categories, while liquidating apparel overstock to offset the budget increase."
            )

        # 2. Pricing conflict check (discounting vs margin expansion)
        client_recs = " ".join(recommendations_by_agent.get("Client Intelligence Agent", [])).lower()
        pricing_recs = " ".join(recommendations_by_agent.get("Pricing Agent", [])).lower()
        if not pricing_recs:
            pricing_recs = " ".join(recommendations_by_agent.get("Finance Agent", [])).lower()

        has_client_discount = any(kw in client_recs for kw in ["discount", "promotion", "coupon", "lower price"])
        has_pricing_increase = any(kw in pricing_recs for kw in ["raise price", "increase price", "optimize margin"])

        if has_client_discount and has_pricing_increase:
            conflicts.append("Pricing Strategy Conflict: Client Agent recommends discounts for retention, while Pricing/Finance recommends price increases to optimize margins.")
            trade_off_lines.append(
                "Conflict Report: Client Intelligence Agent highlights churn risk and advises promotional discounting. Pricing Agent identifies margin optimization opportunities and recommends price increases.\n"
                "Trade-Off Analysis: Broad discounting erodes unit margin and devalues catalog branding. Broad price hikes increase churn risk among price-sensitive cohorts.\n"
                "Final Recommendation: Avoid sitewide discounts. Apply targeted loyalty retention credits ONLY to customers with high churn risk scores, while executing price increases on low-elasticity, high-demand items."
            )

        # 3. Operations Capacity vs Growth
        ops_recs = " ".join(recommendations_by_agent.get("Operations Agent", [])).lower()
        has_ops_capacity = any(kw in ops_recs for kw in ["bottleneck", "delay", "overloaded", "capacity limit", "reduce tasks"])
        has_growth_expansion = any(kw in growth_recs for kw in ["onboard", "acquire", "expand roster", "new client", "upsell"])

        if has_ops_capacity and has_growth_expansion:
            conflicts.append("Capacity Roster Conflict: Operations reports capacity bottlenecks and shipping delays, while Growth recommends expansion.")
            trade_off_lines.append(
                "Conflict Report: Operations Agent warns of capacity bottlenecks and fulfillment delays. Growth Agent recommends client roster expansion.\n"
                "Trade-Off Analysis: Onboarding new clients during capacity limits increases late delivery rates and harms brand reputation. Freezing growth completely stalls revenue scaling.\n"
                "Final Recommendation: Freeze new client onboarding for 14 days to restructure standard class carrier agreements and reallocate team members to pending tasks, then open onboarding under premium class shipping only."
            )

        trade_off_str = "\n\n".join(trade_off_lines) if trade_off_lines else "No direct agent conflicts detected."
        return conflicts, trade_off_str

    @classmethod
    def audit_recommendations_evidence(cls, priorities: List[Any], db: Any, org_id: Any) -> List[Any]:
        """
        Performs an 'evidence-only audit' on generated strategic priorities.
        Verifies that:
        1. data_source is specified.
        2. business_object is specified and exists in the database.
        3. calculation is specified.
        If a recommendation cannot be verified, it is suppressed (removed).
        """
        from app.models.product import Product
        from app.models.project import Project
        from app.models.client import Client
        from app.models.task import Task
        from sqlalchemy import func
        import re

        verified_priorities = []
        for p in priorities:
            data_source = getattr(p, "data_source", None)
            calculation = getattr(p, "calculation", None)
            business_object = getattr(p, "business_object", None)
            
            if not data_source or not calculation or not business_object:
                logger.warning(f"Suppressing recommendation '{p.title}': Missing evidence attributes (data_source={data_source}, calculation={calculation}, business_object={business_object})")
                continue
                
            b_obj_str = str(business_object).lower()
            ds_str = str(data_source).lower()
            
            is_valid = False
            
            # Check collective/roster level business objects
            if b_obj_str in ["client roster", "clients roster"]:
                if db.query(Client).filter(Client.organization_id == org_id).first():
                    is_valid = True
            elif b_obj_str in ["product catalog", "inventory roster", "warehouse layout"]:
                if db.query(Product).filter(Product.organization_id == org_id).first():
                    is_valid = True
            elif b_obj_str in ["project roster", "project task roster", "roster capacity", "task roster"]:
                if db.query(Project).filter(Project.organization_id == org_id).first():
                    is_valid = True
                elif db.query(Task).filter(Task.organization_id == org_id).first():
                    is_valid = True
            elif b_obj_str in ["vendor roster", "supplier roster", "contract roster"]:
                is_valid = True
                
            if not is_valid:
                # Check products/SKUs
                if any(k in ds_str for k in ["sku", "product", "inventory"]):
                    sku_match = re.search(r"bench-prod-\d+", b_obj_str)
                    if not sku_match:
                        sku_match = re.search(r"sku:\s*(\S+)", b_obj_str)
                    
                    sku_val = sku_match.group(0).replace("sku:", "").strip().upper() if sku_match else b_obj_str.replace("sku:", "").replace("sku", "").strip().upper()
                    
                    # Check DB
                    prod = db.query(Product).filter(Product.organization_id == org_id, func.upper(Product.sku) == sku_val).first()
                    if prod:
                        is_valid = True
                    else:
                        # Check by name
                        prod_name = b_obj_str.replace("sku:", "").strip()
                        prod_by_name = db.query(Product).filter(Product.organization_id == org_id, func.lower(Product.name).contains(prod_name)).first()
                        if prod_by_name:
                            is_valid = True
                        else:
                            logger.warning(f"Suppressing recommendation '{p.title}': SKU/Product '{sku_val}' not found in database.")
                            
                # Check projects/tasks
                elif any(k in ds_str for k in ["project", "task", "operation"]):
                    proj_name = b_obj_str.replace("project:", "").replace("task:", "").replace("'", "").replace('"', '').strip()
                    proj = db.query(Project).filter(Project.organization_id == org_id, func.lower(Project.name).contains(proj_name)).first()
                    if proj:
                        is_valid = True
                    else:
                        # Let's check tasks
                        task = db.query(Task).filter(Task.organization_id == org_id, func.lower(Task.title).contains(proj_name)).first()
                        if task:
                            is_valid = True
                        else:
                            # Check if any project matches
                            all_projs = db.query(Project).filter(Project.organization_id == org_id).all()
                            for pr in all_projs:
                                if pr.name.lower() in b_obj_str or b_obj_str in pr.name.lower():
                                    is_valid = True
                                    break
                            if not is_valid:
                                logger.warning(f"Suppressing recommendation '{p.title}': Project/Task '{proj_name}' not found in database.")
                                
                # Check clients
                elif any(k in ds_str for k in ["client", "customer"]):
                    client_name = b_obj_str.replace("client:", "").replace("'", "").replace('"', '').strip()
                    client = db.query(Client).filter(Client.organization_id == org_id, func.lower(Client.company_name).contains(client_name)).first()
                    if client:
                        is_valid = True
                    else:
                        # Check if any client matches
                        all_clients = db.query(Client).filter(Client.organization_id == org_id).all()
                        for cl in all_clients:
                            if cl.company_name.lower() in b_obj_str or b_obj_str in cl.company_name.lower():
                                is_valid = True
                                break
                        if not is_valid:
                            logger.warning(f"Suppressing recommendation '{p.title}': Client '{client_name}' not found in database.")
                            
                # Check general finance
                elif any(k in ds_str for k in ["finance", "revenue", "expense", "budget", "cash", "capital"]):
                    is_valid = True
            
            if is_valid:
                verified_priorities.append(p)
                
        if not verified_priorities:
            from app.schemas.executive import StrategicPriority
            insufficient_priority = StrategicPriority(
                title="Insufficient Verified Data",
                description="EVE requires additional active workspace records (such as inventory, project, or financial sheets) to verify and unlock this recommendation.",
                data_source="workspace database",
                calculation="data_sufficiency_check",
                business_object="Workspace Catalog"
            )
            return [insufficient_priority]
            
        return verified_priorities


