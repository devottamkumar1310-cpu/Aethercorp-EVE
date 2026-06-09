export interface StockoutPrediction {
  sku: string;
  days_until_stockout: number;
}

export interface ReorderRecommendation {
  sku: string;
  recommended_reorder: number;
}

export interface PricingRecommendation {
  sku: string;
  current_price: number;
  recommended_price: number;
  current_margin_percent: number;
  reason: string;
}

export interface TopAction {
  action: string;
  impact: string;
  confidence_score: number;
}

export interface CashFlowForecast {
  scenario: string;
  parameter: string;
  required_working_capital: number;
  reorder_cost: number;
  cash_flow_risk: string;
  confidence_score: number;
}

export interface DashboardMetrics {
  inventory_risk_score: number;
  dead_stock_items: Array<{
    sku: string;
    name: string;
    stock_on_hand: number;
  }>;
  stockout_predictions: StockoutPrediction[];
  reorder_recommendations: ReorderRecommendation[];
  pricing_recommendations: PricingRecommendation[];
  estimated_profit_impact: number;
  top_3_actions?: TopAction[];
  cash_flow_forecast?: CashFlowForecast;
}
