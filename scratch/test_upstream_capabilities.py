import httpx
import json

def test_capabilities():
    print("Testing Open-Meteo capabilities...")

    # 1. Test Elevation API batch with multiple coordinates
    print("\n1. Testing Open-Meteo Elevation API with multiple coordinates...")
    lats = "27.408,27.507,27.602,27.338"
    lngs = "88.528,88.522,88.647,88.606"
    url_elev = f"https://api.open-meteo.com/v1/elevation?latitude={lats}&longitude={lngs}"
    r = httpx.get(url_elev, timeout=10)
    print("   Status:", r.status_code)
    if r.status_code == 200:
        data = r.json()
        print("   Returned elevation count:", len(data.get("elevation", [])))
        print("   Elevations:", data.get("elevation"))

    # 2. Test Forecast API with past_days=30 and multiple coordinates
    print("\n2. Testing Open-Meteo Forecast API with multiple coordinates & past_days=30...")
    url_forecast = f"https://api.open-meteo.com/v1/forecast?latitude={lats}&longitude={lngs}&daily=rain_sum&past_days=30&forecast_days=1&timezone=auto"
    r2 = httpx.get(url_forecast, timeout=10)
    print("   Status:", r2.status_code)
    if r2.status_code == 200:
        data2 = r2.json()
        print("   Type of response:", type(data2))
        if isinstance(data2, list):
            print(f"   Batch array returned with {len(data2)} locations!")
            for idx, loc in enumerate(data2):
                daily = loc.get("daily", {})
                rains = daily.get("rain_sum", [])
                print(f"   Loc {idx}: lat={loc.get('latitude')}, lng={loc.get('longitude')}, rain count={len(rains)}, 7d_sum={sum(rains[-7:]):.2f}")
        else:
            print("   Single dict returned:", data2.keys())

    # 3. Test Archive API with clamped date
    print("\n3. Testing Archive API...")
    url_archive = "https://archive-api.open-meteo.com/v1/archive?latitude=27.408&longitude=88.528&start_date=2024-08-12&end_date=2024-09-11&daily=rain_sum&timezone=auto"
    r3 = httpx.get(url_archive, timeout=10)
    print("   Status with 2024 dates:", r3.status_code)
    if r3.status_code == 200:
        data3 = r3.json()
        rains = data3.get("daily", {}).get("rain_sum", [])
        print(f"   Archive rain count={len(rains)}, 7d_sum={sum(rains[-7:]):.2f}")

if __name__ == "__main__":
    test_capabilities()
