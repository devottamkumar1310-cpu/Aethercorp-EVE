import uuid
from sqlalchemy.orm import Session
from app.models.inventory import InventoryItem
from app.models.product import Product
from app.services.ai.prompt_templates import INVENTORY_SYSTEM_PROMPT
from app.schemas.executive import AgentAnalysisResult
from app.core.dependency_container import container

class InventoryAgent:
    def __init__(self, gemini_service=None):
        self.gemini_service = gemini_service or container.get("gemini_service")

    async def analyze(self, db: Session, org_id: uuid.UUID, question: str = "") -> AgentAnalysisResult:
        # Query inventory parameters from the database
        items = db.query(InventoryItem).join(Product).filter(InventoryItem.organization_id == org_id).all()
        
        inventory_data = []
        for item in items:
            inventory_data.append({
                "sku": item.product.sku,
                "name": item.product.name,
                "category": item.product.category,
                "stock_on_hand": item.stock_on_hand,
                "reorder_point": item.reorder_point,
                "safety_stock": item.safety_stock,
                "avg_daily_sales": item.avg_daily_sales,
                "lead_time_days": item.lead_time_days
            })
            
        prompt = f"""
        User Question/Goal: {question or "Analyze inventory health, overstock risks, and reorder alerts."}
        
        Current Warehouse/Catalog Inventory:
        {inventory_data if inventory_data else "No inventory items are currently defined in the database."}
        """
        
        result = await self.gemini_service.generate_structured_response(
            prompt=prompt,
            response_schema=AgentAnalysisResult,
            system_instruction=INVENTORY_SYSTEM_PROMPT
        )
        return result
