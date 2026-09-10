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


def test_weather_rainfall_endpoint():
    """Verify that GET /weather/rainfall returns all 5 required rainfall lag features."""
    with TestClient(app) as client:
        response = client.get("/weather/rainfall?latitude=27.8174&longitude=88.4778")
        assert response.status_code == 200
        data = response.json()
        assert "rainfall_1d" in data
        assert "rainfall_3d" in data
        assert "rainfall_7d" in data
        assert "rainfall_14d" in data
        assert "rainfall_30d" in data
        assert all(isinstance(data[k], (int, float)) for k in ["rainfall_1d", "rainfall_3d", "rainfall_7d", "rainfall_14d", "rainfall_30d"])
        print("\n[PASS] /weather/rainfall endpoint verified successfully.")


def test_weather_forecast_endpoint():
    """Verify that GET /weather/forecast returns hourly items and summary totals."""
    with TestClient(app) as client:
        response = client.get("/weather/forecast?latitude=27.8174&longitude=88.4778&hours=72")
        assert response.status_code == 200
        data = response.json()
        assert "forecast" in data
        assert len(data["forecast"]) > 0
        assert "total_rainfall_mm" in data
        assert "max_hourly_rainfall_mm" in data
        print("\n[PASS] /weather/forecast endpoint verified successfully.")


def test_terrain_endpoint_valid():
    """Verify that GET /terrain returns elevation, slope degrees, category, and susceptibility."""
    with TestClient(app) as client:
        response = client.get("/terrain?latitude=27.8174&longitude=88.4778")
        assert response.status_code == 200
        data = response.json()
        assert "elevation_m" in data
        assert isinstance(data["elevation_m"], (int, float))
        assert "slope_degrees" in data
        assert isinstance(data["slope_degrees"], (int, float))
        assert data["slope_category"] in ["Flat", "Moderate", "Steep", "Very Steep"]
        assert any(s in data["data_source"] for s in ["Open-Meteo", "Open-Elevation", "DEM"])
        print(f"\n[PASS] /terrain valid test: elevation={data['elevation_m']}m, slope={data['slope_degrees']}deg ({data['slope_category']}) from {data['data_source']}")


def test_terrain_endpoint_invalid():
    """Verify that GET /terrain with out-of-bounds coordinates is rejected with HTTP 422."""
    with TestClient(app) as client:
        response = client.get("/terrain?latitude=999&longitude=999")
        assert response.status_code == 422
        print("\n[PASS] /terrain invalid coordinates rejected with HTTP 422.")


def test_nearby_facilities_endpoint():
    """Verify that GET /alerts/nearby returns prioritized facilities sorted by proximity."""
    with TestClient(app) as client:
        response = client.get("/alerts/nearby?latitude=27.3314&longitude=88.6138&radius_km=10")
        assert response.status_code == 200
        data = response.json()
        assert "facilities" in data
        assert data["count"] > 0
        assert data["radius_km"] == 10.0
        # Check facility structure
        first = data["facilities"][0]
        assert "name" in first
        assert "type" in first
        assert "contact" in first
        assert "distance_km" in first
        assert first["distance_km"] <= 10.0
        # Verify authorities take top priority
        types = [f["type"] for f in data["facilities"]]
        assert "authority" in types
        print(f"\n[PASS] /alerts/nearby endpoint: found {data['count']} facilities near Gangtok. Closest: {first['name']} ({first['distance_km']}km)")


def test_dashboard_alerts_endpoints():
    """Verify that /alerts CRUD and workflow transitions work correctly."""
    with TestClient(app) as client:
        # 1. Create an alert
        payload = {
            "id": "alert-test-001",
            "severity": "VERY_HIGH",
            "status": "ACTIVE",
            "notificationStatus": "NOT_SENT",
            "latitude": 27.8174,
            "longitude": 88.4778,
            "locationLabel": "Sikkim — Mangan Test Sector",
            "horizon": "6H",
            "riskScore": 84.5,
            "riskLevel": "Very High",
            "rainfallRiskScore": 78.0,
            "terrainScore": 90.0,
            "terrainSusceptibility": "Very High",
            "terrainContribution": 18.5,
            "finalRiskScore": 84.5,
            "finalRiskLevel": "Very High",
            "rainfall": 42.0,
            "radiusKm": 5.0,
            "message": "VERY HIGH LANDSLIDE RISK detected in Mangan test sector.",
            "createdAt": "2026-09-10T12:00:00Z",
        }
        res_create = client.post("/alerts", json=payload)
        assert res_create.status_code == 200
        assert res_create.json()["success"] is True

        # 2. List alerts
        res_list = client.get("/alerts")
        assert res_list.status_code == 200
        alerts = res_list.json()
        assert len(alerts) >= 1
        found = next((a for a in alerts if a["id"] == "alert-test-001"), None)
        assert found is not None
        assert found["status"] == "ACTIVE"

        # 3. Send alert
        res_send = client.post("/alerts/alert-test-001/send")
        assert res_send.status_code == 200
        assert res_send.json()["status"] == "SENT"
        assert res_send.json()["alert"]["sentAt"] is not None

        # 4. Acknowledge alert
        res_ack = client.post("/alerts/alert-test-001/acknowledge")
        assert res_ack.status_code == 200
        assert res_ack.json()["status"] == "ACKNOWLEDGED"
        assert res_ack.json()["alert"]["acknowledgedAt"] is not None

        # 5. Resolve alert
        res_res = client.post("/alerts/alert-test-001/resolve")
        assert res_res.status_code == 200
        assert res_res.json()["status"] == "RESOLVED"
        assert res_res.json()["alert"]["resolvedAt"] is not None
        print("\n[PASS] /alerts workflow: CREATE -> SEND -> ACKNOWLEDGE -> RESOLVE verified successfully.")


def test_dashboard_risk_grid_endpoint():
    """Verifies that /dashboard/risk-grid returns calculated monitoring points."""
    with TestClient(app) as client:
        res = client.get("/dashboard/risk-grid")
        assert res.status_code == 200
        data = res.json()
        assert "total" in data
        assert "points" in data
        assert data["total"] > 0
        points = data["points"]
        assert len(points) == data["total"]

        # Check first point structure
        p0 = points[0]
        assert "id" in p0
        assert "locationName" in p0
        assert "district" in p0
        assert "currentRisk" in p0
        assert "currentRiskLevel" in p0
        assert "risk6h" in p0
        assert "risk24h" in p0
        assert "risk48h" in p0
        assert "risk72h" in p0
        assert "elevation" in p0
        assert "slope" in p0
        assert "terrainSusceptibility" in p0
        print(f"\n[PASS] /dashboard/risk-grid: returned {data['total']} points. First point: {p0['locationName']} (Risk: {p0['currentRisk']}, Level: {p0['currentRiskLevel']})")


def test_boundaries_states_endpoint():
    """Verify GET /boundaries/states returns the 36 Indian states."""
    with TestClient(app) as client:
        res = client.get("/boundaries/states")
        assert res.status_code == 200
        data = res.json()
        assert "total" in data
        assert "states" in data
        assert data["total"] == 36
        assert len(data["states"]) == 36
        state_names = [s["name"] for s in data["states"]]
        assert "Sikkim" in state_names
        assert "West Bengal" in state_names
        assert "Himachal Pradesh" in state_names
        assert "Uttarakhand" in state_names
        print(f"\n[PASS] /boundaries/states: successfully returned {data['total']} states.")


def test_boundaries_state_sikkim_endpoint():
    """Verify GET /boundaries/state?name=Sikkim returns valid GeoJSON polygon."""
    with TestClient(app) as client:
        res = client.get("/boundaries/state?name=Sikkim")
        assert res.status_code == 200
        data = res.json()
        assert data["type"] == "Feature"
        assert "properties" in data
        assert "geometry" in data
        assert data["geometry"]["type"] in ["Polygon", "MultiPolygon"]
        assert len(data["geometry"]["coordinates"]) > 0
        print(f"\n[PASS] /boundaries/state?name=Sikkim: successfully returned GeoJSON {data['geometry']['type']}.")


def test_risk_grid_batch_endpoint():
    """Verify POST /risk/grid calculates hybrid risk for coordinates."""
    with TestClient(app) as client:
        payload = {
            "points": [
                {"latitude": 27.8174, "longitude": 88.4778, "name": "Mangan Ridge"},
                {"latitude": 27.33, "longitude": 88.61, "name": "Gangtok Center"},
            ],
            "force_refresh": False,
        }
        res = client.post("/risk/grid", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 2
        assert len(data["results"]) == 2
        r0 = data["results"][0]
        assert "risk_score" in r0
        assert "risk_level" in r0
        print(f"\n[PASS] POST /risk/grid: successfully evaluated {data['total']} sample points. First risk: {r0['risk_score']} ({r0['risk_level']}).")


def test_risk_grid_rejects_non_ner_state():
    """Verify POST /risk/grid rejects states outside the North Eastern Region scope with HTTP 400."""
    with TestClient(app) as client:
        # 1. Reject via explicit state_name
        payload_explicit = {
            "points": [{"latitude": 27.03, "longitude": 88.26, "name": "Point 1"}],
            "state_name": "West Bengal",
        }
        res = client.post("/risk/grid", json=payload_explicit)
        assert res.status_code == 400
        assert res.json()["detail"] == "State is outside the North Eastern Region scope."

        # 2. Reject via point name prefix
        payload_point_name = {
            "points": [{"latitude": 27.03, "longitude": 88.26, "name": "West Bengal (27.03°N, 88.26°E)"}],
        }
        res2 = client.post("/risk/grid", json=payload_point_name)
        assert res2.status_code == 400
        assert res2.json()["detail"] == "State is outside the North Eastern Region scope."

        # 3. Reject other non-NER states (e.g. Bihar, Maharashtra)
        res3 = client.post("/risk/grid", json={"points": [{"latitude": 25.0, "longitude": 85.0}], "state_name": "Bihar"})
        assert res3.status_code == 400

        # 4. Accept valid NER state (e.g. Sikkim, Assam, Arunachal Pradesh)
        payload_ner = {
            "points": [{"latitude": 27.33, "longitude": 88.61, "name": "Sikkim (27.33°N, 88.61°E)"}],
            "state_name": "Sikkim",
        }
        res_ner = client.post("/risk/grid", json=payload_ner)
        assert res_ner.status_code == 200
        print("\n[PASS] POST /risk/grid: successfully verified rejection of non-NER states and acceptance of NER states.")


def test_field_reports_crud():
    """Verify GET, POST, PATCH, DELETE for /field-reports."""
    with TestClient(app) as client:
        # 1. GET list
        res = client.get("/field-reports")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) >= 4
        print(f"\n[PASS] GET /field-reports returned {len(data)} seeded reports.")

        # 2. POST create
        new_report = {
            "latitude": 27.408,
            "longitude": 88.528,
            "category": "Slope Crack",
            "severity": "Critical",
            "description": "Active ground fissure extending 20 meters across roadway.",
            "reporter_name": "Test Officer",
            "district": "Mangan",
        }
        post_res = client.post("/field-reports", json=new_report)
        assert post_res.status_code == 201
        created = post_res.json()
        assert created["category"] == "Slope Crack"
        assert created["severity"] == "Critical"
        assert created["status"] == "SUBMITTED"
        report_id = created["id"]
        print(f"[PASS] POST /field-reports successfully created report {report_id}.")

        # 3. PATCH status
        patch_res = client.patch(f"/field-reports/{report_id}/status", json={"status": "REVIEWED"})
        assert patch_res.status_code == 200
        updated = patch_res.json()
        assert updated["status"] == "REVIEWED"
        assert updated["reviewed_at"] is not None
        print(f"[PASS] PATCH /field-reports/{report_id}/status updated to REVIEWED.")

        # 4. DELETE report
        del_res = client.delete(f"/field-reports/{report_id}")
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "success"
        print(f"[PASS] DELETE /field-reports/{report_id} successfully deleted.")


if __name__ == "__main__":
    test_health_endpoint()
    test_very_high_risk_benchmark()
    test_valid_low_risk()
    test_valid_moderate_and_high_risk()
    test_insufficient_data_handling()
    test_validation_negative_rainfall()
    test_weather_rainfall_endpoint()
    test_weather_forecast_endpoint()
    test_terrain_endpoint_valid()
    test_terrain_endpoint_invalid()
    test_nearby_facilities_endpoint()
    test_dashboard_alerts_endpoints()
    test_dashboard_risk_grid_endpoint()
    test_boundaries_states_endpoint()
    test_boundaries_state_sikkim_endpoint()
    test_risk_grid_batch_endpoint()
    test_field_reports_crud()
    print("\n[SUCCESS] All service tests passed successfully!")




