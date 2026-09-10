import httpx

def test_elevation_fallback():
    # Test open-elevation
    try:
        r = httpx.get("https://api.open-elevation.com/api/v1/lookup?locations=27.408,88.528", timeout=5)
        print("Open-Elevation status:", r.status_code)
        if r.status_code == 200:
            print("Open-Elevation result:", r.json())
    except Exception as e:
        print("Open-Elevation error:", e)

    # Test open-meteo archive
    try:
        r2 = httpx.get("https://archive-api.open-meteo.com/v1/archive?latitude=27.408&longitude=88.528&start_date=2024-08-12&end_date=2024-09-11&daily=rain_sum&timezone=auto", timeout=5)
        print("Archive status:", r2.status_code)
    except Exception as e:
        print("Archive error:", e)

if __name__ == "__main__":
    test_elevation_fallback()
