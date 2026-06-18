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

export interface DailyBriefResponse {
  health_score: number;
  health_status: string;
  risks: Array<{
    id?: string;
    description: string;
    impact_level?: 'high' | 'medium' | 'low' | string;
    category?: string;
    [key: string]: any;
  }>;
  opportunities: Array<{
    id?: string;
    description: string;
    value_potential?: number;
    impact_level?: 'high' | 'medium' | 'low' | string;
    category?: string;
    [key: string]: any;
  }>;
  summary: string;
  recommendations: string[];
  urgent_actions?: string[];
  recent_activity?: Array<{
    id: string;
    action: string;
    description?: string;
    created_at?: string;
  }>;
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
}
