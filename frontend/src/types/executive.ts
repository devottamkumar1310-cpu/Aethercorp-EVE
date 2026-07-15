export interface StrategicPriority {
  title: string;
  description: string;
}

export interface ExecutiveRecommendation {
  recommendation: string;
  confidence: number;
  evidence: string[];
  assumptions: string[];
  expected_impact: string;
}

export interface AgentAnalysisResult {
  agent: string;
  summary: string;
  priorities?: StrategicPriority[];
  expected_impact?: string;
  findings_by_agent?: Record<string, string[]>;
  recommendations_by_agent?: Record<string, string[]>;
  confidence_scores?: Record<string, number>;
  findings?: string[];
  recommendations?: string[];
  confidence?: number;
  confidence_category?: string;
  risk_classification?: string;
  detected_conflicts?: string[];
  trade_off_analysis?: string;
  evidence_used?: Record<string, any>;
  agent_contributors?: string[];
  governance_decisions?: Record<string, any>;
  recommendation_details?: ExecutiveRecommendation;
}


export interface MessageResponse {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent_data?: AgentAnalysisResult | Record<string, any>;
  created_at: string;
}

export interface ExecutiveChatResponse {
  conversation_id: string;
  title: string;
  message: MessageResponse;
}

export interface BusinessGoalResponse {
  id: string;
  goal_type: 'profitability' | 'growth' | 'cost_reduction' | 'retention' | 'custom' | string;
  description: string;
  target_value?: number;
  is_active: boolean;
  created_at: string;
}

export interface TraceData {
  current_inventory: number;
  historical_demand: number[];
  forecast_demand: number[];
  trend_confidence: number;
  lead_time: number;
  safety_stock: number;
  reorder_point: number;
  eoq_adjustment: number;
  revenue_at_risk: number;
}

export interface PriorityItem {
  title: string;
  why: string;
  impact: string;
  action: string;
  size_run?: Record<string, number>;
  reasoning?: string[];
  trace_data?: TraceData;
}

export interface DailyBriefResponse {
  revenue_risks: PriorityItem[];
  capital_risks: PriorityItem[];
  opportunities: PriorityItem[];
}

export interface AIRecommendationResponse {
  id: string;
  agent_source: string;
  recommendation: string;
  reasoning_summary: string;
  data_used: Record<string, any>;
  risk_factors: string[];
  opportunity_factors: string[];
  confidence_level: number;
  created_at: string;
  influenced_by_goals?: BusinessGoalResponse[];
}
