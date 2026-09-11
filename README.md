# Sikkim Sentinel

Build the requested Smart India Hackathon web application: “AI-Based Early Warning and Landslide Risk Monitoring System in North Eastern Region (NER),” starting with Sikkim. Implement the actual frontend dashboard app, not a landing page. Follow the full requested structure: React+TypeScript/Vite/Tailwind, modular data/services/components/pages/types/utils, Leaflet risk map as core with Sikkim-centered historical landslide markers and clearly labeled DEMO risk heatmap/grid, navigation, dashboard charts, location assessment, searchable historical table, alerts, rainfall, field reporting, analytics, responsive command-center UI, mock API service boundary for future FastAPI/ML integration, clear DEMO DATA indicators and no claims of real AI/NASA data. Ensure npm install and npm run dev work.

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
