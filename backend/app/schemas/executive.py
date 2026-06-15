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

class ExecutiveRecommendation(BaseModel):
    recommendation: str
    confidence: float
    evidence: List[str]
    assumptions: List[str]
    expected_impact: str

class ExecutiveSynthesisResult(BaseModel):
    agent: str = Field(default="COO Lead", description="The name of the agent synthesizing the results")
    summary: str = Field(description="Final synthesized COO executive recommendation")
    priorities: List[StrategicPriority] = Field(default_factory=list, description="Top strategic priorities (Priority 1, 2, 3)")
    expected_impact: str = Field(description="The expected business impact of implementing the recommendations")
    findings_by_agent: Dict[str, List[str]] = Field(default_factory=dict, description="Segmented findings from sub-agents")
    recommendations_by_agent: Dict[str, List[str]] = Field(default_factory=dict, description="Segmented recommendations from sub-agents")
    confidence_scores: Dict[str, float] = Field(default_factory=dict, description="Confidence scores by agent including 'Overall'")
    confidence_category: Optional[str] = Field(default="High Confidence", description="EVE Governance confidence classification")
    risk_classification: Optional[str] = Field(default="Low Risk", description="Priorities strategic risk classification")
    detected_conflicts: Optional[List[str]] = Field(default_factory=list, description="List of detected conflicts across sub-agents")
    trade_off_analysis: Optional[str] = Field(default=None, description="Trade-off recommendations for resolved conflicts")
    evidence_used: Optional[Dict[str, Any]] = Field(default_factory=dict, description="KPIs and context evidence references used")
    agent_contributors: Optional[List[str]] = Field(default_factory=list, description="List of agents who contributed to the analysis")
    governance_decisions: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Audited governance validation logs")
    recommendation_details: Optional[ExecutiveRecommendation] = None

class GeminiExecutiveSynthesisResult(BaseModel):
    agent: str = Field(default="COO Lead", description="The name of the agent synthesizing the results")
    summary: str = Field(description="Final synthesized COO executive recommendation")
    priorities: List[StrategicPriority] = Field(default_factory=list, description="Top strategic priorities (Priority 1, 2, 3)")
    expected_impact: str = Field(description="The expected business impact of implementing the recommendations")


class ExecutiveChatRequest(BaseModel):
    question: str
    conversation_id: Optional[UUID] = None
    mode: Optional[str] = "smart"  # "full" or "smart"
    language: Optional[str] = "en"  # "en" or "hi"
    developer_mode: Optional[bool] = None

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


class ExecutiveConversationResponse(BaseModel):
    id: UUID
    organization_id: UUID
    title: str
    created_at: datetime
    message_count: int
    updated_at: datetime

    class Config:
        from_attributes = True


class ExecutiveConversationDetailResponse(BaseModel):
    id: UUID
    organization_id: UUID
    title: str
    created_at: datetime
    messages: List[MessageResponse]

    class Config:
        from_attributes = True


class ExecutiveConversationUpdate(BaseModel):
    title: str

