from typing import Optional, Dict, List, Any
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.finance import Expense
from app.services.business_analytics_service import BusinessAnalyticsService
from app.services.analytics_service import AnalyticsService
from app.services.trend_service import calculate_trends
from app.services.ai.memory_service import get_memory_context
from app.services.ai.prompt_templates import FINANCE_SYSTEM_PROMPT, build_context_block
from app.schemas.executive import AgentAnalysisResult
from app.core.dependency_container import container

class FinanceAgent:
    def __init__(self, gemini_service=None):
        self.gemini_service = gemini_service or container.get("gemini_service")

    async def analyze(
        self,
        db: Session,
        org_id: uuid.UUID,
        question: str = "",
        overview: Optional[Dict[str, Any]] = None,
        trends: Optional[Dict[str, Any]] = None,
        goals: Optional[List[Any]] = None
    ) -> AgentAnalysisResult:
        if overview is None:
            overview = BusinessAnalyticsService.get_overview(db, org_id)
        if trends is None:
            trends = calculate_trends(db, org_id)
        if goals is None:
            goals = get_memory_context(db, org_id)
        
        # 1. Fetch Expenses by Category
        expenses_by_cat = db.query(
            Expense.category,
            func.sum(Expense.amount).label("total_amount")
        ).filter(Expense.organization_id == org_id)\
         .group_by(Expense.category)\
         .order_by(func.sum(Expense.amount).desc()).all()
        
        total_exp = overview.get("expenses", 0.0)
        expenses_list = []
        for cat, amt in expenses_by_cat:
            pct = (amt / total_exp * 100.0) if total_exp > 0 else 0.0
            expenses_list.append({"category": cat, "amount": amt, "percentage": pct})

        # 2. Fetch Product Category Margins
        category_margins = []
        try:
            prod_analytics = BusinessAnalyticsService.get_product_analytics(db, org_id)
            for cat_data in prod_analytics.get("category_breakdown", []):
                rev = cat_data.get("revenue", 0.0)
                prof = cat_data.get("profit", 0.0)
                margin = cat_data.get("margin_percent", 0.0)
                category_margins.append({
                    "category": cat_data.get("category"),
                    "revenue": rev,
                    "profit": prof,
                    "margin_percent": margin
                })
        except Exception:
            pass

        # 3. Fetch Inventory Working Capital Locked & Dead Stock
        inv_intel = None
        try:
            inv_analysis = AnalyticsService.get_inventory_analysis(db, org_id)
            items_at_risk = inv_analysis.get("items_at_risk", [])
            dead_stock_items = [item for item in items_at_risk if item.get("is_dead_stock") or item.get("days_until_stockout", 0) >= 180]
            rev_at_risk = sum(item.get("revenue_at_risk", 0.0) for item in items_at_risk)
            capital_locked = sum(item.get("working_capital_locked", 0.0) for item in items_at_risk)
            
            inv_intel = {
                "business_health_score": inv_analysis.get("business_health_score", 80),
                "revenue_at_risk": rev_at_risk,
                "working_capital_locked": capital_locked,
                "stockout_skus": inv_analysis.get("out_of_stock_skus", 0) + inv_analysis.get("low_stock_skus", 0),
                "items_at_risk": items_at_risk[:5],
                "dead_stock_items": dead_stock_items[:5]
            }
        except Exception:
            pass

        financial_intel = {
            "total_revenue": overview.get("revenue", 0.0),
            "total_expenses": total_exp,
            "net_profit": overview.get("profit", 0.0),
            "expenses_by_category": expenses_list,
            "category_margins": category_margins
        }
        
        context_block = build_context_block(
            trends=trends,
            goals=goals,
            financial_intel=financial_intel,
            inventory_intel=inv_intel
        )
        
        prompt = f"""
        User Question/Goal: {question or "Analyze financial health, working capital, profit margin leaks, and expenses."}
        
        {context_block}
        """
        
        result = await self.gemini_service.generate_structured_response(
            prompt=prompt,
            response_schema=AgentAnalysisResult,
            system_instruction=FINANCE_SYSTEM_PROMPT
        )
        return result

