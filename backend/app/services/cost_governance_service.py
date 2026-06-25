import datetime
import logging
from sqlalchemy.orm import Session
from app.models.executive_conversation import ExecutiveMessage, ExecutiveConversation

logger = logging.getLogger("eve.services.cost_governance_service")

class CostGovernanceService:
    @staticmethod
    def get_daily_cost(db: Session, org_id) -> float:
        """
        Sums estimated cost of all AI assistant queries run by the organization today.
        """
        try:
            today_start = datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            
            messages = db.query(ExecutiveMessage).join(ExecutiveConversation).filter(
                ExecutiveConversation.organization_id == org_id,
                ExecutiveMessage.role == "assistant",
                ExecutiveMessage.created_at >= today_start
            ).all()
            
            total_cost = 0.0
            for msg in messages:
                if msg.agent_data and isinstance(msg.agent_data, dict):
                    telemetry = msg.agent_data.get("telemetry", {})
                    if telemetry:
                        total_cost += telemetry.get("estimated_cost", 0.0)
                        
            return round(total_cost, 6)
        except Exception as e:
            logger.error(f"Error calculating daily cost: {e}", exc_info=True)
            return 0.0
