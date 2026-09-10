"""
Unit and integration test suite for the Landslide Risk Prediction FastAPI service.
Tests /health, /predict, known benchmark cases, edge cases, and validation rules.
"""

from fastapi.testclient import TestClient
from backend.service import app


def test_health_endpoint():
    """Verify that /health returns ok and confirms model is loaded."""
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["model_loaded"] is True
        assert data["algorithm"] == "GradientBoostingRegressor"
        assert "rainfall_7d" in data["required_features"]
        print("\n[PASS] /health endpoint verified successfully.")


def test_very_high_risk_benchmark():
    """
    CRITICAL BENCHMARK VALIDATION:
    Input from the known Very High-risk record:
      rainfall_1d = 54.635
      rainfall_3d = 211.665
      rainfall_7d = 551.320
      rainfall_14d = 901.840
      rainfall_30d = 1123.085
    Expected: approximately 79.43 risk score, categorized as Very High.
    """
    with TestClient(app) as client:
        payload = {
            "rainfall_1d": 54.635,
            "rainfall_3d": 211.665,
            "rainfall_7d": 551.320,
            "rainfall_14d": 901.840,
            "rainfall_30d": 1123.085,
        }
        response = client.post("/predict", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["risk_level"] == "Very High"
        assert 75.0 <= data["risk_score"] <= 85.0
        print(
            f"\n[PASS] Known Very High test: score = {data['risk_score']} (expected ~79.43), level = '{data['risk_level']}'"
        )


def test_valid_low_risk():
    """Verify that a low-rainfall scenario produces Low risk (< 30)."""
    with TestClient(app) as client:
        payload = {
            "rainfall_1d": 2.09,
            "rainfall_3d": 21.92,
            "rainfall_7d": 68.23,
            "rainfall_14d": 229.85,
            "rainfall_30d": 278.52,
        }
        response = client.post("/predict", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["risk_level"] == "Low"
        assert 0 <= data["risk_score"] < 30.0
        print(f"\n[PASS] Valid Low risk test: score = {data['risk_score']}, level = '{data['risk_level']}'")


def test_valid_moderate_and_high_risk():
    """Verify Moderate (30-55) and High (55-75) risk predictions."""
    with TestClient(app) as client:
        # 1. Moderate risk dataset record
        mod_payload = {
            "rainfall_1d": 45.55,
            "rainfall_3d": 103.56,
            "rainfall_7d": 196.08,
            "rainfall_14d": 285.44,
            "rainfall_30d": 466.19,
        }
        mod_res = client.post("/predict", json=mod_payload)
        assert mod_res.status_code == 200
        mod_data = mod_res.json()
        assert mod_data["status"] == "success"
        assert mod_data["risk_level"] == "Moderate"
        assert 30.0 <= mod_data["risk_score"] < 55.0
        print(f"\n[PASS] Valid Moderate risk test: score = {mod_data['risk_score']}, level = '{mod_data['risk_level']}'")

        # 2. High risk dataset record
        high_payload = {
            "rainfall_1d": 126.22,
            "rainfall_3d": 213.72,
            "rainfall_7d": 382.01,
            "rainfall_14d": 417.34,
            "rainfall_30d": 616.85,
        }
        high_res = client.post("/predict", json=high_payload)
        assert high_res.status_code == 200
        high_data = high_res.json()
        assert high_data["status"] == "success"
        assert high_data["risk_level"] == "High"
        assert 55.0 <= high_data["risk_score"] < 75.0
        print(f"\n[PASS] Valid High risk test: score = {high_data['risk_score']}, level = '{high_data['risk_level']}'")


def test_insufficient_data_handling():
    """Verify that missing/null rainfall parameters return Insufficient Data without fabricated values."""
    with TestClient(app) as client:
        # Case A: Partial missing (7d missing)
        payload_partial = {
            "rainfall_1d": 54.635,
            "rainfall_3d": 211.665,
            "rainfall_7d": None,
            "rainfall_14d": 901.840,
            "rainfall_30d": 1123.085,
        }
        res_a = client.post("/predict", json=payload_partial)
        assert res_a.status_code == 200
        data_a = res_a.json()
        assert data_a["status"] == "insufficient_data"
        assert data_a["risk_score"] is None
        assert data_a["risk_level"] == "Insufficient Data"

        # Case B: All null
        payload_all_null = {
            "rainfall_1d": None,
            "rainfall_3d": None,
            "rainfall_7d": None,
            "rainfall_14d": None,
            "rainfall_30d": None,
        }
        res_b = client.post("/predict", json=payload_all_null)
        assert res_b.status_code == 200
        data_b = res_b.json()
        assert data_b["status"] == "insufficient_data"
        assert data_b["risk_score"] is None
        assert data_b["risk_level"] == "Insufficient Data"

        # Case C: Empty JSON payload
        res_c = client.post("/predict", json={})
        assert res_c.status_code == 200
        data_c = res_c.json()
        assert data_c["status"] == "insufficient_data"
        assert data_c["risk_score"] is None
        assert data_c["risk_level"] == "Insufficient Data"

        print("\n[PASS] Insufficient Data handling verified across partial, all-null, and empty requests.")


def test_validation_negative_rainfall():
    """Verify that invalid/negative numbers are rejected with 422 Unprocessable Entity."""
    with TestClient(app) as client:
        payload = {
            "rainfall_1d": -10.0,
            "rainfall_3d": 20.0,
            "rainfall_7d": 50.0,
            "rainfall_14d": 100.0,
            "rainfall_30d": 200.0,
        }
        response = client.post("/predict", json=payload)
        assert response.status_code == 422
        print("\n[PASS] Negative rainfall validation rejected with HTTP 422.")


if __name__ == "__main__":
    test_health_endpoint()
    test_very_high_risk_benchmark()
    test_valid_low_risk()
    test_valid_moderate_and_high_risk()
    test_insufficient_data_handling()
    test_validation_negative_rainfall()
    print("\n[SUCCESS] All Phase 1 tests passed successfully!")
