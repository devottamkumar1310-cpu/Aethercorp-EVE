import logging
from typing import Dict, Any, List
from app.core.orchestrator.base_engine import EngineOutput

logger = logging.getLogger("eve.orchestrator.synthesizer")

class RecommendationSynthesizer:
    @staticmethod
    def synthesize(engine_results: Dict[str, EngineOutput], context: Any = None) -> Dict[str, Any]:
        """
        Combines outputs from all registered engines to construct prioritize recommendations.
        """
        forecast = engine_results.get("forecast_engine")
        opt = engine_results.get("optimization_engine")
        confidence = engine_results.get("confidence_engine")
        classification = engine_results.get("classification_engine")
        anomaly = engine_results.get("anomaly_engine")
        financial = engine_results.get("financial_engine")
        
        # 1. Pull Forecast values
        forecast_val = 0.0
        selected_model = "unknown"
        mean_demand = 0.0
        if forecast and forecast.success:
            forecast_val = forecast.data.get("forecast_value", 0.0)
            selected_model = forecast.data.get("selected_model", "unknown")
            mean_demand = forecast.data.get("supporting_metrics", {}).get("mean_demand", 0.0)
            
        # 2. Pull Optimization values
        reorder_qty = 0.0
        safety_stock = 0.0
        reorder_point = 0.0
        if opt and opt.success:
            reorder_qty = opt.data.get("reorder_quantity", 0.0)
            safety_stock = opt.data.get("safety_stock", 0.0)
            reorder_point = opt.data.get("reorder_point", 0.0)
            
        # 3. Pull Confidence values
        conf_score = 0.75
        quality = "good"
        factors = []
        if confidence and confidence.success:
            conf_score = confidence.data.get("confidence_score", 0.75)
            quality = confidence.data.get("data_quality", "good")
            factors = confidence.data.get("confidence_factors", [])
            
        # Penalize confidence if any engine failed during pipeline execution
        failed_engines = [k for k, v in engine_results.items() if not v.success]
        if failed_engines:
            conf_score = max(0.10, conf_score - 0.15 * len(failed_engines))
            factors.append(f"Degraded confidence due to calculation issues in: {', '.join(failed_engines)}.")
            
        # 4. Pull Classification values
        inventory_class = "HEALTHY"
        abc_class = "B"
        rfm_score = 10
        risk_level = "LOW"
        if classification and classification.success:
            inventory_class = classification.data.get("inventory_class", "HEALTHY")
            abc_class = classification.data.get("abc_class", "B")
            rfm_score = classification.data.get("rfm_score", 10)
            risk_level = classification.data.get("risk_level", "LOW")

        # 5. Pull Anomaly values
        anomalies = []
        anomaly_severity = "LOW"
        if anomaly and anomaly.success:
            anomalies = anomaly.data.get("anomalies", [])
            anomaly_severity = anomaly.data.get("severity", "LOW")

        # 6. Pull Financial values
        revenue_at_risk = 0.0
        margin_at_risk = 0.0
        working_capital_locked = 0.0
        if financial and financial.success:
            revenue_at_risk = financial.data.get("revenue_at_risk", 0.0)
            margin_at_risk = financial.data.get("margin_at_risk", 0.0)
            working_capital_locked = financial.data.get("working_capital_locked", 0.0)

        # 7. Calculate Priority Score (0-100)
        stock_on_hand = context.stock_on_hand if context else 50
        lead_time = context.lead_time_days if context else 14
        
        # Stockout Risk component (Max 40 points)
        if stock_on_hand <= 0:
            days_until_stockout = 0.0
        elif forecast_val <= 0.001:
            days_until_stockout = 999.0
        else:
            days_until_stockout = stock_on_hand / forecast_val

        if stock_on_hand <= 0 or days_until_stockout <= 0:
            risk_score = 100.0
        elif days_until_stockout >= lead_time * 2:
            risk_score = 10.0
        else:
            ratio = days_until_stockout / lead_time
            if ratio < 1.0:
                risk_score = 50.0 + (1.0 - ratio) * 50.0
            else:
                risk_score = 50.0 * (2.0 - ratio)
        risk_score = max(0.0, min(100.0, risk_score))
        stockout_comp = risk_score * 0.40  # Max 40
        
        # Anomaly component (Max 20 points)
        anomaly_comp = 0.0
        if anomaly_severity == "HIGH":
            anomaly_comp = 20.0
        elif anomaly_severity == "MEDIUM":
            anomaly_comp = 10.0
            
        # Financial component (Max 20 points)
        financial_comp = 0.0
        if revenue_at_risk >= 5000.0:
            financial_comp = 20.0
        elif revenue_at_risk >= 1000.0:
            financial_comp = 10.0
        elif revenue_at_risk >= 100.0:
            financial_comp = 5.0
            
        # Classification component (Max 20 points)
        classification_comp = 0.0
        if abc_class == "A" and inventory_class == "AT_RISK":
            classification_comp = 20.0
        elif abc_class == "A":
            classification_comp = 15.0
        elif abc_class == "B" and inventory_class == "AT_RISK":
            classification_comp = 10.0
        elif inventory_class == "DEAD_STOCK":
            classification_comp = 5.0
            
        priority_score = min(100, max(0, int(stockout_comp + anomaly_comp + financial_comp + classification_comp)))

        # 7b. Pull Executive priority values
        health_eng = engine_results.get("business_health_engine")
        act_eng = engine_results.get("action_engine")
        exec_summary_eng = engine_results.get("executive_summary_engine")

        health_score_val = 80
        health_grade = "B"
        if health_eng and health_eng.success:
            health_score_val = health_eng.data.get("health_score", 80)
            health_grade = health_eng.data.get("health_grade", "B")
            
        actions_list = []
        if act_eng and act_eng.success:
            actions_list = act_eng.data.get("actions", [])
            
        risk_payload = None
        opportunities_list = []
        if exec_summary_eng and exec_summary_eng.success:
            risk_payload = exec_summary_eng.data.get("risk")
            opportunities_list = exec_summary_eng.data.get("opportunities", [])

        # 8. Generate Reasoning
        reasoning = []
        reasoning.append(f"Projected daily sales rate: {forecast_val:.2f} units (model: '{selected_model}').")
        reasoning.append(f"Safety stock buffer calculated at {int(safety_stock)} units.")
        reasoning.append(f"Reorder point trigger set at {int(reorder_point)} units.")
        reasoning.append(f"ABC Classification: {abc_class} (Monetary Locked: ${working_capital_locked:,.2f}).")
        
        if anomalies:
            reasoning.append(f"Anomalies detected ({anomaly_severity} severity): {', '.join([a['type'] for a in anomalies])}.")
            
        if mean_demand > 0:
            reasoning.append(f"Historical mean demand is {mean_demand:.2f} units/day.")

        # 9. Compile Supporting Signals
        signals = []
        signals.append(f"Forecast model: {selected_model}")
        signals.append(f"Data quality: {quality}")
        signals.append(f"Inventory priority score: {priority_score}/100")
        for factor in factors:
            signals.append(factor)

        # 10. Recommendation text
        if reorder_qty > 0:
            rec_text = f"Reorder {int(reorder_qty)} units."
        else:
            rec_text = "Stock is optimal. No action needed."

        return {
            "recommendation": rec_text,
            "recommended_quantity": float(reorder_qty),
            "confidence_score": float(round(conf_score * 100.0, 1)),
            "reasoning": reasoning,
            "supporting_signals": signals,
            
            # Prioritization Attributes
            "priority_score": priority_score,
            "inventory_class": inventory_class,
            "abc_class": abc_class,
            "rfm_score": rfm_score,
            "risk_level": risk_level,
            "anomalies": anomalies,
            "anomaly_severity": anomaly_severity,
            "revenue_at_risk": revenue_at_risk,
            "margin_at_risk": margin_at_risk,
            "working_capital_locked": working_capital_locked,
            
            # Phase 3 Executive prioritization attributes
            "business_health_score": health_score_val,
            "business_health_grade": health_grade,
            "actions": actions_list,
            "risk": risk_payload,
            "opportunities": opportunities_list
        }
