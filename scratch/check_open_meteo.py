import httpx

r = httpx.get('https://api.open-meteo.com/v1/elevation?latitude=27.408&longitude=88.528', headers={'User-Agent': 'SikkimSentinel/1.0'})
print("Status:", r.status_code)
print("Retry-After:", r.headers.get('Retry-After'))
print("RateLimit headers:", {k: v for k, v in r.headers.items() if 'ratelimit' in k.lower() or 'retry' in k.lower()})
print("Body:", r.text[:200])
