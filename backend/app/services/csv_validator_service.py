import pandas as pd
from typing import List, Dict, Any, Tuple
from pydantic import BaseModel, Field, ValidationError

class BaseImportSchema(BaseModel):
    pass

class ProductImportSchema(BaseImportSchema):
    sku: str = Field(..., min_length=1, description="Unique Stock Keeping Unit")
    name: str = Field(..., min_length=1, description="Product Name")
    category: str = Field(default="Uncategorized")
    selling_price: float = Field(..., ge=0.0, description="Selling price cannot be negative")
    unit_cost: float = Field(..., ge=0.0, description="Unit cost cannot be negative")

class InventoryImportSchema(BaseImportSchema):
    sku: str = Field(..., min_length=1)
    stock_on_hand: int = Field(..., ge=0, description="Stock cannot be negative")
    reorder_point: int = Field(..., ge=0)
    safety_stock: int = Field(..., ge=0)
    lead_time_days: int = Field(..., ge=0, description="Lead time cannot be negative")

class CSVValidatorService:
    """
    Data Quality Layer.
    Validates CSV imports to prevent garbage-in / garbage-out behavior in EVE.
    Checks for negative values, missing columns, invalid formats, and data inconsistencies.
    """
    
    @staticmethod
    def validate_dataframe(df: pd.DataFrame, schema_class: type[BaseModel]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Validates a pandas DataFrame against a Pydantic schema.
        Returns a tuple of (valid_records, error_records).
        """
        valid_records = []
        error_records = []
        
        df_cleaned = df.where(pd.notnull(df), None)
        records = df_cleaned.to_dict(orient='records')
        
        for idx, row in enumerate(records):
            try:
                valid_model = schema_class.model_validate(row)
                valid_records.append(valid_model.model_dump())
            except ValidationError as e:
                error_records.append({
                    "row_index": idx + 1,
                    "errors": [err["msg"] for err in e.errors()]
                })
                
        return valid_records, error_records