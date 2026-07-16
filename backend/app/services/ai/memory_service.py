import uuid
import logging
from typing import List, Optional, Any
from sqlalchemy.orm import Session
from app.models.executive_memory import BusinessGoal
from app.models.ai_recommendation import AIRecommendation

logger = logging.getLogger("eve.services.ai.memory_service")

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
    try:
        from app.services.recommendation_trace_service import RecommendationTraceService
        # Determine recommendation type based on source or keywords
        rec_type = "inventory"
        if "margin" in rec_text.lower() or "price" in rec_text.lower():
            rec_type = "margin"
        elif "forecast" in rec_text.lower() or "projection" in rec_text.lower():
            rec_type = "forecasting"
        elif "summary" in rec_text.lower() or agent_source == "coo_document_analyzer":
            rec_type = "summary"
        
        # Build supporting metrics and reasoning chain
        metrics_dict = data_used if isinstance(data_used, dict) else {"data": str(data_used)}
        metrics_dict.update({
            "expected_outcome": data.get("expected_outcome") or "Improve operations",
            "agent_source": agent_source
        })

        # Build or reconstruct raw_prompt for auditability
        raw_prompt_built = data.get("raw_prompt")
        if not raw_prompt_built and data.get("summary"):
            raw_prompt_built = (
                f"[RECONSTRUCTED PROMPT SNAPSHOT]\n"
                f"Agent: {agent_source}\n"
                f"Summary input: {str(data.get('summary', ''))[:500]}"
            )

        # Use the synthesis summary as the raw_response if the model didn't carry one
        raw_response_built = data.get("raw_response") or str(data.get("summary", ""))[:2000]

        RecommendationTraceService.create_trace(
            db=db,
            org_id=org_id,
            rec_type=rec_type,
            action=rec_text,
            confidence=float(confidence_level) if confidence_level else 1.0,
            sources=list(metrics_dict.keys()) if metrics_dict else ["AI Context"],
            metrics=metrics_dict,
            reasoning=[reasoning] if reasoning else ["EVE COO analyzed historical context and recommended action."],
            # Provenance extraction (if available in result)
            triggered_by_user_id=data.get("user_id"),
            trigger_type="USER_PROMPT" if data.get("user_id") else "SYSTEM_GENERATED",
            created_from_query=True if data.get("user_id") else False,
            source_agent=agent_source,
            llm_provider=data.get("llm_provider", "google"),
            llm_model=data.get("llm_model", "gemini-2.5-flash"),
            llm_model_version=data.get("llm_model_version", "gemini-2.5-flash-latest"),
            raw_prompt=raw_prompt_built,
            raw_response=raw_response_built,
            input_metrics=data.get("input_metrics"),
            business_rules=data.get("business_rules"),
            calculations=data.get("calculations")
        )
    except Exception as e:
        logger.warning(f"Failed to generate RecommendationTrace in memory_service: {e}")
    db.commit()
    db.refresh(rec)
    return rec

def get_recent_recommendations(db: Session, org_id: uuid.UUID, limit: int = 10) -> List[AIRecommendation]:
    """Retrieves recent recommendations generated for the organization."""
    return db.query(AIRecommendation).filter(
        AIRecommendation.organization_id == org_id
    ).order_by(AIRecommendation.created_at.desc()).limit(limit).all()

def update_goal(
    db: Session,
    org_id: uuid.UUID,
    goal_id: uuid.UUID,
    update_data: dict
) -> Optional[BusinessGoal]:
    """Updates an existing business goal with organization scoping."""
    goal = db.query(BusinessGoal).filter(
        BusinessGoal.organization_id == org_id,
        BusinessGoal.id == goal_id
    ).first()
    if not goal:
        return None
        
    for key, val in update_data.items():
        if val is not None:
            setattr(goal, key, val)
            
    db.commit()
    db.refresh(goal)
    return goal

def get_influencing_goals(
    db: Session,
    org_id: uuid.UUID,
    recommendation_text: str,
    agent_source: str
) -> List[BusinessGoal]:
    """Determines which active goals influenced the recommendation using type and text matching."""
    active_goals = db.query(BusinessGoal).filter(
        BusinessGoal.organization_id == org_id,
        BusinessGoal.is_active == True
    ).all()
    
    influenced = []
    rec_lower = (recommendation_text or "").lower()
    
    for g in active_goals:
        # 1. Type matching with agent source domain
        type_match = False
        g_type = g.goal_type.lower()
        s_type = agent_source.lower()
        
        if g_type == "profitability" and s_type == "finance":
            type_match = True
        elif g_type == "cost_reduction" and s_type in ["finance", "operations"]:
            type_match = True
        elif g_type == "growth" and s_type in ["finance", "client"]:
            type_match = True
        elif g_type == "retention" and s_type == "client":
            type_match = True
        elif s_type in ["coo", "eve lead"]:
            type_match = True  # COO synthesis aggregates all active goals
            
        # 2. Text keyword matching
        keyword_match = False
        desc_words = [w for w in (g.description or "").lower().split() if len(w) > 3]
        if desc_words:
            matched_words = [w for w in desc_words if w in rec_lower]
            if len(matched_words) >= 2 or (len(matched_words) / len(desc_words) >= 0.4):
                keyword_match = True
                
        if type_match or keyword_match:
            influenced.append(g)
            
    return influenced
