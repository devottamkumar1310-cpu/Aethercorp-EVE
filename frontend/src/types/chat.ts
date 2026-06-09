export interface EventBusMessage {
  topic: string;
  sender: string;
  data: any;
}

export interface OrchestratorAggregation {
  inventory_risk_score: number;
  total_reorder_recommendations: number;
  total_dead_stock_items: number;
  total_pricing_adjustments: number;
  estimated_profit_impact: number;
  strategic_recommendation: string;
  agent_telemetry: {
    nodes_executed: string[];
  };
}

export interface ChatResponse {
  executive_summary: string;
  participating_agents: string[];
  recommendations: string[];
  discovered_agents: string[];
  executed_agents: string[];
  event_bus_messages: EventBusMessage[];
  orchestrator_aggregation: OrchestratorAggregation;
}
