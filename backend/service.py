"""
FastAPI REST Service for Landslide Risk Prediction (Phase 1).
Exposes /health and /predict endpoints backed by the GradientBoostingRegressor model.
"""
from backend.weather_service import (
    get_current_weather,
    get_hourly_history,
    get_rainfall_features,
    get_rainfall_features_batch,
    get_rainfall_forecast,
)
from backend.terrain_service import get_terrain_features, get_terrain_features_batch
from backend.facility_service import get_nearby_facilities
import asyncio
import datetime
import logging
import time
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

import httpx
from backend.model_loader import LandslideRiskModelLoader, REQUIRED_FEATURES
from backend.schemas import (
    HealthResponse,
    RainfallInput,
    RiskPredictionResponse,
    RainfallFeaturesResponse,
    RainfallForecastResponse,
    TerrainResponse,
    NearbyFacilitiesResponse,
    DashboardAlertSchema,
    AlertActionResponse,
    MonitoringRiskPointSchema,
    DashboardRiskGridResponse,
    GridCoordinate,
    RiskGridBatchRequest,
    RiskGridPointResult,
    RiskGridBatchResponse,
    StatesListResponse,
    StateInfo,
    StateBoundaryResponse,
    FieldReportCreateRequest,
    FieldReportStatusUpdateRequest,
    FieldReportResponse,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("landslide_risk_service")


def get_model_loader() -> LandslideRiskModelLoader:
    """Retrieves or initializes the model loader singleton."""
    loader = getattr(app.state, "model_loader", None)
    if loader is None:
        loader = LandslideRiskModelLoader.get_instance()
        app.state.model_loader = loader
    return loader


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Loads the ML model once on application startup.
    Ensures the model is cached and ready before accepting requests.
    """
    logger.info("Initializing Landslide Risk Model singleton on startup...")
    try:
        loader = get_model_loader()
        logger.info("Model loaded successfully into application state.")
    except Exception as exc:
        logger.error(f"Failed to load model on startup: {exc}")
        raise exc
    yield
    logger.info("Shutting down Landslide Risk Service.")


app = FastAPI(
    title="SIH Landslide Risk Prediction API",
    description=(
        "Standalone prediction microservice for SIH Landslide Risk assessment. "
        "Evaluates antecedent rainfall lags using a trained GradientBoostingRegressor pipeline."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend integration
ALLOWED_ORIGINS = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint.
    Reports operational status and verifies that the model artifact is loaded in memory.
    """
    try:
        loader = get_model_loader()
        is_loaded = loader.is_loaded
    except Exception:
        is_loaded = False

    return HealthResponse(
        status="ok",
        service="SIH Landslide Risk Prediction API",
        model_loaded=is_loaded,
        algorithm="GradientBoostingRegressor",
        required_features=REQUIRED_FEATURES,
    )


@app.post("/predict", response_model=RiskPredictionResponse)
async def predict_risk(payload: RainfallInput):
    """
    Predicts the landslide rainfall risk score (0-100) and risk level.

    Accepts 5 cumulative rainfall features:
    - rainfall_1d
    - rainfall_3d
    - rainfall_7d
    - rainfall_14d
    - rainfall_30d

    If any feature is missing/null, returns status='insufficient_data'
    without passing fabricated values to the model.
    """
    # Check if all required rainfall inputs are present
    feature_values = {
        "rainfall_1d": payload.rainfall_1d,
        "rainfall_3d": payload.rainfall_3d,
        "rainfall_7d": payload.rainfall_7d,
        "rainfall_14d": payload.rainfall_14d,
        "rainfall_30d": payload.rainfall_30d,
    }

    # If any feature is None, return Insufficient Data
    missing = [k for k, v in feature_values.items() if v is None]
    if missing:
        logger.info(f"Missing rainfall inputs ({missing}) -> returning Insufficient Data")
        return RiskPredictionResponse(
            status="insufficient_data",
            risk_score=None,
            risk_level="Insufficient Data",
        )

    # Perform inference via cached model singleton
    loader = get_model_loader()
    try:
        score, level = loader.predict(feature_values)
        return RiskPredictionResponse(
            status="success",
            risk_score=score,
            risk_level=level,
        )
    except Exception as exc:
        logger.error(f"Inference error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference execution failed: {str(exc)}",
        )
@app.get("/weather/current")
async def current_weather(latitude: float, longitude: float):
    """
    Returns current Google Weather conditions for a location.
    """
    try:
        return await get_current_weather(latitude, longitude)
    except Exception as exc:
        logger.error(f"Weather API error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to retrieve weather data",
        )


@app.get("/weather/history")
async def weather_history(
    latitude: float,
    longitude: float,
    hours: int = 24,
):
    """
    Returns up to 24 hours of historical Google Weather data.
    """
    try:
        return await get_hourly_history(latitude, longitude, hours)
    except Exception as exc:
        logger.error(f"Weather history API error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to retrieve historical weather data",
        )
@app.get(
    "/weather/rainfall",
    response_model=RainfallFeaturesResponse,
    summary="Rainfall Features",
)
@app.get(
    "/weather/rainfall/",
    response_model=RainfallFeaturesResponse,
    include_in_schema=False,
)
async def rainfall_features(latitude: float, longitude: float):
    try:
        return await get_rainfall_features(latitude, longitude)
    except Exception as exc:
        logger.error(f"Rainfall API error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to retrieve rainfall data",
        )


@app.get(
    "/weather/forecast",
    response_model=RainfallForecastResponse,
    summary="Rainfall Forecast",
)
@app.get(
    "/weather/forecast/",
    response_model=RainfallForecastResponse,
    include_in_schema=False,
)
async def rainfall_forecast(
    latitude: float,
    longitude: float,
    hours: int = 72,
):
    """
    Returns 6-72 hour rainfall forecast for given latitude and longitude.
    """
    try:
        return await get_rainfall_forecast(latitude, longitude, hours)
    except Exception as exc:
        logger.error(f"Forecast API error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Unable to retrieve forecast data: {str(exc)}",
        )


@app.get(
    "/terrain",
    response_model=TerrainResponse,
    summary="Terrain Elevation & Slope Assessment",
)
@app.get(
    "/terrain/",
    response_model=TerrainResponse,
    include_in_schema=False,
)
async def terrain_assessment(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Latitude between -90 and 90"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Longitude between -180 and 180"),
):
    """
    Returns real elevation and derived slope information for the specified coordinates
    using the Copernicus DEM GLO-90 dataset via Open-Meteo Elevation API.
    """
    try:
        return await get_terrain_features(latitude, longitude)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(f"Terrain API error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Unable to retrieve terrain data: {str(exc)}",
        )


@app.get(
    "/alerts/nearby",
    response_model=NearbyFacilitiesResponse,
    summary="Nearby Emergency & Public Facilities",
)
@app.get(
    "/alerts/nearby/",
    response_model=NearbyFacilitiesResponse,
    include_in_schema=False,
)
async def nearby_facilities(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Latitude between -90 and 90"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Longitude between -180 and 180"),
    radius_km: float = Query(10.0, gt=0.0, le=100.0, description="Search radius in kilometers (default 10km)"),
):
    """
    Returns nearby emergency authorities, hospitals, and schools within `radius_km`
    of coordinates, ordered by response priority (Authorities -> Health -> Education).
    """
    try:
        facilities = get_nearby_facilities(latitude, longitude, radius_km)
        return NearbyFacilitiesResponse(
            latitude=latitude,
            longitude=longitude,
            radius_km=radius_km,
            count=len(facilities),
            facilities=facilities,
        )
    except Exception as exc:
        logger.error(f"Facility lookup error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to retrieve nearby facilities: {str(exc)}",
        )


# In-memory alerts repository for demo state persistence
DASHBOARD_ALERTS: dict[str, dict] = {}


@app.get("/alerts", response_model=list[DashboardAlertSchema], summary="List Landslide Alerts")
async def list_alerts():
    """Returns all active, sent, acknowledged, and resolved alerts."""
    return list(DASHBOARD_ALERTS.values())


@app.post("/alerts", response_model=AlertActionResponse, summary="Create or Update Alert")
async def create_or_update_alert(payload: DashboardAlertSchema):
    """Creates a new alert or updates dynamic metrics for an existing alert."""
    existing = DASHBOARD_ALERTS.get(payload.id)
    alert_dict = payload.model_dump()
    if existing:
        # Preserve user workflow status
        alert_dict["status"] = existing.get("status", "ACTIVE")
        alert_dict["notificationStatus"] = existing.get("notificationStatus", "NOT_SENT")
        alert_dict["sentAt"] = existing.get("sentAt")
        alert_dict["acknowledgedAt"] = existing.get("acknowledgedAt")
        alert_dict["resolvedAt"] = existing.get("resolvedAt")
    DASHBOARD_ALERTS[payload.id] = alert_dict
    return AlertActionResponse(
        success=True,
        status=alert_dict["status"],
        message="Alert recorded successfully",
        alert=DashboardAlertSchema(**alert_dict),
    )


@app.post("/alerts/{alert_id}/send", response_model=AlertActionResponse, summary="Send Alert (Demo)")
async def send_alert(alert_id: str):
    """Marks alert notification status as SENT."""
    import datetime
    alert = DASHBOARD_ALERTS.get(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert["status"] = "SENT"
    alert["notificationStatus"] = "SENT"
    alert["sentAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    return AlertActionResponse(
        success=True,
        status="SENT",
        message="Demo alert notification sent successfully.",
        alert=DashboardAlertSchema(**alert),
    )


@app.post("/alerts/{alert_id}/acknowledge", response_model=AlertActionResponse, summary="Acknowledge Alert")
async def acknowledge_alert(alert_id: str):
    """Marks alert as ACKNOWLEDGED by district control room."""
    import datetime
    alert = DASHBOARD_ALERTS.get(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert["status"] = "ACKNOWLEDGED"
    alert["acknowledgedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    return AlertActionResponse(
        success=True,
        status="ACKNOWLEDGED",
        message="Alert marked as acknowledged.",
        alert=DashboardAlertSchema(**alert),
    )


@app.post("/alerts/{alert_id}/resolve", response_model=AlertActionResponse, summary="Resolve Alert")
async def resolve_alert(alert_id: str):
    """Marks alert as RESOLVED."""
    alert = DASHBOARD_ALERTS.get(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert["status"] = "RESOLVED"
    alert["resolvedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    return AlertActionResponse(
        success=True,
        status="RESOLVED",
        message="Alert marked as resolved.",
        alert=DashboardAlertSchema(**alert),
    )


# Predefined Sikkim monitoring watchpoints for data-driven dashboard heatmap
DASHBOARD_WATCHPOINTS = [
    {
        "id": "mgn-high",
        "name": "Mangan (Alpine Steep Ridge)",
        "district": "Mangan",
        "lat": 27.8174,
        "lng": 88.4778,
    },
    {
        "id": "mgn-town",
        "name": "Mangan District Center",
        "district": "Mangan",
        "lat": 27.505,
        "lng": 88.532,
    },
    {
        "id": "mgn-chungthang",
        "name": "Chungthang Valley Corridor",
        "district": "Mangan",
        "lat": 27.6011,
        "lng": 88.6446,
    },
    {
        "id": "mgn-dikchu",
        "name": "Dikchu River Cut Slopes",
        "district": "Mangan",
        "lat": 27.4211,
        "lng": 88.5122,
    },
    {
        "id": "gtk-capital",
        "name": "Gangtok District Capital",
        "district": "Gangtok",
        "lat": 27.3389,
        "lng": 88.6065,
    },
    {
        "id": "gtk-ranipool",
        "name": "Ranipool Corridor",
        "district": "Gangtok",
        "lat": 27.2531,
        "lng": 88.5942,
    },
    {
        "id": "nmc-center",
        "name": "Namchi District Center",
        "district": "Namchi",
        "lat": 27.1667,
        "lng": 88.35,
    },
    {
        "id": "nmc-melli",
        "name": "Melli Riverbank Slopes",
        "district": "Namchi",
        "lat": 27.0925,
        "lng": 88.4586,
    },
    {
        "id": "gyl-center",
        "name": "Gyalshing District Center",
        "district": "Gyalshing",
        "lat": 27.2833,
        "lng": 88.2667,
    },
    {
        "id": "pky-center",
        "name": "Pakyong District Center",
        "district": "Pakyong",
        "lat": 27.2333,
        "lng": 88.5833,
    },
    {
        "id": "srn-center",
        "name": "Soreng District Center",
        "district": "Soreng",
        "lat": 27.1833,
        "lng": 88.1833,
    },
]

TERRAIN_SUSCEPTIBILITY_SCORES = {
    "Low": 0,
    "Moderate": 25,
    "High": 60,
    "Very High": 90,
}
TERRAIN_WEIGHT = 0.35


def calculate_hybrid_risk_score(rainfall_risk_score: float | None, terrain_susceptibility: str) -> tuple[float | None, str]:
    if rainfall_risk_score is None:
        return None, "Insufficient Data"
    terrain_score = TERRAIN_SUSCEPTIBILITY_SCORES.get(terrain_susceptibility, 25)
    terrain_contrib = terrain_score * (1.0 - (rainfall_risk_score / 100.0))
    raw_final = rainfall_risk_score + (terrain_contrib * TERRAIN_WEIGHT)
    clamped = max(0.0, min(100.0, round(raw_final, 2)))

    if clamped >= 75.0:
        level = "Very High"
    elif clamped >= 55.0:
        level = "High"
    elif clamped >= 30.0:
        level = "Moderate"
    else:
        level = "Low"
    return clamped, level


async def evaluate_single_watchpoint(wp: dict, loader: LandslideRiskModelLoader) -> MonitoringRiskPointSchema:
    lat = wp["lat"]
    lng = wp["lng"]
    try:
        rain_task = get_rainfall_features(lat, lng)
        fc_task = get_rainfall_forecast(lat, lng, hours=72)
        terrain_task = get_terrain_features(lat, lng)

        rain_data, fc_data, terrain_data = await asyncio.gather(
            rain_task, fc_task, terrain_task, return_exceptions=True
        )

        if isinstance(rain_data, Exception) or isinstance(fc_data, Exception) or isinstance(terrain_data, Exception):
            logger.warning(f"Error evaluating watchpoint {wp['name']}: {rain_data} / {fc_data} / {terrain_data}")
            return MonitoringRiskPointSchema(
                id=wp["id"],
                latitude=lat,
                longitude=lng,
                locationName=wp["name"],
                district=wp["district"],
                currentRisk=None,
                currentRiskLevel="Insufficient Data",
                risk6h=None,
                risk6hLevel="Insufficient Data",
                risk24h=None,
                risk24hLevel="Insufficient Data",
                risk48h=None,
                risk48hLevel="Insufficient Data",
                risk72h=None,
                risk72hLevel="Insufficient Data",
                terrainSusceptibility="Moderate",
                status="insufficient_data",
                updatedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            )

        # Baseline predict
        feature_values = {
            "rainfall_1d": rain_data.get("rainfall_1d"),
            "rainfall_3d": rain_data.get("rainfall_3d"),
            "rainfall_7d": rain_data.get("rainfall_7d"),
            "rainfall_14d": rain_data.get("rainfall_14d"),
            "rainfall_30d": rain_data.get("rainfall_30d"),
        }
        pred_score, _ = loader.predict(feature_values)
        current_hybrid, current_level = calculate_hybrid_risk_score(pred_score, terrain_data.get("terrain_susceptibility", "Moderate"))

        # Projections for 6h, 24h, 48h, 72h
        fc_items = fc_data.get("forecast", []) if isinstance(fc_data, dict) else []

        def get_horizon_hybrid(hours: int) -> tuple[float | None, str, float]:
            sub_items = fc_items[:hours]
            f_total = round(sum(it.get("rainfall_mm", 0.0) or 0.0 for it in sub_items), 2)
            f_0_24 = sum(it.get("rainfall_mm", 0.0) or 0.0 for it in fc_items[:24])
            f_24_48 = sum(it.get("rainfall_mm", 0.0) or 0.0 for it in fc_items[24:48])
            f_48_72 = sum(it.get("rainfall_mm", 0.0) or 0.0 for it in fc_items[48:72])

            if hours <= 24:
                add_1d = f_total
            elif hours <= 48:
                add_1d = max(f_0_24, f_24_48)
            else:
                add_1d = max(f_0_24, f_24_48, f_48_72)

            proj_features = {
                "rainfall_1d": round((rain_data.get("rainfall_1d") or 0.0) + add_1d, 2),
                "rainfall_3d": round((rain_data.get("rainfall_3d") or 0.0) + f_total, 2),
                "rainfall_7d": round((rain_data.get("rainfall_7d") or 0.0) + f_total, 2),
                "rainfall_14d": round((rain_data.get("rainfall_14d") or 0.0) + f_total, 2),
                "rainfall_30d": round((rain_data.get("rainfall_30d") or 0.0) + f_total, 2),
            }
            h_score, _ = loader.predict(proj_features)
            h_hybrid, h_level = calculate_hybrid_risk_score(h_score, terrain_data.get("terrain_susceptibility", "Moderate"))
            return h_hybrid, h_level, f_total

        r6h, l6h, f6h = get_horizon_hybrid(6)
        r24h, l24h, f24h = get_horizon_hybrid(24)
        r48h, l48h, f48h = get_horizon_hybrid(48)
        r72h, l72h, f72h = get_horizon_hybrid(72)

        return MonitoringRiskPointSchema(
            id=wp["id"],
            latitude=lat,
            longitude=lng,
            locationName=wp["name"],
            district=wp["district"],
            currentRisk=current_hybrid,
            currentRiskLevel=current_level,
            risk6h=r6h,
            risk6hLevel=l6h,
            risk24h=r24h,
            risk24hLevel=l24h,
            risk48h=r48h,
            risk48hLevel=l48h,
            risk72h=r72h,
            risk72hLevel=l72h,
            rainfall1d=rain_data.get("rainfall_1d"),
            rainfall3d=rain_data.get("rainfall_3d"),
            rainfall7d=rain_data.get("rainfall_7d"),
            rainfall14d=rain_data.get("rainfall_14d"),
            rainfall30d=rain_data.get("rainfall_30d"),
            forecast6h=f6h,
            forecast24h=f24h,
            forecast48h=f48h,
            forecast72h=f72h,
            elevation=terrain_data.get("elevation_m"),
            slope=terrain_data.get("slope_degrees"),
            terrainSusceptibility=terrain_data.get("terrain_susceptibility", "Moderate"),
            status="success",
            updatedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        )
    except Exception as exc:
        logger.error(f"Error evaluating watchpoint {wp['name']}: {exc}")
        return MonitoringRiskPointSchema(
            id=wp["id"],
            latitude=lat,
            longitude=lng,
            locationName=wp["name"],
            district=wp["district"],
            currentRisk=None,
            currentRiskLevel="Insufficient Data",
            risk6h=None,
            risk6hLevel="Insufficient Data",
            risk24h=None,
            risk24hLevel="Insufficient Data",
            risk48h=None,
            risk48hLevel="Insufficient Data",
            risk72h=None,
            risk72hLevel="Insufficient Data",
            terrainSusceptibility="Moderate",
            status="error",
            updatedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        )


RISK_GRID_CACHE: dict = {
    "points": None,
    "timestamp": 0.0,
}


@app.get(
    "/dashboard/risk-grid",
    response_model=DashboardRiskGridResponse,
    summary="Dashboard Dynamic Risk Grid",
)
@app.get(
    "/dashboard/risk-grid/",
    response_model=DashboardRiskGridResponse,
    include_in_schema=False,
)
async def get_dashboard_risk_grid(force_refresh: bool = False):
    """
    Returns calculated current and multi-horizon landslide risk for predefined
    monitoring watchpoints across Sikkim.
    Results are cached in-memory for 5 minutes.
    """
    now = time.time()
    if not force_refresh and RISK_GRID_CACHE["points"] is not None:
        if now - RISK_GRID_CACHE["timestamp"] < 300:  # 5 minutes TTL
            return DashboardRiskGridResponse(
                total=len(RISK_GRID_CACHE["points"]),
                points=RISK_GRID_CACHE["points"],
                lastUpdated=datetime.datetime.fromtimestamp(RISK_GRID_CACHE["timestamp"], tz=datetime.timezone.utc).isoformat(),
                cached=True,
            )

    loader = get_model_loader()
    sem = asyncio.Semaphore(2)

    async def sem_eval(wp):
        async with sem:
            res = await evaluate_single_watchpoint(wp, loader)
            await asyncio.sleep(0.05)
            return res

    results = await asyncio.gather(*(sem_eval(wp) for wp in DASHBOARD_WATCHPOINTS))

    RISK_GRID_CACHE["points"] = results
    RISK_GRID_CACHE["timestamp"] = now

    return DashboardRiskGridResponse(
        total=len(results),
        points=results,
        lastUpdated=datetime.datetime.fromtimestamp(now, tz=datetime.timezone.utc).isoformat(),
        cached=False,
    )


# ---------------------------------------------------------------------------
# State Boundaries & Dynamic Risk Grid
# ---------------------------------------------------------------------------

ALL_INDIAN_STATES = [
    {"name": "Andaman & Nicobar", "code": "35", "short_name": "ANDAMAN", "lgd_code": 35},
    {"name": "Andhra Pradesh", "code": "28", "short_name": "ANDHRA PRADESH", "lgd_code": 28},
    {"name": "Arunachal Pradesh", "code": "12", "short_name": "ARUNACHAL PRADESH", "lgd_code": 12},
    {"name": "Assam", "code": "18", "short_name": "ASSAM", "lgd_code": 18},
    {"name": "Bihar", "code": "10", "short_name": "BIHAR", "lgd_code": 10},
    {"name": "Chandigarh", "code": "04", "short_name": "CHANDIGARH", "lgd_code": 4},
    {"name": "Chhattisgarh", "code": "22", "short_name": "CHHATTISGARH", "lgd_code": 22},
    {"name": "Dadra,Nagar Haveli,Daman & Diu", "code": "26", "short_name": "DADRA & NAGAR HAVELI AND DAMAN & DIU", "lgd_code": 26},
    {"name": "Delhi", "code": "07", "short_name": "DELHI", "lgd_code": 7},
    {"name": "Goa", "code": "30", "short_name": "GOA", "lgd_code": 30},
    {"name": "Gujarat", "code": "24", "short_name": "GUJARAT", "lgd_code": 24},
    {"name": "Haryana", "code": "06", "short_name": "HARYANA", "lgd_code": 6},
    {"name": "Himachal Pradesh", "code": "02", "short_name": "HIMACHAL PRADESH", "lgd_code": 2},
    {"name": "Jammu & Kashmir", "code": "01", "short_name": "JAMMU & KASHMIR", "lgd_code": 1},
    {"name": "Jharkhand", "code": "20", "short_name": "JHARKHAND", "lgd_code": 20},
    {"name": "Karnataka", "code": "29", "short_name": "KARNATAKA", "lgd_code": 29},
    {"name": "Kerala", "code": "32", "short_name": "KERALA", "lgd_code": 32},
    {"name": "Ladakh", "code": "37", "short_name": "LADAKH", "lgd_code": 37},
    {"name": "Lakshadweep", "code": "31", "short_name": "LAKSHADWEEP", "lgd_code": 31},
    {"name": "Madhya Pradesh", "code": "23", "short_name": "MADHYA PRADESH", "lgd_code": 23},
    {"name": "Maharashtra", "code": "27", "short_name": "MAHARASHTRA", "lgd_code": 27},
    {"name": "Manipur", "code": "14", "short_name": "MANIPUR", "lgd_code": 14},
    {"name": "Meghalaya", "code": "17", "short_name": "MEGHALAYA", "lgd_code": 17},
    {"name": "Mizoram", "code": "15", "short_name": "MIZORAM", "lgd_code": 15},
    {"name": "Nagaland", "code": "13", "short_name": "NAGALAND", "lgd_code": 13},
    {"name": "Odisha", "code": "21", "short_name": "ODISHA", "lgd_code": 21},
    {"name": "Puducherry", "code": "34", "short_name": "PUDUCHERRY", "lgd_code": 34},
    {"name": "Punjab", "code": "03", "short_name": "PUNJAB", "lgd_code": 3},
    {"name": "Rajasthan", "code": "08", "short_name": "RAJASTHAN", "lgd_code": 8},
    {"name": "Sikkim", "code": "11", "short_name": "SIKKIM", "lgd_code": 11},
    {"name": "Tamil Nadu", "code": "33", "short_name": "TAMIL NADU", "lgd_code": 33},
    {"name": "Telangana", "code": "36", "short_name": "TELANGANA", "lgd_code": 36},
    {"name": "Tripura", "code": "16", "short_name": "TRIPURA", "lgd_code": 16},
    {"name": "Uttar Pradesh", "code": "09", "short_name": "UTTAR PRADESH", "lgd_code": 9},
    {"name": "Uttarakhand", "code": "05", "short_name": "UTTARAKHAND", "lgd_code": 5},
    {"name": "West Bengal", "code": "19", "short_name": "WEST BENGAL", "lgd_code": 19},
]

BHARATMAPS_STATE_LAYER_URL = "https://mapservice.gov.in/gismapservice/rest/services/BharatMapService/Admin_Boundary_District/MapServer/0"
STATE_BOUNDARY_CACHE: dict[str, dict] = {}
BATCH_GRID_CACHE: dict[str, dict] = {}
STATES_LIST_CACHE: Optional[StatesListResponse] = None


@app.get("/boundaries/states", response_model=StatesListResponse, summary="Get Indian States")
@app.get("/boundaries/states/", response_model=StatesListResponse, include_in_schema=False)
async def get_states_list():
    """
    Returns list of all 36 Indian states from official BharatMaps administrative boundary service.
    Falls back to pre-configured official names if network is unreachable.
    Caches the list in-memory for instant subsequent responses.
    """
    global STATES_LIST_CACHE
    if STATES_LIST_CACHE is not None:
        return STATES_LIST_CACHE

    try:
        query_url = f"{BHARATMAPS_STATE_LAYER_URL}/query?where=1%3D1&outFields=STNAME,STCODE11,STNAME_SH,State_LGD&returnGeometry=false&returnDistinctValues=true&orderByFields=STNAME&f=pjson"
        async with httpx.AsyncClient(verify=False, timeout=6.0) as client:
            resp = await client.get(query_url)
            if resp.status_code == 200:
                data = resp.json()
                features = data.get("features", [])
                if features:
                    parsed_states = []
                    for f in features:
                        attrs = f.get("attributes", {})
                        name = attrs.get("STNAME")
                        if name:
                            parsed_states.append(
                                StateInfo(
                                    name=name,
                                    code=attrs.get("STCODE11"),
                                    short_name=attrs.get("STNAME_SH"),
                                    lgd_code=attrs.get("State_LGD"),
                                )
                            )
                    if parsed_states:
                        STATES_LIST_CACHE = StatesListResponse(total=len(parsed_states), states=parsed_states, source="BharatMaps")
                        return STATES_LIST_CACHE
    except Exception as exc:
        logger.warning(f"Unable to reach BharatMaps directly for states list ({exc}), using fallback registry.")

    fallback_list = [
        StateInfo(
            name=s["name"],
            code=s["code"],
            short_name=s["short_name"],
            lgd_code=s["lgd_code"],
        )
        for s in ALL_INDIAN_STATES
    ]
    STATES_LIST_CACHE = StatesListResponse(total=len(fallback_list), states=fallback_list, source="BharatMaps Registry")
    return STATES_LIST_CACHE


@app.get("/boundaries/state", response_model=StateBoundaryResponse, summary="Get State GeoJSON Boundary")
@app.get("/boundaries/state/", response_model=StateBoundaryResponse, include_in_schema=False)
async def get_state_boundary(name: str = Query(..., description="Indian state name (e.g. 'Sikkim', 'West Bengal')")):
    """
    Retrieves the official GeoJSON boundary feature for the specified Indian state from BharatMaps.
    Caches responses in-memory for instant retrieval.
    """
    cache_key = name.strip().lower()
    if cache_key in STATE_BOUNDARY_CACHE:
        return STATE_BOUNDARY_CACHE[cache_key]

    matched_name = name
    for s in ALL_INDIAN_STATES:
        if s["name"].lower() == cache_key:
            matched_name = s["name"]
            break

    query_url = f"{BHARATMAPS_STATE_LAYER_URL}/query?where=STNAME%20%3D%20'{matched_name}'&outFields=STNAME,STCODE11,STNAME_SH,State_LGD&outSR=4326&f=geojson"
    try:
        async with httpx.AsyncClient(verify=False, timeout=12.0) as client:
            resp = await client.get(query_url)
            if resp.status_code == 200:
                data = resp.json()
                features = data.get("features", [])
                if features and len(features) > 0:
                    feat = features[0]
                    result = StateBoundaryResponse(
                        type="Feature",
                        properties=feat.get("properties", {"STNAME": matched_name}),
                        geometry=feat.get("geometry", {}),
                        source="BharatMaps",
                    )
                    STATE_BOUNDARY_CACHE[cache_key] = result
                    return result
    except Exception as exc:
        logger.error(f"Error fetching state boundary from BharatMaps for {name}: {exc}")

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Official state boundary polygon for '{name}' could not be retrieved from BharatMaps service.",
    )


# Canonical 8 North Eastern Region (NER) States - SIH Problem Statement 26001
NER_STATES = [
    "Arunachal Pradesh",
    "Assam",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Sikkim",
    "Tripura",
]
NER_STATES_SET = {s.lower() for s in NER_STATES}


@app.post("/risk/grid", response_model=RiskGridBatchResponse, summary="Batch Calculate Risk Grid")
@app.post("/risk/grid/", response_model=RiskGridBatchResponse, include_in_schema=False)
async def calculate_risk_grid_batch(
    req: RiskGridBatchRequest,
    state: Optional[str] = Query(None, description="Optional target state name"),
):
    """
    Batch endpoint to calculate hybrid landslide risk for a list of coordinates.
    Restricted strictly to the 8 North Eastern Region (NER) states (SIH 26001).
    Leverages vectorized model inference, native multi-coordinate weather queries,
    neighborhood batch terrain calculations, and 20-minute in-memory caching.
    """
    # Enforce North Eastern Region (NER) scope
    target_state = req.state_name or state
    if not target_state and req.points:
        for pt in req.points:
            if pt.name:
                for st in ALL_INDIAN_STATES:
                    if pt.name.startswith(st["name"]):
                        target_state = st["name"]
                        break
            if target_state:
                break

    if target_state and target_state.strip().lower() not in NER_STATES_SET:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="State is outside the North Eastern Region scope.",
        )

    loader = get_model_loader()
    now = time.time()
    n_points = len(req.points)
    results: list[Optional[RiskGridPointResult]] = [None] * n_points

    uncached_indices: list[int] = []
    uncached_coords: list[tuple[float, float]] = []

    for idx, coord in enumerate(req.points):
        lat = round(coord.latitude, 4)
        lng = round(coord.longitude, 4)
        ckey = f"{lat:.4f}_{lng:.4f}"

        if not req.force_refresh and ckey in BATCH_GRID_CACHE:
            entry = BATCH_GRID_CACHE[ckey]
            if now - entry["ts"] < 1200:  # 20 minutes
                cached_res = entry["data"]
                if coord.name and cached_res.location_name != coord.name:
                    cached_res = cached_res.model_copy(update={"location_name": coord.name})
                results[idx] = cached_res
                continue

        uncached_indices.append(idx)
        uncached_coords.append((lat, lng))

    if uncached_coords:
        # Concurrently fetch batch rainfall features and batch terrain features
        rain_batch, terrain_batch = await asyncio.gather(
            get_rainfall_features_batch(uncached_coords),
            get_terrain_features_batch(uncached_coords),
            return_exceptions=True,
        )

        if isinstance(rain_batch, Exception):
            logger.error(f"Error in batch rainfall retrieval: {rain_batch}")
            rain_batch = [None] * len(uncached_coords)
        if isinstance(terrain_batch, Exception):
            logger.error(f"Error in batch terrain retrieval: {terrain_batch}")
            terrain_batch = [None] * len(uncached_coords)

        # Prepare feature dicts for ML prediction batch
        valid_ml_indices: list[int] = []
        ml_features_list: list[dict] = []

        for i, (lat, lng) in enumerate(uncached_coords):
            rain_data = rain_batch[i] if i < len(rain_batch) else None
            terrain_data = terrain_batch[i] if i < len(terrain_batch) else None

            if not isinstance(rain_data, dict) or not isinstance(terrain_data, dict):
                continue

            valid_ml_indices.append(i)
            ml_features_list.append({
                "rainfall_1d": rain_data.get("rainfall_1d"),
                "rainfall_3d": rain_data.get("rainfall_3d"),
                "rainfall_7d": rain_data.get("rainfall_7d"),
                "rainfall_14d": rain_data.get("rainfall_14d"),
                "rainfall_30d": rain_data.get("rainfall_30d"),
            })

        # Run vectorized ML batch prediction
        pred_scores: list[tuple[float | None, str]] = []
        if ml_features_list:
            try:
                pred_scores = loader.predict_batch(ml_features_list)
            except Exception as e:
                logger.error(f"Batch ML prediction failed: {e}")
                pred_scores = [(None, "Model error")] * len(ml_features_list)

        ml_pred_map: dict[int, float | None] = {}
        for idx_pos, uncached_pos in enumerate(valid_ml_indices):
            ml_pred_map[uncached_pos] = pred_scores[idx_pos][0] if idx_pos < len(pred_scores) else None

        # Build results for each uncached coordinate
        for i, (lat, lng) in enumerate(uncached_coords):
            orig_idx = uncached_indices[i]
            coord = req.points[orig_idx]
            ckey = f"{lat:.4f}_{lng:.4f}"

            rain_data = rain_batch[i] if i < len(rain_batch) else None
            terrain_data = terrain_batch[i] if i < len(terrain_batch) else None

            if (
                not isinstance(rain_data, dict)
                or not isinstance(terrain_data, dict)
                or i not in ml_pred_map
                or ml_pred_map[i] is None
            ):
                res = RiskGridPointResult(
                    latitude=lat,
                    longitude=lng,
                    location_name=coord.name,
                    risk_score=None,
                    risk_level="Insufficient Data",
                    status="error",
                )
                results[orig_idx] = res
                continue

            pred_score = ml_pred_map[i]
            susceptibility = terrain_data.get("terrain_susceptibility", "Moderate")
            hybrid_score, _ = calculate_hybrid_risk_score(pred_score, susceptibility)

            if hybrid_score is None:
                lvl = "Insufficient Data"
            elif hybrid_score >= 80.0:
                lvl = "Very High"
            elif hybrid_score >= 60.0:
                lvl = "High"
            elif hybrid_score >= 40.0:
                lvl = "Moderate"
            else:
                lvl = "Low"

            res = RiskGridPointResult(
                latitude=lat,
                longitude=lng,
                location_name=coord.name,
                risk_score=hybrid_score,
                risk_level=lvl,
                rainfall_risk_score=pred_score,
                terrain_score=TERRAIN_SUSCEPTIBILITY_SCORES.get(susceptibility, 25),
                terrain_susceptibility=susceptibility,
                elevation=terrain_data.get("elevation_m"),
                slope=terrain_data.get("slope_degrees"),
                rainfall_7d=rain_data.get("rainfall_7d"),
                status="success",
            )

            BATCH_GRID_CACHE[ckey] = {"data": res, "ts": now}
            results[orig_idx] = res

    final_results = [r for r in results if r is not None]

    return RiskGridBatchResponse(
        total=len(final_results),
        results=final_results,
        cached=len(uncached_coords) == 0,
        timestamp=datetime.datetime.fromtimestamp(now, tz=datetime.timezone.utc).isoformat(),
    )


# ---------------------------------------------------------------------------
# Field Reporting & Geo-Tagging Service
# ---------------------------------------------------------------------------

INITIAL_FIELD_REPORTS: list[dict] = [
    {
        "id": "fr-sih-01",
        "latitude": 27.6025,
        "longitude": 88.6475,
        "timestamp": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=4)).isoformat(),
        "category": "Slope Crack",
        "severity": "Critical",
        "description": "Deep transverse fissure opening along upslope embankment near Chungthang. Progressive tension gap widening after heavy 48-hour rainfall. Imminent slope failure risk above highway.",
        "photo": None,
        "reporter_name": "PWD Engineer - Sub-Division Chungthang",
        "status": "REVIEWED",
        "district": "Mangan",
        "state": "Sikkim",
        "elevation": 1780.0,
        "slope": 38.5,
        "reviewed_at": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=2)).isoformat(),
        "resolved_at": None,
    },
    {
        "id": "fr-sih-02",
        "latitude": 27.408,
        "longitude": 88.528,
        "timestamp": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=12)).isoformat(),
        "category": "Road Blockage",
        "severity": "High",
        "description": "Debris slide blocking both lanes on Dikchu link road. Mud slurry and dislodged boulders covering 30 meters of carriageway. Heavy earth-moving equipment mobilized.",
        "photo": None,
        "reporter_name": "Ward Disaster Management Volunteer - Dikchu",
        "status": "SUBMITTED",
        "district": "Mangan",
        "state": "Sikkim",
        "elevation": 820.0,
        "slope": 31.2,
        "reviewed_at": None,
        "resolved_at": None,
    },
    {
        "id": "fr-sih-03",
        "latitude": 27.5074,
        "longitude": 88.5222,
        "timestamp": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=26)).isoformat(),
        "category": "Rockfall",
        "severity": "Moderate",
        "description": "Intermittent rock dislodgement from upper basalt face above bypass road. Protective wire mesh damaged in two sections. Light vehicles advised caution.",
        "photo": None,
        "reporter_name": "BRO Field Patrol Unit",
        "status": "SUBMITTED",
        "district": "Mangan",
        "state": "Sikkim",
        "elevation": 1250.0,
        "slope": 42.0,
        "reviewed_at": None,
        "resolved_at": None,
    },
    {
        "id": "fr-sih-04",
        "latitude": 27.3389,
        "longitude": 88.6065,
        "timestamp": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=50)).isoformat(),
        "category": "Landslide",
        "severity": "High",
        "description": "Active rotational earth slip behind residential retaining structure in Gangtok Development Area. Surface drainage diverted and containment gabions deployed.",
        "photo": None,
        "reporter_name": "Urban Development Inspection Team",
        "status": "RESOLVED",
        "district": "Gangtok",
        "state": "Sikkim",
        "elevation": 1650.0,
        "slope": 28.5,
        "reviewed_at": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=36)).isoformat(),
        "resolved_at": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=10)).isoformat(),
    },
]

FIELD_REPORTS_STORE: list[dict] = [dict(r) for r in INITIAL_FIELD_REPORTS]


@app.get(
    "/field-reports",
    response_model=list[FieldReportResponse],
    summary="List all geo-tagged field reports with optional filters",
)
async def list_field_reports(
    status: Optional[str] = Query(None, description="Filter by status (SUBMITTED, REVIEWED, RESOLVED)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    district: Optional[str] = Query(None, description="Filter by district"),
):
    results = FIELD_REPORTS_STORE
    if status:
        results = [r for r in results if r.get("status", "").upper() == status.upper()]
    if category:
        results = [r for r in results if r.get("category", "").lower() == category.lower()]
    if district:
        results = [r for r in results if r.get("district", "").lower() == district.lower()]
    return results


@app.post(
    "/field-reports",
    response_model=FieldReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new geo-tagged field observation",
)
async def create_field_report(req: FieldReportCreateRequest):
    elevation = None
    slope = None
    try:
        t_data = await get_terrain_features(req.latitude, req.longitude)
        if isinstance(t_data, dict):
            elevation = t_data.get("elevation_m")
            slope = t_data.get("slope_degrees")
    except Exception as e:
        logger.warning(f"Could not auto-enrich terrain for report ({req.latitude}, {req.longitude}): {e}")

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    new_report = {
        "id": f"fr-{int(time.time() * 1000)}",
        "latitude": round(req.latitude, 5),
        "longitude": round(req.longitude, 5),
        "timestamp": now_iso,
        "category": req.category,
        "severity": req.severity,
        "description": req.description,
        "photo": req.photo,
        "reporter_name": req.reporter_name or "Anonymous Field Officer",
        "status": "SUBMITTED",
        "district": req.district or "Mangan",
        "state": req.state or "Sikkim",
        "elevation": elevation,
        "slope": slope,
        "reviewed_at": None,
        "resolved_at": None,
    }
    FIELD_REPORTS_STORE.insert(0, new_report)
    return new_report


@app.patch(
    "/field-reports/{report_id}/status",
    response_model=FieldReportResponse,
    summary="Update the status of a field report",
)
async def update_field_report_status_endpoint(
    report_id: str,
    req: FieldReportStatusUpdateRequest,
):
    for r in FIELD_REPORTS_STORE:
        if r["id"] == report_id:
            r["status"] = req.status
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
            if req.status == "REVIEWED":
                r["reviewed_at"] = now_iso
            elif req.status == "RESOLVED":
                r["resolved_at"] = now_iso
            return r
    raise HTTPException(status_code=404, detail=f"Field report '{report_id}' not found")


@app.delete(
    "/field-reports/{report_id}",
    summary="Delete a field report",
)
async def delete_field_report_endpoint(report_id: str):
    global FIELD_REPORTS_STORE
    initial_len = len(FIELD_REPORTS_STORE)
    FIELD_REPORTS_STORE = [r for r in FIELD_REPORTS_STORE if r["id"] != report_id]
    if len(FIELD_REPORTS_STORE) == initial_len:
        raise HTTPException(status_code=404, detail=f"Field report '{report_id}' not found")
    return {"status": "success", "deleted_id": report_id}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.service:app", host="127.0.0.1", port=8000, reload=False)




