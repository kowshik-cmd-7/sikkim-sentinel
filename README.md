# Bhurakshak

**AI-Based Early Warning & Landslide Risk Monitoring System for the North Eastern Region of India**

Bhurakshak is an AI-powered landslide risk monitoring and early warning platform for the North Eastern Region of India. It integrates a trained `GradientBoostingRegressor` machine learning pipeline with real-time multi-day antecedent rainfall accumulation lags (1d, 3d, 7d, 14d, 30d), high-resolution Copernicus 30m/90m DEM topographic slope analysis, multi-horizon forecasts (6h, 24h, 48h, 72h), dynamic state boundaries, and automated early warning notification dispatches.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/06d4b6ba-b8a8-4cf9-8611-a55452f0f029).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

### 1. Backend Startup (FastAPI + ML Model)

From the project root (`sikkim-sentinel`):

```powershell
# Activate virtual environment
.\backend\venv\Scripts\Activate.ps1

# Run Uvicorn from the project root
python -m uvicorn backend.service:app --reload --host 127.0.0.1 --port 8000
```

Or run directly in one line without activation:
```powershell
.\backend\venv\Scripts\python.exe -m uvicorn backend.service:app --reload --host 127.0.0.1 --port 8000
```

Verify backend health:
- `GET http://127.0.0.1:8000/health`
- Swagger Docs: `http://127.0.0.1:8000/docs`

### 2. Frontend Startup (TanStack Start + React)

In a separate terminal from the project root:

```sh
npm install
npm run dev
```

The frontend will run on `http://localhost:8080` (or `http://localhost:5173`) and automatically connect to `http://127.0.0.1:8000`.
