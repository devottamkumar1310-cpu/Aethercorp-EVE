import uuid
from app.core.orchestrator.base_engine import BaseEngine, EngineContext, EngineOutput
from app.models.product import Product
from app.models.document import ProcessedDocument

class AnomalyEngine(BaseEngine):
    @property
    def name(self) -> str:
        return "anomaly_engine"

    async def execute(self, context: EngineContext) -> EngineOutput:
        try:
            anomalies = []
            sales_series = context.parameters.get("sales_series_override", [])
            avg_daily_sales = context.avg_daily_sales or 0.0

            # 1. Demand Surge & Collapse detection
            if sales_series and len(sales_series) >= 7:
                # Long term average sales (e.g. past 30 days)
                long_term_avg = sum(sales_series[-30:]) / len(sales_series[-30:]) if sales_series else avg_daily_sales
                
                # Recent sales (past 3 days for surge, past 7 days for drop)
                recent_3_avg = sum(sales_series[-3:]) / 3.0
                recent_7_avg = sum(sales_series[-7:]) / 7.0

                if long_term_avg > 0.2:
                    if recent_3_avg >= 3.0 * long_term_avg:
                        anomalies.append({
                            "type": "DEMAND_SURGE",
                            "message": f"Recent 3-day velocity ({recent_3_avg:.2f}/day) is 3x higher than historical baseline ({long_term_avg:.2f}/day)."
                        })
                    elif recent_7_avg <= 0.10 * long_term_avg and long_term_avg >= 1.0:
                        anomalies.append({
                            "type": "DEMAND_DROP",
                            "message": f"Demand collapsed: recent 7-day velocity ({recent_7_avg:.2f}/day) has dropped below 10% of baseline ({long_term_avg:.2f}/day)."
                        })

            # 2. Inventory Spike & Drop detection
            # Check if previous stock is passed in parameters
            previous_stock = context.parameters.get("previous_stock_on_hand")
            current_stock = context.stock_on_hand
            if previous_stock is not None:
                if current_stock >= 1.5 * previous_stock and current_stock - previous_stock > 10:
                    anomalies.append({
                        "type": "INVENTORY_SPIKE",
                        "message": f"Stock level jumped suddenly by {((current_stock - previous_stock) / previous_stock * 100):.1f}% (from {previous_stock} to {current_stock})."
                    })
                elif current_stock <= 0.5 * previous_stock and previous_stock - current_stock > 10:
                    anomalies.append({
                        "type": "INVENTORY_DROP",
                        "message": f"Stock level plunged suddenly by {((previous_stock - current_stock) / previous_stock * 100):.1f}% (from {previous_stock} to {current_stock}) without corresponding sales."
                    })

            # 3. Supplier Cost Anomaly
            cost_increase_detected = False
            cost_increase_msg = ""
            
            # Check for direct override
            if context.parameters.get("supplier_cost_anomaly_detected"):
                cost_increase_detected = True
                cost_increase_msg = context.parameters.get("supplier_cost_anomaly_message", "Supplier invoice cost has increased.")
            elif context.db and context.organization_id:
                org_id = context.organization_id
                if isinstance(org_id, str):
                    org_id = uuid.UUID(org_id)

                # Batch analysis fetches the org's invoice set ONCE and passes it
                # here — the set is identical for every SKU in one analysis run,
                # so re-querying it per SKU (the original path, still used by any
                # other caller) was pure repeated work at catalogue scale.
                if "invoices_override" in context.parameters:
                    invoices = context.parameters["invoices_override"]
                else:
                    invoices = context.db.query(ProcessedDocument).filter(
                        ProcessedDocument.organization_id == org_id,
                        ProcessedDocument.document_type == "Invoice",
                        ProcessedDocument.status == "success"
                    ).all()

                # Same idea for unit_cost: the batch caller already has it.
                if "unit_cost_override" in context.parameters:
                    current_cost = context.parameters["unit_cost_override"]
                else:
                    product = context.db.query(Product).filter(
                        Product.organization_id == org_id,
                        Product.sku == context.sku
                    ).first()
                    current_cost = product.unit_cost if product else 0.0

                if current_cost and current_cost > 0:
                    for inv in invoices:
                        extracted = inv.extracted_data or {}
                        # Check if this invoice matches our SKU and lists a cost
                        items = extracted.get("items", [])
                        for item in items:
                            item_sku = item.get("sku")
                            item_cost = item.get("unit_cost") or item.get("cost") or item.get("unit_price")
                            if item_sku == context.sku and item_cost:
                                try:
                                    cost_val = float(item_cost)
                                    if cost_val >= 1.15 * current_cost:
                                        cost_increase_detected = True
                                        cost_increase_msg = f"Supplier price anomaly: Invoice '{inv.filename}' lists SKU cost at ${cost_val:.2f}, which is {((cost_val - current_cost) / current_cost * 100):.1f}% higher than database unit cost (${current_cost:.2f})."
                                        break
                                except ValueError:
                                    continue
                        if cost_increase_detected:
                            break

            if cost_increase_detected:
                anomalies.append({
                    "type": "SUPPLIER_COST_INCREASE",
                    "message": cost_increase_msg
                })

            # Calculate severity based on anomalies found
            severity = "LOW"
            if anomalies:
                has_critical_surge = any(a["type"] in ["SUPPLIER_COST_INCREASE", "INVENTORY_DROP"] for a in anomalies)
                if has_critical_surge or len(anomalies) >= 2:
                    severity = "HIGH"
                else:
                    severity = "MEDIUM"

            return EngineOutput(
                engine_name=self.name,
                success=True,
                data={
                    "anomalies": anomalies,
                    "severity": severity
                }
            )
        except Exception as e:
            return EngineOutput(
                engine_name=self.name,
                success=False,
                errors=[str(e)]
            )
