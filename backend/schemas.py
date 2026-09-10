"""
Pydantic schemas for the Landslide Risk Prediction FastAPI service.
"""

from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


class RainfallInput(BaseModel):
    rainfall_1d: Optional[float] = Field(
        default=None,
        description="1-day cumulative rainfall in mm (>= 0 or null)",
    )
    rainfall_3d: Optional[float] = Field(
        default=None,
        description="3-day cumulative rainfall in mm (>= 0 or null)",
    )
    rainfall_7d: Optional[float] = Field(
        default=None,
        description="7-day cumulative rainfall in mm (>= 0 or null)",
    )
    rainfall_14d: Optional[float] = Field(
        default=None,
        description="14-day cumulative rainfall in mm (>= 0 or null)",
    )
    rainfall_30d: Optional[float] = Field(
        default=None,
        description="30-day cumulative rainfall in mm (>= 0 or null)",
    )

    @field_validator(
        "rainfall_1d",
        "rainfall_3d",
        "rainfall_7d",
        "rainfall_14d",
        "rainfall_30d",
        mode="before",
    )
    @classmethod
    def validate_rainfall(cls, v):
        if v is None:
            return None
        try:
            val = float(v)
        except (ValueError, TypeError):
            raise ValueError(f"Rainfall must be a valid number, got {v}")
        if val < 0:
            raise ValueError(f"Rainfall value cannot be negative: {val}")
        return val


class RiskPredictionResponse(BaseModel):
    status: Literal["success", "insufficient_data"]
    risk_score: Optional[float] = Field(
        default=None,
        description="Continuous rainfall risk score (0-100), or null if data is insufficient",
    )
    risk_level: Literal["Low", "Moderate", "High", "Very High", "Insufficient Data"] = Field(
        description="Risk category based on project thresholds",
    )


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "SIH Landslide Risk Prediction API"
    model_loaded: bool
    algorithm: str
    required_features: list[str]
