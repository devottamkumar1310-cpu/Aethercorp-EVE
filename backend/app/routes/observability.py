import uuid
import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database import get_db
from app.core.security import get_current_user, get_required_workspace_id, verify_workspace_admin
from app.models.profile import Profile
from app.models.executive_conversation import ExecutiveMessage, ExecutiveConversation
from app.models.system_error import SystemError
from app.models.client import Client
from app.models.project import Project
from app.models.task import Task
from app.models.inventory import InventoryItem, SalesRecord
from app.services.error_monitoring_service import ErrorMonitoringService

router = APIRouter(prefix="/api/observability", tags=["Observability"])

class FrontendErrorRequest(BaseModel):
    error_type: str = Field(..., description="Type of error e.g. JavascriptException")
    message: str = Field(..., description="Error message")
    stack_trace: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

@router.get("/costs")
def get_costs(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    admin_check: Any = Depends(verify_workspace_admin)
):
    try:
        today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - datetime.timedelta(days=7)
        month_start = today_start - datetime.timedelta(days=30)

        # Query messages for this organization in the last 30 days
        messages = db.query(ExecutiveMessage).join(ExecutiveConversation).filter(
            ExecutiveConversation.organization_id == workspace_id,
            ExecutiveMessage.role == "assistant",
            ExecutiveMessage.created_at >= month_start
        ).all()

        daily_cost = 0.0
        weekly_cost = 0.0
        monthly_cost = 0.0

        agent_breakdown = {}

        for msg in messages:
            if not msg.agent_data or not isinstance(msg.agent_data, dict):
                continue
            telemetry = msg.agent_data.get("telemetry", {})
            if not telemetry:
                continue
            
            cost = telemetry.get("estimated_cost", 0.0)
            created_at = msg.created_at

            monthly_cost += cost
            if created_at >= week_start:
                weekly_cost += cost
            if created_at >= today_start:
                daily_cost += cost

            agents = telemetry.get("agents", {})
            if isinstance(agents, dict):
                for agent_name, agent_metrics in agents.items():
                    if not isinstance(agent_metrics, dict):
                        continue
                    if agent_name not in agent_breakdown:
                        agent_breakdown[agent_name] = {
                            "cost": 0.0,
                            "prompt_tokens": 0,
                            "completion_tokens": 0,
                            "calls": 0
                        }
                    agent_breakdown[agent_name]["cost"] += agent_metrics.get("cost", 0.0)
                    agent_breakdown[agent_name]["prompt_tokens"] += agent_metrics.get("prompt_tokens", 0)
                    agent_breakdown[agent_name]["completion_tokens"] += agent_metrics.get("completion_tokens", 0)
                    agent_breakdown[agent_name]["calls"] += 1

        # Round totals
        daily_cost = round(daily_cost, 6)
        weekly_cost = round(weekly_cost, 6)
        monthly_cost = round(monthly_cost, 6)
        for agent_name in agent_breakdown:
            agent_breakdown[agent_name]["cost"] = round(agent_breakdown[agent_name]["cost"], 6)

        return {
            "daily_cost": daily_cost,
            "weekly_cost": weekly_cost,
            "monthly_cost": monthly_cost,
            "organization_id": str(workspace_id),
            "agent_breakdown": agent_breakdown
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch costs: {str(e)}")

@router.post("/errors")
def report_frontend_error(
    body: FrontendErrorRequest,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    error_log = ErrorMonitoringService.log_error(
        db=db,
        component="frontend",
        error_type=body.error_type,
        message=body.message,
        stack_trace=body.stack_trace,
        org_id=workspace_id,
        metadata_json=body.metadata
    )
    if error_log:
        return {"status": "logged", "error_id": str(error_log.id)}
    else:
        raise HTTPException(status_code=500, detail="Failed to log error")

@router.get("/errors")
def get_errors(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    admin_check: Any = Depends(verify_workspace_admin)
):
    errors = ErrorMonitoringService.get_errors(db, skip=skip, limit=limit, org_id=workspace_id)
    return [
        {
            "id": str(err.id),
            "component": err.component,
            "error_type": err.error_type,
            "message": err.message,
            "stack_trace": err.stack_trace,
            "metadata_json": err.metadata_json,
            "created_at": err.created_at.isoformat()
        }
        for err in errors
    ]

@router.get("/performance")
def get_performance(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    admin_check: Any = Depends(verify_workspace_admin)
):
    try:
        messages = db.query(ExecutiveMessage).join(ExecutiveConversation).filter(
            ExecutiveConversation.organization_id == workspace_id,
            ExecutiveMessage.role == "assistant"
        ).all()

        overall_latencies = []
        agent_latencies = {}

        for msg in messages:
            if not msg.agent_data or not isinstance(msg.agent_data, dict):
                continue
            telemetry = msg.agent_data.get("telemetry", {})
            if not telemetry:
                continue

            latency = telemetry.get("latency_ms")
            if latency is not None:
                overall_latencies.append(latency)

            agents = telemetry.get("agents", {})
            if isinstance(agents, dict):
                for agent_name, agent_metrics in agents.items():
                    if not isinstance(agent_metrics, dict):
                        continue
                    agent_latency = agent_metrics.get("latency_ms")
                    if agent_latency is not None:
                        if agent_name not in agent_latencies:
                            agent_latencies[agent_name] = []
                        agent_latencies[agent_name].append(agent_latency)

        # Compute average latencies
        avg_overall = sum(overall_latencies) / len(overall_latencies) if overall_latencies else 0.0
        
        # Safe percentile function helper
        def get_p95(lats):
            if not lats:
                return 0.0
            sorted_lats = sorted(lats)
            idx = min(len(sorted_lats) - 1, int(len(sorted_lats) * 0.95))
            return sorted_lats[idx]

        p95_overall = get_p95(overall_latencies)

        agent_stats = {}
        for agent_name, lats in agent_latencies.items():
            agent_stats[agent_name] = {
                "avg_latency_ms": sum(lats) / len(lats) if lats else 0.0,
                "p95_latency_ms": get_p95(lats),
                "calls": len(lats)
            }

        return {
            "overall": {
                "avg_latency_ms": avg_overall,
                "p95_latency_ms": p95_overall,
                "calls": len(overall_latencies)
            },
            "agents": agent_stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate performance stats: {str(e)}")

@router.get("/analytics")
def get_analytics(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    admin_check: Any = Depends(verify_workspace_admin)
):
    try:
        # 1. Onboarding Status (Active data entities in workspace)
        clients_count = db.query(Client).filter(Client.organization_id == workspace_id).count()
        projects_count = db.query(Project).filter(Project.organization_id == workspace_id).count()
        tasks_count = db.query(Task).filter(Task.organization_id == workspace_id).count()
        inventory_count = db.query(InventoryItem).filter(InventoryItem.organization_id == workspace_id).count()
        sales_count = db.query(SalesRecord).filter(SalesRecord.organization_id == workspace_id).count()

        # Compute onboarding progress based on presence of essential objects
        onboarding_steps = {
            "has_clients": clients_count > 0,
            "has_projects": projects_count > 0,
            "has_tasks": tasks_count > 0,
            "has_inventory": inventory_count > 0,
            "has_sales": sales_count > 0
        }
        completed_steps = sum(1 for step in onboarding_steps.values() if step)
        onboarding_percentage = (completed_steps / len(onboarding_steps)) * 100 if onboarding_steps else 0.0

        # 2. Usage Stats (most active users/features/modes)
        conversations = db.query(ExecutiveConversation).filter(
            ExecutiveConversation.organization_id == workspace_id
        ).all()
        conv_ids = [c.id for c in conversations]

        total_questions = 0
        questions_by_mode = {"smart": 0, "deterministic": 0}
        recent_prompts = []

        if conv_ids:
            messages = db.query(ExecutiveMessage).filter(
                ExecutiveMessage.conversation_id.in_(conv_ids)
            ).all()

            for msg in messages:
                if msg.role == "user":
                    total_questions += 1
                    recent_prompts.append(msg.content)
                elif msg.role == "assistant" and msg.agent_data:
                    # Count modes
                    mode = msg.agent_data.get("mode", "smart")
                    questions_by_mode[mode] = questions_by_mode.get(mode, 0) + 1

        # Sort and return unique prompts up to 10
        unique_prompts = list(dict.fromkeys(recent_prompts))[-10:]

        return {
            "onboarding": {
                "onboarding_percentage": onboarding_percentage,
                "steps": onboarding_steps,
                "counts": {
                    "clients": clients_count,
                    "projects": projects_count,
                    "tasks": tasks_count,
                    "inventory_items": inventory_count,
                    "sales_records": sales_count
                }
            },
            "usage": {
                "total_conversations": len(conversations),
                "total_queries": total_questions,
                "queries_by_mode": questions_by_mode,
                "recent_prompts": unique_prompts
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compile analytics: {str(e)}")
