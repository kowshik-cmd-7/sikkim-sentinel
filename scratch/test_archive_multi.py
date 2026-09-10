import httpx

url = "https://archive-api.open-meteo.com/v1/archive?latitude=27.408,27.507&longitude=88.528,88.522&start_date=2024-08-12&end_date=2024-09-11&daily=rain_sum&timezone=auto"
r = httpx.get(url, timeout=10)
print("Archive multi-coord status:", r.status_code)
if r.status_code == 200:
    data = r.json()
    print("Type of data:", type(data))
    if isinstance(data, list):
        print(f"List with {len(data)} items:")
        for d in data:
            print("  lat:", d.get("latitude"), "lng:", d.get("longitude"), "daily items:", len(d.get("daily", {}).get("rain_sum", [])))
    elif isinstance(data, dict):
        print("Dict keys:", data.keys())
