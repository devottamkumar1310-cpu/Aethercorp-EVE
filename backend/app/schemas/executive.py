from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime

class AgentAnalysisResult(BaseModel):
    agent: str = Field(description="The name of the agent generating the response (e.g. 'Inventory Agent', 'Finance Agent')")
    summary: str = Field(description="Executive summary of the domain analysis and key recommendation")
    findings: List[str] = Field(default_factory=list, description="Key data discoveries, risks, or highlights")
    recommendations: List[str] = Field(default_factory=list, description="Specific, actionable strategic recommendations")
    confidence: float = Field(description="Confidence score of the recommendation between 0.0 and 1.0")

class StrategicPriority(BaseModel):
    title: str = Field(description="The priority title")
    description: str = Field(description="Action plan or detail for this priority")

class ExecutiveSynthesisResult(BaseModel):
    agent: str = Field(default="COO Lead", description="The name of the agent synthesizing the results")
    summary: str = Field(description="Final synthesized COO executive recommendation")
    priorities: List[StrategicPriority] = Field(default_factory=list, description="Top strategic priorities (Priority 1, 2, 3)")
    expected_impact: str = Field(description="The expected business impact of implementing the recommendations")
    findings_by_agent: Dict[str, List[str]] = Field(default_factory=dict, description="Segmented findings from sub-agents")
    recommendations_by_agent: Dict[str, List[str]] = Field(default_factory=dict, description="Segmented recommendations from sub-agents")
    confidence_scores: Dict[str, float] = Field(default_factory=dict, description="Confidence scores by agent including 'Overall'")

class GeminiExecutiveSynthesisResult(BaseModel):
    agent: str = Field(default="COO Lead", description="The name of the agent synthesizing the results")
    summary: str = Field(description="Final synthesized COO executive recommendation")
    priorities: List[StrategicPriority] = Field(default_factory=list, description="Top strategic priorities (Priority 1, 2, 3)")
    expected_impact: str = Field(description="The expected business impact of implementing the recommendations")


class ExecutiveChatRequest(BaseModel):
    question: str
    conversation_id: Optional[UUID] = None
    mode: Optional[str] = "smart"  # "full" or "smart"

class MessageResponse(BaseModel):
    id: UUID
    role: str
    content: str
    agent_data: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ExecutiveChatResponse(BaseModel):
    conversation_id: UUID
    title: str
    message: MessageResponse

class BusinessGoalCreate(BaseModel):
    goal_type: str  # "profitability", "growth", "cost_reduction", "retention", "custom"
    description: str
    target_value: Optional[float] = None

class BusinessGoalResponse(BaseModel):
    id: UUID
    goal_type: str
    description: str
    target_value: Optional[float] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class DailyBriefResponse(BaseModel):
    health_score: float
    health_status: str
    risks: List[Dict[str, Any]]
    opportunities: List[Dict[str, Any]]
    summary: str
    recommendations: List[str]

class AIRecommendationResponse(BaseModel):
    id: UUID
    agent_source: str
    recommendation: str
    reasoning_summary: str
    data_used: List[str]
    risk_factors: List[str]
    opportunity_factors: List[str]
    confidence_level: float
    created_at: datetime

    class Config:
        from_attributes = True
