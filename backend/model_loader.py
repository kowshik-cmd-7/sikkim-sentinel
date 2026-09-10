"""
Safe singleton model loader and inference engine for the Landslide Risk Model.
Loads the scikit-learn GradientBoostingRegressor pipeline artifact once on startup.
"""

from pathlib import Path
import sys
from typing import Dict, List, Optional, Tuple, Union
import joblib
import numpy as np
import pandas as pd

# The exact 5 features expected by the trained pipeline
REQUIRED_FEATURES: List[str] = [
    "rainfall_1d",
    "rainfall_3d",
    "rainfall_7d",
    "rainfall_14d",
    "rainfall_30d",
]


def classify_risk_score(score: float) -> str:
    """
    Classifies a continuous risk score into categorical risk levels based on project thresholds:
      0 <= score < 30  : Low
      30 <= score < 55 : Moderate
      55 <= score < 75 : High
      score >= 75      : Very High
    """
    if score >= 75.0:
        return "Very High"
    elif score >= 55.0:
        return "High"
    elif score >= 30.0:
        return "Moderate"
    else:
        return "Low"


class LandslideRiskModelLoader:
    _instance: Optional["LandslideRiskModelLoader"] = None

    def __init__(self, model_path: Optional[Union[str, Path]] = None):
        if model_path is None:
            base_dir = Path(__file__).resolve().parent
            self.model_path = base_dir / "model" / "final_landslide_risk_model.joblib"
        else:
            self.model_path = Path(model_path)

        self.model = None
        self.is_loaded = False
        self._load_model()

    @classmethod
    def get_instance(
        cls, model_path: Optional[Union[str, Path]] = None
    ) -> "LandslideRiskModelLoader":
        """Returns the singleton instance of the model loader."""
        if cls._instance is None:
            cls._instance = cls(model_path)
        return cls._instance

    def _load_model(self):
        """
        Loads the joblib pipeline with cross-version scikit-learn compatibility handling.
        Does not retrain, modify, or convert the model artifact.
        """
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"Model artifact not found at: {self.model_path.resolve()}. "
                "Ensure final_landslide_risk_model.joblib is placed in backend/model/"
            )

        # Ensure compatibility with pickled loss functions across scikit-learn versions
        try:
            import sklearn._loss._loss
            if "_loss" not in sys.modules:
                sys.modules["_loss"] = sklearn._loss._loss
        except Exception:
            pass

        try:
            self.model = joblib.load(self.model_path)
        except Exception as exc:
            raise RuntimeError(
                f"Failed to load joblib model from {self.model_path}: {exc}"
            ) from exc

        # Compatibility handling for SimpleImputer._fill_dtype on newer scikit-learn
        imputer = getattr(self.model, "named_steps", {}).get("imputer", None)
        if imputer is not None:
            if hasattr(imputer, "strategy") and not hasattr(imputer, "_fill_dtype") and hasattr(imputer, "_fit_dtype"):
                imputer._fill_dtype = imputer._fit_dtype

        self.is_loaded = True

    def predict(self, rainfall_features: Dict[str, float]) -> Tuple[float, str]:
        """
        Executes inference for a single input record with all 5 features.

        Args:
            rainfall_features: Dictionary containing rainfall_1d, rainfall_3d,
                               rainfall_7d, rainfall_14d, rainfall_30d.

        Returns:
            Tuple of (risk_score, risk_level)
        """
        if not self.is_loaded or self.model is None:
            raise RuntimeError("Model is not loaded. Call _load_model() first.")

        # Ensure all 5 features are provided
        for feat in REQUIRED_FEATURES:
            if feat not in rainfall_features or rainfall_features[feat] is None:
                raise ValueError(f"Missing required feature for prediction: '{feat}'")

        # Build single-row DataFrame with exact feature order
        row = {feat: float(rainfall_features[feat]) for feat in REQUIRED_FEATURES}
        df = pd.DataFrame([row])[REQUIRED_FEATURES]

        # Predict using unchanged scikit-learn pipeline
        raw_pred = self.model.predict(df)[0]
        risk_score = round(float(raw_pred), 2)
        # Ensure score bounds remain within valid physical domain (>= 0)
        risk_score = max(0.0, risk_score)
        risk_level = classify_risk_score(risk_score)

        return risk_score, risk_level
