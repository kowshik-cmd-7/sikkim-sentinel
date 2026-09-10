import httpx

pts = [
    {"latitude": 27.408, "longitude": 88.528},
    {"latitude": 27.507, "longitude": 88.522},
    {"latitude": 27.602, "longitude": 88.647},
]
r = httpx.post("https://api.open-elevation.com/api/v1/lookup", json={"locations": pts}, timeout=5)
print("POST batch status:", r.status_code)
if r.status_code == 200:
    print("Batch results:", r.json())
