import httpx

coords = [(27.408, 88.528), (27.507, 88.522), (27.602, 88.647)]
lats_str = ",".join(str(c[0]) for c in coords)
lngs_str = ",".join(str(c[1]) for c in coords)

url = f"https://api.open-meteo.com/v1/forecast?latitude={lats_str}&longitude={lngs_str}&hourly=precipitation&forecast_days=3&timezone=auto"
r = httpx.get(url, timeout=10)
print("Forecast multi-coord status:", r.status_code)
if r.status_code == 200:
    data = r.json()
    print("Forecast items returned:", len(data) if isinstance(data, list) else "dict")
    if isinstance(data, list):
        for i, d in enumerate(data):
            print(f"  Item {i}: lat={d.get('latitude')}, hourly items={len(d.get('hourly', {}).get('precipitation', []))}")
else:
    print("Error:", r.text[:200])
