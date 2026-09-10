"""
FastAPI REST Service for Landslide Risk Prediction (Phase 1).
Exposes /health and /predict endpoints backed by the GradientBoostingRegressor model.
"""

from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from backend.model_loader import LandslideRiskModelLoader, REQUIRED_FEATURES
from backend.schemas import HealthResponse, RainfallInput, RiskPredictionResponse

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.service:app", host="127.0.0.1", port=8000, reload=False)
