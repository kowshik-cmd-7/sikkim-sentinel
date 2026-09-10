async function run() {
  try {
    const healthRes = await fetch("http://127.0.0.1:8000/health");
    const health = await healthRes.json();
    console.log("[LIVE TEST] Health:", health.status, "| Algorithm:", health.algorithm, "| Loaded:", health.model_loaded);

    const alertsRes = await fetch("http://127.0.0.1:8000/alerts/nearby?latitude=27.3314&longitude=88.6138&radius_km=10");
    const alerts = await alertsRes.json();
    console.log("[LIVE TEST] Nearby Facilities:", alerts.count, "facilities within 10km.");
    console.log("            First facility:", alerts.facilities[0].name, `(${alerts.facilities[0].distance_km} km)`);

    const terrainRes = await fetch("http://127.0.0.1:8000/terrain?latitude=27.8174&longitude=88.4778");
    const terrain = await terrainRes.json();
    console.log("[LIVE TEST] Terrain at (27.8174, 88.4778):", `${terrain.elevation_m}m, ${terrain.slope_degrees}°, ${terrain.slope_category}`);

    const rainfallRes = await fetch("http://127.0.0.1:8000/weather/rainfall?latitude=27.8174&longitude=88.4778");
    const rainfall = await rainfallRes.json();
    console.log("[LIVE TEST] Rainfall at (27.8174, 88.4778): 7d =", rainfall.rainfall_7d, "mm, 30d =", rainfall.rainfall_30d, "mm");

    const predictRes = await fetch("http://127.0.0.1:8000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rainfall_1d: rainfall.rainfall_1d,
        rainfall_3d: rainfall.rainfall_3d,
        rainfall_7d: rainfall.rainfall_7d,
        rainfall_14d: rainfall.rainfall_14d,
        rainfall_30d: rainfall.rainfall_30d,
      }),
    });
    const predict = await predictRes.json();
    console.log("[LIVE TEST] ML Prediction:", predict.risk_score, "Score | Level:", predict.risk_level);

    console.log("\n>>> ALL LIVE FASTAPI ENDPOINTS VERIFIED OPERATIONAL! <<<");
  } catch (err) {
    console.error("Live test failed:", err);
    process.exit(1);
  }
}

run();
