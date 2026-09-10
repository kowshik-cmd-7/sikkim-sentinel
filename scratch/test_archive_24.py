import httpx

coords = [
    (round(27.1 + (i % 5) * 0.15, 4), round(88.3 + (i // 5) * 0.12, 4))
    for i in range(24)
]
lats_str = ",".join(str(c[0]) for c in coords)
lngs_str = ",".join(str(c[1]) for c in coords)

url = f"https://archive-api.open-meteo.com/v1/archive?latitude={lats_str}&longitude={lngs_str}&start_date=2024-08-12&end_date=2024-09-11&daily=rain_sum&timezone=auto"
r = httpx.get(url, timeout=15)
print("24-coord batch status:", r.status_code)
if r.status_code == 200:
    data = r.json()
    print("Items returned:", len(data))
    for i in range(min(3, len(data))):
        print(f"  Item {i}: input=({coords[i]}), got lat={data[i].get('latitude')}, daily={len(data[i].get('daily', {}).get('rain_sum', []))}")
