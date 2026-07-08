from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict

class EngineContext(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    sku: str
    organization_id: Optional[Any] = None
    db: Optional[Any] = None
    stock_on_hand: int = 0
    lead_time_days: int = 14
    avg_daily_sales: float = 0.0
    parameters: Dict[str, Any] = Field(default_factory=dict)

class EngineOutput(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    engine_name: str
    success: bool
    data: Dict[str, Any] = Field(default_factory=dict)
    confidence_weight: float = Field(default=1.0, ge=0.0, le=1.0)
    errors: list[str] = Field(default_factory=list)

class BaseEngine(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    async def execute(self, context: EngineContext) -> EngineOutput:
        pass
