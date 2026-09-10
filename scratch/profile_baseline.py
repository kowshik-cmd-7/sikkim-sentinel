import time
import httpx

BACKEND = "http://127.0.0.1:8000"

def profile_endpoints():
    client = httpx.Client(timeout=30.0)

    print("==================================================")
    print("PROFILING CURRENT BACKEND ENDPOINT LATENCIES")
    print("==================================================")

    # 1. /predict
    t0 = time.perf_counter()
    pred_res = client.post(f"{BACKEND}/predict", json={
        "rainfall_1d": 12.5, "rainfall_3d": 34.0, "rainfall_7d": 85.0,
        "rainfall_14d": 150.0, "rainfall_30d": 220.0
    })
    t_pred = (time.perf_counter() - t0) * 1000
    print(f"1. POST /predict: {t_pred:.2f} ms (Status: {pred_res.status_code})")

    # 2. /boundaries/states
    t0 = time.perf_counter()
    states_res = client.get(f"{BACKEND}/boundaries/states")
    t_states = (time.perf_counter() - t0) * 1000
    print(f"2. GET /boundaries/states: {t_states:.2f} ms (Status: {states_res.status_code})")

    # Repeat /boundaries/states
    t0 = time.perf_counter()
    states_res2 = client.get(f"{BACKEND}/boundaries/states")
    t_states2 = (time.perf_counter() - t0) * 1000
    print(f"   GET /boundaries/states (2nd call): {t_states2:.2f} ms")

    # 3. /boundaries/state?name=Sikkim
    t0 = time.perf_counter()
    state_res = client.get(f"{BACKEND}/boundaries/state?name=Sikkim")
    t_state = (time.perf_counter() - t0) * 1000
    print(f"3. GET /boundaries/state?name=Sikkim: {t_state:.2f} ms (Status: {state_res.status_code})")

    # Repeat /boundaries/state?name=Sikkim (warm cache)
    t0 = time.perf_counter()
    state_res2 = client.get(f"{BACKEND}/boundaries/state?name=Sikkim")
    t_state2 = (time.perf_counter() - t0) * 1000
    print(f"   GET /boundaries/state?name=Sikkim (warm): {t_state2:.2f} ms")

    # 4. /weather/rainfall
    t0 = time.perf_counter()
    try:
        rain_res = client.get(f"{BACKEND}/weather/rainfall?latitude=27.408&longitude=88.528")
        t_rain = (time.perf_counter() - t0) * 1000
        print(f"4. GET /weather/rainfall: {t_rain:.2f} ms (Status: {rain_res.status_code})")
    except Exception as e:
        print(f"4. GET /weather/rainfall: FAILED ({e})")

    # 5. /terrain
    t0 = time.perf_counter()
    try:
        terrain_res = client.get(f"{BACKEND}/terrain?latitude=27.408&longitude=88.528")
        t_terrain = (time.perf_counter() - t0) * 1000
        print(f"5. GET /terrain: {t_terrain:.2f} ms (Status: {terrain_res.status_code})")
    except Exception as e:
        print(f"5. GET /terrain: FAILED ({e})")

    # Repeat /terrain
    t0 = time.perf_counter()
    try:
        terrain_res2 = client.get(f"{BACKEND}/terrain?latitude=27.408&longitude=88.528")
        t_terrain2 = (time.perf_counter() - t0) * 1000
        print(f"   GET /terrain (2nd call): {t_terrain2:.2f} ms")
    except Exception as e:
        pass

    # 6. /risk/grid (6 sample points)
    sample_points = [
        {"latitude": 27.4080, "longitude": 88.5280, "name": "Point 1"},
        {"latitude": 27.5074, "longitude": 88.5222, "name": "Point 2"},
        {"latitude": 27.6025, "longitude": 88.6475, "name": "Point 3"},
        {"latitude": 27.3389, "longitude": 88.6065, "name": "Point 4"},
        {"latitude": 27.2000, "longitude": 88.4500, "name": "Point 5"},
        {"latitude": 27.7000, "longitude": 88.7000, "name": "Point 6"},
    ]

    print("\n--- Testing POST /risk/grid (6 points, cold cache) ---")
    t0 = time.perf_counter()
    grid_res_cold = client.post(f"{BACKEND}/risk/grid", json={"points": sample_points, "force_refresh": True})
    t_grid_cold = (time.perf_counter() - t0) * 1000
    print(f"6. POST /risk/grid (cold, 6 points): {t_grid_cold:.2f} ms (Status: {grid_res_cold.status_code})")
    if grid_res_cold.status_code == 200:
        data = grid_res_cold.json()
        print(f"   Points returned: {len(data.get('results', []))}")

    print("\n--- Testing POST /risk/grid (6 points, warm cache) ---")
    t0 = time.perf_counter()
    grid_res_warm = client.post(f"{BACKEND}/risk/grid", json={"points": sample_points, "force_refresh": False})
    t_grid_warm = (time.perf_counter() - t0) * 1000
    print(f"   POST /risk/grid (warm, 6 points): {t_grid_warm:.2f} ms (Status: {grid_res_warm.status_code})")

    # 7. 24 points test (typical full Sikkim grid size)
    sikkim_24_points = [
        {"latitude": round(27.1 + (i % 5) * 0.15, 4), "longitude": round(88.3 + (i // 5) * 0.12, 4), "name": f"P{i}"}
        for i in range(24)
    ]
    print("\n--- Testing POST /risk/grid (24 points, full state size) ---")
    t0 = time.perf_counter()
    grid_24_res = client.post(f"{BACKEND}/risk/grid", json={"points": sikkim_24_points, "force_refresh": True})
    t_grid_24 = (time.perf_counter() - t0) * 1000
    print(f"7. POST /risk/grid (cold, 24 points): {t_grid_24:.2f} ms ({t_grid_24/1000:.2f} s) (Status: {grid_24_res.status_code})")

    t0 = time.perf_counter()
    grid_24_warm = client.post(f"{BACKEND}/risk/grid", json={"points": sikkim_24_points, "force_refresh": False})
    t_grid_24_warm = (time.perf_counter() - t0) * 1000
    print(f"   POST /risk/grid (warm, 24 points): {t_grid_24_warm:.2f} ms")

if __name__ == "__main__":
    profile_endpoints()
