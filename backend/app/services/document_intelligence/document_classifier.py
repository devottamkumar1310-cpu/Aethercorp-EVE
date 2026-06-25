import logging
import pandas as pd
import io
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.dependency_container import container
from google.genai import types

logger = logging.getLogger("eve.services.document_classifier")

class DocumentClassificationResult(BaseModel):
    document_type: str = Field(..., description="Type of the document. Must be one of: 'Invoice', 'Receipt', 'Purchase Order', 'Financial Statement', 'Business Contract', 'Inventory Document', 'Unknown / Unsupported'")
    confidence: float = Field(..., description="Confidence score from 0.0 to 1.0")
    explanation: str = Field(..., description="Explanation for the classification decision")

class DocumentClassifier:
    @staticmethod
    async def classify_document(
        db: Session,
        file_content: bytes,
        filename: str,
        mime_type: str
    ) -> DocumentClassificationResult:
        """
        Classifies an uploaded document automatically using Gemini multi-modal input
        or local parsing helpers.
        """
        gemini_service = container.get("gemini_service")
        
        # 1. Check if we should execute Mock Mode
        if gemini_service.mock_mode:
            logger.info(f"Running Document Classifier in MOCK mode for: {filename}")
            return DocumentClassifier._mock_classification(filename)

        # Check for corrupt files (Invalid magic bytes or unparseable formats)
        fn_lower = filename.lower()
        if fn_lower.endswith(".pdf"):
            if not file_content.startswith(b"%PDF"):
                return DocumentClassificationResult(
                    document_type="Unknown / Unsupported",
                    confidence=0.1,
                    explanation="Invalid PDF format: File header does not begin with standard PDF signature."
                )
        elif fn_lower.endswith(".xlsx"):
            if not file_content.startswith(b"PK\x03\x04"):
                return DocumentClassificationResult(
                    document_type="Unknown / Unsupported",
                    confidence=0.1,
                    explanation="Invalid Excel format: File header does not begin with standard ZIP/Office signature."
                )
        elif fn_lower.endswith(".csv"):
            try:
                # Try decoding to check if it's readable text
                file_content.decode("utf-8")
            except Exception:
                return DocumentClassificationResult(
                    document_type="Unknown / Unsupported",
                    confidence=0.1,
                    explanation="Invalid CSV format: File is binary or cannot be decoded as UTF-8 text."
                )
        elif fn_lower.endswith((".png", ".jpg", ".jpeg")):
            # Basic signature check for images
            if fn_lower.endswith(".png") and not file_content.startswith(b"\x89PNG"):
                return DocumentClassificationResult(
                    document_type="Unknown / Unsupported",
                    confidence=0.1,
                    explanation="Invalid PNG format: Missing standard signature."
                )
            elif fn_lower.endswith((".jpg", ".jpeg")) and not file_content.startswith(b"\xff\xd8\xff"):
                return DocumentClassificationResult(
                    document_type="Unknown / Unsupported",
                    confidence=0.1,
                    explanation="Invalid JPEG format: Missing standard SOI marker."
                )

        try:
            # 2. Prepare content for Gemini
            contents = []
            
            # If CSV or XLSX, parse to text representation to optimize context
            if mime_type == "text/csv" or filename.lower().endswith(".csv"):
                try:
                    text_content = file_content.decode("utf-8", errors="ignore")
                    # Limit size of text passed to Gemini to prevent token overload
                    contents.append(f"Here is the text representation of the CSV file:\n{text_content[:8000]}")
                except Exception as e:
                    logger.warning(f"Failed to decode CSV bytes as text: {e}")
            elif mime_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" or filename.lower().endswith(".xlsx"):
                try:
                    df = pd.read_excel(io.BytesIO(file_content))
                    csv_text = df.to_csv(index=False)
                    contents.append(f"Here is the CSV representation of the Excel spreadsheet:\n{csv_text[:8000]}")
                except Exception as e:
                    logger.warning(f"Failed to parse Excel file bytes: {e}")
            else:
                # PDF or Image input passed directly as binary Part to GenAI
                part = types.Part.from_bytes(
                    data=file_content,
                    mime_type=mime_type
                )
                contents.append(part)

            prompt = (
                "Analyze this uploaded file and classify it into exactly one of the following categories:\n"
                "1. Invoice\n"
                "2. Receipt\n"
                "3. Purchase Order\n"
                "4. Financial Statement\n"
                "5. Business Contract\n"
                "6. Inventory Document\n"
                "7. Unknown / Unsupported\n\n"
                "Ensure you determine the correct type based on headers, text content, formatting, or visual elements. "
                "Any non-business files (such as selfies, vacation photos, memes, screenshots, wallpapers, or unrelated images) MUST be classified as 'Unknown / Unsupported'. "
                "Provide a confidence score and a clear explanation."
            )
            contents.append(prompt)

            # Query Gemini
            res: DocumentClassificationResult = await gemini_service.generate_structured_response(
                prompt=prompt,
                response_schema=DocumentClassificationResult,
                system_instruction="You are an expert document classifier. Categorize business documents with high accuracy. Reject non-business uploads such as selfies, memes, or random photos as 'Unknown / Unsupported'.",
                agent_name="document_classifier"
            )
            return res

        except Exception as e:
            logger.error(f"Failed to classify document using Gemini API: {e}", exc_info=True)
            # Fallback to local heuristic classifier on failure
            return DocumentClassifier._mock_classification(filename)

    @staticmethod
    def _mock_classification(filename: str) -> DocumentClassificationResult:
        fn_lower = filename.lower()
        if "selfie" in fn_lower or "meme" in fn_lower or "photo" in fn_lower or "vacation" in fn_lower or "wallpaper" in fn_lower or "screenshot" in fn_lower or "unrelated" in fn_lower:
            return DocumentClassificationResult(
                document_type="Unknown / Unsupported",
                confidence=0.99,
                explanation="Mock Classifier: Non-business file rejected as 'Unknown / Unsupported' based on filename pattern match."
            )
        elif "financial_statement" in fn_lower or "financial" in fn_lower:
            return DocumentClassificationResult(
                document_type="Financial Statement",
                confidence=0.99,
                explanation="Mock Classifier: Document classified as 'Financial Statement' based on filename pattern match."
            )
        elif "contract" in fn_lower or "agreement" in fn_lower or "business_contract" in fn_lower:
            return DocumentClassificationResult(
                document_type="Business Contract",
                confidence=0.99,
                explanation="Mock Classifier: Document classified as 'Business Contract' based on filename pattern match."
            )
        elif "inventory_report" in fn_lower or "inventoryreport" in fn_lower or "stock" in fn_lower or "inventory" in fn_lower:
            return DocumentClassificationResult(
                document_type="Inventory Document",
                confidence=0.99,
                explanation="Mock Classifier: Document classified as 'Inventory Document' based on filename pattern match."
            )
        elif "purchase_order" in fn_lower or "purchaseorder" in fn_lower or "po" in fn_lower:
            return DocumentClassificationResult(
                document_type="Purchase Order",
                confidence=0.99,
                explanation="Mock Classifier: Document classified as 'Purchase Order' based on filename pattern match."
            )
        elif "purchase_invoice" in fn_lower or "supplier_invoice" in fn_lower or "sales_invoice" in fn_lower or "customer_invoice" in fn_lower or "invoice" in fn_lower:
            return DocumentClassificationResult(
                document_type="Invoice",
                confidence=0.95,
                explanation="Mock Classifier: Document classified as 'Invoice' based on filename pattern match."
            )
        elif "receipt" in fn_lower or "bill" in fn_lower or "expense" in fn_lower:
            return DocumentClassificationResult(
                document_type="Receipt",
                confidence=0.98,
                explanation="Mock Classifier: Document classified as 'Receipt' based on filename pattern match."
            )
        else:
            return DocumentClassificationResult(
                document_type="Unknown / Unsupported",
                confidence=0.20,
                explanation="Mock Classifier: Unable to match filename pattern to any known category."
            )
