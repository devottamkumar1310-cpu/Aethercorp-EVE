from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class IntelligenceSnapshotResponse(BaseModel):
    id: str
    snapshot_date: datetime
    health_score: float
    total_clients: int
    active_clients: int
    total_projects: int
    active_projects: int
    total_tasks: int
    completed_tasks: int
    revenue: float
    expenses: float
    profit: float
    created_at: datetime
    
    class Config:
        from_attributes = True

class HealthScoreResponse(BaseModel):
    score: float
    status: str
    strengths: List[str]
    risks: List[str]
    recommendations: List[str]

class ExecutiveSummaryResponse(BaseModel):
    summary: str

class Risk(BaseModel):
    severity: str
    title: str
    description: str

class RiskResponse(BaseModel):
    risks: List[Risk]

class Opportunity(BaseModel):
    title: str
    description: str

class OpportunityResponse(BaseModel):
    opportunities: List[Opportunity]

class TrendsResponse(BaseModel):
    revenue_trend: str
    expense_trend: str
    profit_trend: str
    health_trend: str
    task_trend: str

class Action(BaseModel):
    priority: str
    action: str

class ActionResponse(BaseModel):
    actions: List[Action]
