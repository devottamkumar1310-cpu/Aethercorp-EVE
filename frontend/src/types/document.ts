export interface ProcessedDocument {
  id: string;
  filename: string;
  content_type: string;
  file_size: number;
  status: 'uploaded' | 'processing' | 'classified' | 'validated' | 'completed' | 'success' | 'failure';
  document_type: string | null;
  classification_confidence: number | null;
  created_at: string;
  error_message: string | null;
}

export interface ProcessedDocumentDetail extends ProcessedDocument {
  extracted_data: Record<string, any> | null;
  quality_assessment: {
    quality_score: number;
    detected_issues: Array<{
      rule_name: string;
      severity: 'warning' | 'critical';
      message: string;
    }>;
    [key: string]: any;
  } | null;
  coo_insights: {
    summary: string;
    operational_action_required: boolean;
    financial_impact_estimate?: number;
    recommended_actions: string[];
    [key: string]: any;
  } | null;
}
