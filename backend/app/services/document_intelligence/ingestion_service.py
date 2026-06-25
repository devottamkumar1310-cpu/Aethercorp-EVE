import logging
import uuid
import datetime
from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException, status
from typing import Any

from app.services.audit_logger import AuditLogger
from app.services.business_analytics_service import BusinessAnalyticsService
from app.services.document_intelligence.document_classifier import DocumentClassifier, DocumentClassificationResult
from app.services.document_intelligence.extraction_engine import ExtractionEngine, InvoiceExtractionResult, PurchaseOrderExtractionResult, ExpenseExtractionResult, SalesReportExtractionResult, InventoryReportExtractionResult
from app.services.document_intelligence.validation_engine import ValidationEngine, DataQualityAssessment

from app.models.product import Product
from app.models.inventory import InventoryItem, SalesRecord
from app.models.finance import Revenue, Expense
from app.models.project import Project
from app.core.dependency_container import container

logger = logging.getLogger("eve.services.ingestion_service")

class IngestionService:
    @staticmethod
    async def process_document(
        db: Session,
        org_id: uuid.UUID,
        file: UploadFile
    ) -> dict:
        """
        Main orchestration pipeline for document intelligence ingestion.
        """
        filename = file.filename
        content_type = file.content_type
        
        # 1. Read file contents and assert constraints
        file_bytes = await file.read()
        file_size = len(file_bytes)
        
        # Validate file size (10 MB limit)
        if file_size > 10 * 1024 * 1024:
            AuditLogger.log(db, "document_ingestion", "failure", org_id, f"File size exceeds 10MB limit: {filename}")
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size exceeds the 10MB limit."
            )
            
        # Validate file signature/extension
        allowed_extensions = {".pdf", ".csv", ".xlsx", ".png", ".jpg", ".jpeg"}
        file_ext = "." + filename.split(".")[-1].lower() if "." in filename else ""
        if file_ext not in allowed_extensions:
            AuditLogger.log(db, "document_ingestion", "failure", org_id, f"Unsupported file type: {filename}")
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported file format '{file_ext}'. Supported: PDF, CSV, XLSX, PNG, JPG, JPEG."
            )

        # Log initial ingestion audit
        AuditLogger.log(db, "document_ingestion", "started", org_id, f"Ingestion started for file: {filename}")

        # 2. Document Classification
        classification: DocumentClassificationResult = await DocumentClassifier.classify_document(
            db=db,
            file_content=file_bytes,
            filename=filename,
            mime_type=content_type
        )
        
        if classification.document_type == "Unknown / Unsupported" or classification.confidence < 0.8:
            AuditLogger.log(
                db, 
                "document_ingestion", 
                "failure", 
                org_id, 
                f"Classification rejected: {classification.document_type} (Confidence: {classification.confidence:.2f})"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This file does not appear to be a supported business document."
            )

        # Refine Invoice and Inventory Document into internal types for backward compatibility
        refined_doc_type = classification.document_type
        if refined_doc_type == "Invoice":
            if "purchase" in filename.lower() or "supplier" in filename.lower():
                refined_doc_type = "Purchase Invoice"
            elif "sales" in filename.lower() or "customer" in filename.lower():
                refined_doc_type = "Sales Invoice"
            else:
                refined_doc_type = "Sales Invoice"
        elif refined_doc_type == "Inventory Document":
            refined_doc_type = "Inventory Report"

        # 3. Document Extraction
        extracted_data = await ExtractionEngine.extract_details(
            file_content=file_bytes,
            mime_type=content_type,
            document_type=refined_doc_type,
            filename=filename
        )

        # 4. Data Quality & Logic Validation
        validation: DataQualityAssessment = ValidationEngine.validate_extraction(
            db=db,
            org_id=org_id,
            extraction_result=extracted_data
        )

        # Fail ingestion if data quality is critically corrupted (score < 50)
        if validation.quality_score < 50.0:
            AuditLogger.log(
                db, 
                "document_ingestion", 
                "failure", 
                org_id, 
                f"Validation failed for {refined_doc_type}: Score {validation.quality_score:.1f}"
            )
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Critical validation issues detected. Ingestion blocked. Score: {validation.quality_score:.1f}. Issues: {validation.detected_issues}"
            )

        # 5. Database Integration
        IngestionService._integrate_data(db, org_id, refined_doc_type, extracted_data)

        # 6. COO Insights Generation
        coo_insights = await IngestionService._generate_coo_insights(
            db, 
            org_id, 
            refined_doc_type, 
            extracted_data, 
            validation
        )

        # Commit all DB operations
        db.commit()

        # Log final successful ingestion audit
        AuditLogger.log(
            db, 
            "document_ingestion", 
            "success", 
            org_id, 
            f"Successfully processed {refined_doc_type} from file: {filename}",
            metadata_json={
                "document_type": refined_doc_type,
                "quality_score": validation.quality_score,
                "issues_count": len(validation.detected_issues)
            }
        )

        return {
            "status": "success",
            "document_type": refined_doc_type,
            "classification_confidence": classification.confidence,
            "quality_assessment": validation.model_dump(),
            "extracted_data": extracted_data.model_dump(),
            "coo_insights": coo_insights
        }

    @staticmethod
    def _integrate_data(
        db: Session,
        org_id: uuid.UUID,
        doc_type: str,
        data: Any
    ):
        """
        Persists parsed document entity states to the relational database.
        """
        # Helper to get or create default project context
        def get_or_create_project():
            from app.models.client import Client
            proj = db.query(Project).filter(Project.organization_id == org_id).first()
            if not proj:
                client = db.query(Client).filter(Client.organization_id == org_id).first()
                if not client:
                    client = Client(id=uuid.uuid4(), organization_id=org_id, company_name="Default Client", status="active")
                    db.add(client)
                    db.flush()
                proj = Project(
                    id=uuid.uuid4(),
                    organization_id=org_id,
                    name="Core Business Operations",
                    client_id=client.id,
                    budget=50000.0,
                    status="active"
                )
                db.add(proj)
                db.flush()
            return proj

        # Integration 1: Invoices (Sales or Purchase)
        if isinstance(data, InvoiceExtractionResult):
            proj = get_or_create_project()
            
            # Map items to products & sales records/stock
            for item in data.items:
                # Find or create Product
                prod = db.query(Product).filter(
                    Product.organization_id == org_id,
                    Product.sku == item.sku
                ).first() if item.sku else None
                
                if not prod:
                    prod = db.query(Product).filter(
                        Product.organization_id == org_id,
                        Product.name == item.product_name
                    ).first()
                    
                if not prod:
                    prod = Product(
                        id=uuid.uuid4(),
                        organization_id=org_id,
                        sku=item.sku or f"SKU-{uuid.uuid4().hex[:6].upper()}",
                        name=item.product_name,
                        category="General",
                        unit_cost=item.unit_price * 0.6,
                        selling_price=item.unit_price
                    )
                    db.add(prod)
                    db.flush()

                # Find or create InventoryItem
                inv_item = db.query(InventoryItem).filter(InventoryItem.product_id == prod.id).first()
                if not inv_item:
                    inv_item = InventoryItem(
                        id=uuid.uuid4(),
                        organization_id=org_id,
                        product_id=prod.id,
                        stock_on_hand=0
                    )
                    db.add(inv_item)
                    db.flush()

                if doc_type == "Purchase Invoice":
                    # Increase stock level
                    inv_item.stock_on_hand += item.quantity
                elif doc_type == "Sales Invoice":
                    # Record Sales log
                    sale = SalesRecord(
                        id=uuid.uuid4(),
                        organization_id=org_id,
                        product_id=prod.id,
                        quantity=item.quantity,
                        unit_price=item.unit_price,
                        revenue=item.quantity * item.unit_price,
                        date=datetime.datetime.strptime(data.invoice_date, "%Y-%m-%d").date()
                    )
                    db.add(sale)

            # Record Finance entries
            if doc_type == "Sales Invoice":
                rev = Revenue(
                    id=uuid.uuid4(),
                    organization_id=org_id,
                    project_id=proj.id,
                    amount=data.total_amount,
                    date=datetime.datetime.strptime(data.invoice_date, "%Y-%m-%d"),
                    description=f"Sales Invoice {data.invoice_number} - {data.customer_name}"
                )
                db.add(rev)
            elif doc_type == "Purchase Invoice":
                exp = Expense(
                    id=uuid.uuid4(),
                    organization_id=org_id,
                    amount=data.total_amount,
                    category="Inventory",
                    date=datetime.datetime.strptime(data.invoice_date, "%Y-%m-%d"),
                    description=f"Supplier Invoice {data.invoice_number} - {data.supplier_name}"
                )
                db.add(exp)

        # Integration 2: Purchase Order
        elif isinstance(data, PurchaseOrderExtractionResult):
            # Map PO items to Inventory Stock & Expenses
            prod = db.query(Product).filter(
                Product.organization_id == org_id,
                Product.sku == data.sku
            ).first()
            if not prod:
                prod = Product(
                    id=uuid.uuid4(),
                    organization_id=org_id,
                    sku=data.sku,
                    name=data.product_name,
                    category="General",
                    unit_cost=data.unit_cost,
                    selling_price=data.unit_cost * 1.5
                )
                db.add(prod)
                db.flush()

            inv_item = db.query(InventoryItem).filter(InventoryItem.product_id == prod.id).first()
            if not inv_item:
                inv_item = InventoryItem(
                    id=uuid.uuid4(),
                    organization_id=org_id,
                    product_id=prod.id,
                    stock_on_hand=0
                )
                db.add(inv_item)
                db.flush()

            # Increase stock levels
            inv_item.stock_on_hand += data.quantity
            
            # Log Expense
            exp = Expense(
                id=uuid.uuid4(),
                organization_id=org_id,
                amount=data.total_cost,
                category="Inventory Procurement",
                date=datetime.datetime.utcnow(),
                description=f"PO Procurement {data.po_number} - {data.supplier_name}"
            )
            db.add(exp)

        # Integration 3: Expense Receipts
        elif isinstance(data, ExpenseExtractionResult):
            exp = Expense(
                id=uuid.uuid4(),
                organization_id=org_id,
                amount=data.amount,
                category=data.category,
                date=datetime.datetime.strptime(data.date, "%Y-%m-%d"),
                description=f"Receipt - {data.vendor}"
            )
            db.add(exp)

        # Integration 4: Sales Report
        elif isinstance(data, SalesReportExtractionResult):
            proj = get_or_create_project()
            for record in data.sales_records:
                prod = db.query(Product).filter(Product.organization_id == org_id, Product.sku == record.sku).first()
                if not prod:
                    prod = Product(
                        id=uuid.uuid4(),
                        organization_id=org_id,
                        sku=record.sku,
                        name=f"Product {record.sku}",
                        category="General",
                        unit_cost=record.unit_price * 0.6,
                        selling_price=record.unit_price
                    )
                    db.add(prod)
                    db.flush()

                sale = SalesRecord(
                    id=uuid.uuid4(),
                    organization_id=org_id,
                    product_id=prod.id,
                    quantity=record.quantity,
                    unit_price=record.unit_price,
                    revenue=record.revenue,
                    date=datetime.datetime.strptime(record.date, "%Y-%m-%d").date()
                )
                db.add(sale)
                
                rev = Revenue(
                    id=uuid.uuid4(),
                    organization_id=org_id,
                    project_id=proj.id,
                    amount=record.revenue,
                    date=datetime.datetime.strptime(record.date, "%Y-%m-%d"),
                    description=f"Sales Report Ingestion - {record.sku}"
                )
                db.add(rev)

        # Integration 5: Inventory Report
        elif isinstance(data, InventoryReportExtractionResult):
            for item in data.inventory_items:
                prod = db.query(Product).filter(Product.organization_id == org_id, Product.sku == item.sku).first()
                if not prod:
                    prod = Product(
                        id=uuid.uuid4(),
                        organization_id=org_id,
                        sku=item.sku,
                        name=item.name,
                        category=item.category,
                        unit_cost=20.0,
                        selling_price=50.0
                    )
                    db.add(prod)
                    db.flush()
                else:
                    prod.name = item.name
                    prod.category = item.category
                
                inv_item = db.query(InventoryItem).filter(InventoryItem.product_id == prod.id).first()
                if not inv_item:
                    inv_item = InventoryItem(
                        id=uuid.uuid4(),
                        organization_id=org_id,
                        product_id=prod.id
                    )
                    db.add(inv_item)
                    db.flush()
                inv_item.stock_on_hand = item.stock_on_hand
                inv_item.lead_time_days = item.lead_time_days
                inv_item.reorder_point = max(5, int(item.stock_on_hand * 0.1))

    @staticmethod
    async def _generate_coo_insights(
        db: Session,
        org_id: uuid.UUID,
        doc_type: str,
        extracted_data: Any,
        validation: DataQualityAssessment
    ) -> str:
        """
        Dynamically triggers forecasting/COO reasoning and synthesizes business impact.
        """
        gemini_service = container.get("gemini_service")
        
        # 1. Execute Local Mock Insights if Gemini is in Mock Mode
        if gemini_service.mock_mode:
            if doc_type in ["Purchase Invoice", "Purchase Order"]:
                qty = getattr(extracted_data, "quantity", 0)
                if not qty and hasattr(extracted_data, "items"):
                    qty = sum(item.quantity for item in extracted_data.items)
                total_cost = getattr(extracted_data, "total_cost", 0.0) or getattr(extracted_data, "total_amount", 0.0)
                return (
                    f"Inventory increased by {qty} units.\n"
                    f"Projected inventory coverage is 74 days.\n"
                    f"Cash reserves decrease by ${total_cost:,.2f}.\n\n"
                    f"Recommendation:\nDelay additional procurement for SKU Group Apparel."
                )
            elif doc_type in ["Sales Invoice", "Sales Report"]:
                qty = getattr(extracted_data, "quantity", 0)
                if not qty and hasattr(extracted_data, "items"):
                    qty = sum(item.quantity for item in extracted_data.items)
                rev = getattr(extracted_data, "revenue", 0.0) or getattr(extracted_data, "total_amount", 0.0)
                return (
                    f"Revenue increased by ${rev:,.2f}.\n"
                    f"Sales velocity shows strong demand for apparel segments.\n\n"
                    f"Recommendation:\nMonitor stock levels to prevent safety stock violations."
                )
            elif doc_type in ["Receipt"]:
                amt = getattr(extracted_data, "amount", 0.0)
                return (
                    f"Expenses increased by ${amt:,.2f}.\n"
                    f"Net profit margins compressed by 2.4%.\n\n"
                    f"Recommendation:\nAudit operational expense categories and vendor contracts to contain costs."
                )
            else:
                return "Document ingested successfully. Business metrics and dashboard updated."

        try:
            # Get current aggregated overview
            stats = BusinessAnalyticsService.get_overview(db, org_id)
            
            prompt = (
                f"You are the EVE Virtual COO. Analyze the operational impact of this newly ingested document:\n"
                f"Document Category: {doc_type}\n"
                f"Data Extracted: {extracted_data.model_dump()}\n"
                f"Data Quality Score: {validation.quality_score}\n\n"
                f"Current Organization Aggregated KPIs:\n"
                f"- Total Revenue: ${stats.get('revenue', 0.0):,.2f}\n"
                f"- Total Expenses: ${stats.get('expenses', 0.0):,.2f}\n"
                f"- Net Profit: ${stats.get('profit', 0.0):,.2f}\n"
                f"- Inventory Count: {stats.get('inventory', 0)} distinct items\n\n"
                f"Synthesize this into a COO business insight. Keep it extremely concise, clear, and actionable. "
                f"Include the metric changes (e.g. inventory coverage, cash reserve movements) and a clear, bulleted recommendation."
            )
            
            res_insights = await gemini_service.generate_text(
                prompt=prompt,
                system_instruction="You are EVE, a Staff COO Systems Architect. Summarize operational impacts of uploads concisely.",
                agent_name="coo_document_analyzer"
            )
            return res_insights.strip()
            
        except Exception as e:
            logger.error(f"Failed to generate COO insights using Gemini: {e}")
            return "Document ingested successfully. Business metrics and dashboard updated."
