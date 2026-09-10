"""
Pydantic schemas for the Landslide Risk Prediction FastAPI service.
"""

from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


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


class RainfallFeaturesResponse(BaseModel):
    rainfall_1d: float
    rainfall_3d: float
    rainfall_7d: float
    rainfall_14d: float
    rainfall_30d: float
    data_source: Optional[str] = None


class HourlyForecastItem(BaseModel):
    time: str
    rainfall_mm: float
    precipitation_probability: Optional[int] = None
    temperature_c: Optional[float] = None
    condition: str


class RainfallForecastResponse(BaseModel):
    latitude: float
    longitude: float
    hours: int
    data_source: str
    total_rainfall_mm: float
    max_hourly_rainfall_mm: float
    forecast: list[HourlyForecastItem]


class TerrainResponse(BaseModel):
    latitude: float
    longitude: float
    elevation_m: float
    slope_degrees: float
    slope_category: Literal["Flat", "Moderate", "Steep", "Very Steep"]
    terrain_susceptibility: Literal["Low", "Moderate", "High", "Very High"]
    data_source: str


class FacilityItem(BaseModel):
    id: str
    name: str
    type: Literal["authority", "hospital", "school"]
    latitude: float
    longitude: float
    address: str
    district: str
    contact: str
    distance_km: float


class NearbyFacilitiesResponse(BaseModel):
    latitude: float
    longitude: float
    radius_km: float
    count: int
    facilities: list[FacilityItem]


class DashboardAlertSchema(BaseModel):
    id: str
    severity: Literal["LOW", "MODERATE", "HIGH", "VERY_HIGH"]
    status: Literal["ACTIVE", "SENT", "ACKNOWLEDGED", "RESOLVED"] = "ACTIVE"
    notificationStatus: Literal["NOT_SENT", "SENT"] = "NOT_SENT"
    latitude: float
    longitude: float
    locationLabel: str
    horizon: Literal["CURRENT", "6H", "24H", "48H", "72H"]
    riskScore: float
    riskLevel: str
    rainfallRiskScore: float
    terrainScore: float
    terrainSusceptibility: str
    terrainContribution: float
    finalRiskScore: float
    finalRiskLevel: str
    rainfall: float
    elevation: Optional[float] = None
    slope: Optional[float] = None
    slopeClassification: Optional[str] = None
    radiusKm: float = 5.0
    message: str
    createdAt: str
    sentAt: Optional[str] = None
    acknowledgedAt: Optional[str] = None
    resolvedAt: Optional[str] = None
    isDemo: Optional[bool] = False


class AlertActionResponse(BaseModel):
    success: bool
    status: str
    message: str
    alert: Optional[DashboardAlertSchema] = None


class MonitoringRiskPointSchema(BaseModel):
    id: str
    latitude: float
    longitude: float
    locationName: str
    district: str
    currentRisk: Optional[float] = None
    currentRiskLevel: str
    risk6h: Optional[float] = None
    risk6hLevel: str
    risk24h: Optional[float] = None
    risk24hLevel: str
    risk48h: Optional[float] = None
    risk48hLevel: str
    risk72h: Optional[float] = None
    risk72hLevel: str
    rainfall1d: Optional[float] = None
    rainfall3d: Optional[float] = None
    rainfall7d: Optional[float] = None
    rainfall14d: Optional[float] = None
    rainfall30d: Optional[float] = None
    forecast6h: Optional[float] = None
    forecast24h: Optional[float] = None
    forecast48h: Optional[float] = None
    forecast72h: Optional[float] = None
    elevation: Optional[float] = None
    slope: Optional[float] = None
    terrainSusceptibility: str
    status: str = "success"
    updatedAt: Optional[str] = None


class DashboardRiskGridResponse(BaseModel):
    total: int
    points: list[MonitoringRiskPointSchema]
    lastUpdated: str
    cached: bool = False


class GridCoordinate(BaseModel):
    latitude: float
    longitude: float
    name: Optional[str] = None
    district: Optional[str] = None


class RiskGridBatchRequest(BaseModel):
    points: list[GridCoordinate]
    force_refresh: Optional[bool] = False
    state_name: Optional[str] = Field(None, alias="state", description="Target Indian state name (e.g. 'Sikkim')")

    model_config = ConfigDict(populate_by_name=True)


class RiskGridPointResult(BaseModel):
    latitude: float
    longitude: float
    location_name: Optional[str] = None
    risk_score: Optional[float] = None
    risk_level: str
    rainfall_risk_score: Optional[float] = None
    terrain_score: Optional[float] = None
    terrain_susceptibility: Optional[str] = None
    elevation: Optional[float] = None
    slope: Optional[float] = None
    rainfall_7d: Optional[float] = None
    forecast_72h: Optional[float] = None
    status: str = "success"


class RiskGridBatchResponse(BaseModel):
    total: int
    results: list[RiskGridPointResult]
    cached: bool = False
    timestamp: str


class StateInfo(BaseModel):
    name: str
    code: Optional[str] = None
    short_name: Optional[str] = None
    lgd_code: Optional[int] = None


class StatesListResponse(BaseModel):
    total: int
    states: list[StateInfo]
    source: str = "BharatMaps"


class StateBoundaryResponse(BaseModel):
    type: str = "Feature"
    properties: dict[str, Any]
    geometry: dict[str, Any]
    source: str = "BharatMaps"


class FieldReportCreateRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude of observation")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude of observation")
    category: str = Field(..., description="Observation category (e.g. Landslide, Slope Crack, Road Blockage)")
    severity: str = Field(..., description="Severity level (Low, Moderate, High, Critical)")
    description: str = Field(..., min_length=5, description="Detailed observation description")
    photo: Optional[str] = Field(default=None, description="Base64 encoded photo or image URL")
    reporter_name: Optional[str] = Field(default="Anonymous Field Officer", description="Reporter name or department")
    district: Optional[str] = Field(default=None, description="District name")
    state: Optional[str] = Field(default="Sikkim", description="State name")


class FieldReportStatusUpdateRequest(BaseModel):
    status: Literal["SUBMITTED", "REVIEWED", "RESOLVED"] = Field(..., description="New operational status")


class FieldReportResponse(BaseModel):
    id: str
    latitude: float
    longitude: float
    timestamp: str
    category: str
    severity: str
    description: str
    photo: Optional[str] = None
    reporter_name: Optional[str] = None
    status: str
    district: Optional[str] = None
    state: Optional[str] = None
    elevation: Optional[float] = None
    slope: Optional[float] = None
    reviewed_at: Optional[str] = None
    resolved_at: Optional[str] = None





