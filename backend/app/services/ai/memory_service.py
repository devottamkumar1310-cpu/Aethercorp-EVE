import uuid
from typing import List, Optional, Any
from sqlalchemy.orm import Session
from app.models.executive_memory import BusinessGoal
from app.models.ai_recommendation import AIRecommendation

def get_memory_context(db: Session, org_id: uuid.UUID) -> List[str]:
    """Returns active business goals formatted as a list of strings."""
    goals = db.query(BusinessGoal).filter(
        BusinessGoal.organization_id == org_id,
        BusinessGoal.is_active == True
    ).all()
    context_strings = []
    for g in goals:
        target_str = f" (Target: {g.target_value})" if g.target_value is not None else ""
        context_strings.append(f"[{g.goal_type.upper()}] {g.description}{target_str}")
    return context_strings

def save_goal(
    db: Session, 
    org_id: uuid.UUID, 
    goal_type: str, 
    description: str, 
    target_value: Optional[float] = None
) -> BusinessGoal:
    """Saves a new strategic business goal for the organization."""
    goal = BusinessGoal(
        organization_id=org_id,
        goal_type=goal_type,
        description=description,
        target_value=target_value,
        is_active=True
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal

def list_goals(db: Session, org_id: uuid.UUID) -> List[BusinessGoal]:
    """Lists all goals (active and inactive) for the organization."""
    return db.query(BusinessGoal).filter(
        BusinessGoal.organization_id == org_id
    ).order_by(BusinessGoal.created_at.desc()).all()

def delete_goal(db: Session, org_id: uuid.UUID, goal_id: uuid.UUID) -> bool:
    """Deletes a business goal, ensuring organizational tenant isolation."""
    goal = db.query(BusinessGoal).filter(
        BusinessGoal.organization_id == org_id,
        BusinessGoal.id == goal_id
    ).first()
    if goal:
        db.delete(goal)
        db.commit()
        return True
    return False

def save_recommendation(db: Session, org_id: uuid.UUID, agent_source: str, result: Any) -> AIRecommendation:
    """Saves a generated agent recommendation to the database."""
    if hasattr(result, "model_dump"):
        data = result.model_dump()
    elif isinstance(result, dict):
        data = result
    else:
        raise ValueError("Invalid result format for saving recommendation")

    # Adapt legacy properties or map from ExecutiveSynthesisResult
    rec_text = data.get("summary") or data.get("recommendation") or ""
    reasoning = data.get("expected_impact") or data.get("reasoning_summary") or ""
    data_used = data.get("findings_by_agent") or data.get("findings") or data.get("data_used") or {}
    
    priorities = data.get("priorities") or []
    risk_factors = []
    if priorities:
        for p in priorities:
            if isinstance(p, dict):
                risk_factors.append(f"{p.get('title')}: {p.get('description')}")
            else:
                risk_factors.append(str(p))
    else:
        risk_factors = data.get("risk_factors") or []
        
    opportunity_factors = data.get("recommendations_by_agent") or data.get("recommendations") or data.get("opportunity_factors") or []
    
    # Inject Explainability & Governance Context
    if "confidence_category" in data:
        data_used["confidence_category"] = data["confidence_category"]
    if "risk_classification" in data:
        data_used["risk_classification"] = data["risk_classification"]
    if "detected_conflicts" in data and data["detected_conflicts"]:
        data_used["detected_conflicts"] = data["detected_conflicts"]
    
    confidence_level = 1.0
    if "confidence_scores" in data and isinstance(data["confidence_scores"], dict):
        confidence_level = data["confidence_scores"].get("Overall", 1.0)
    else:
        confidence_level = data.get("confidence") or data.get("confidence_level") or 1.0

    rec = AIRecommendation(
        organization_id=org_id,
        agent_source=agent_source,
        recommendation=rec_text,
        reasoning_summary=reasoning,
        data_used=data_used,
        risk_factors=risk_factors,
        opportunity_factors=opportunity_factors,
        confidence_level=confidence_level,
        expected_outcome=data.get("expected_outcome") or reasoning or "Improve business operations.",
        actual_outcome=data.get("actual_outcome")
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec

def get_recent_recommendations(db: Session, org_id: uuid.UUID, limit: int = 10) -> List[AIRecommendation]:
    """Retrieves recent recommendations generated for the organization."""
    return db.query(AIRecommendation).filter(
        AIRecommendation.organization_id == org_id
    ).order_by(AIRecommendation.created_at.desc()).limit(limit).all()
