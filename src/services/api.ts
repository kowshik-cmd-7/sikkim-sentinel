/**
 * API service boundary.
 * Connected to standalone Python FastAPI risk prediction service for assessLocation.
 */
import {
  ALERTS,
  DISTRICTS,
  FIELD_REPORTS,
  HISTORICAL_EVENTS,
  RAINFALL_SERIES,
} from "@/data/sikkim";
import type {
  AssessmentFactor,
  District,
  FieldReport,
  LandslideEvent,
  LocationAssessment,
  RainfallModelInputs,
  RainfallReading,
  RiskAlert,
  RiskCell,
  RiskLevel,
} from "@/types";
import { generateRiskGrid, haversineKm } from "@/utils/risk";

export const API_BASE = "/api/v1";
export const PYTHON_API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_PYTHON_API_URL) ||
  "http://127.0.0.1:8000";

const LATENCY = 220;

function delay<T>(value: T, ms = LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

let reports: FieldReport[] = [...FIELD_REPORTS];
let alerts: RiskAlert[] = [...ALERTS];

export const api = {
  /** GET /districts */
  getDistricts: (): Promise<District[]> => delay(DISTRICTS),

  /** GET /landslides/historical */
  getHistoricalEvents: (): Promise<LandslideEvent[]> => delay(HISTORICAL_EVENTS),

  /** GET /risk/grid — DEMO synthetic grid, replace with model raster in future phase */
  getRiskGrid: (): Promise<RiskCell[]> => delay(generateRiskGrid()),

  /** GET /rainfall */
  getRainfall: (): Promise<RainfallReading[]> => delay(RAINFALL_SERIES),

  /** GET /alerts */
  getAlerts: (): Promise<RiskAlert[]> => delay(alerts),

  /** POST /alerts/{id}/acknowledge */
  acknowledgeAlert: (id: string): Promise<RiskAlert[]> => {
    alerts = alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a));
    return delay(alerts, 120);
  },

  /** GET /reports */
  getFieldReports: (): Promise<FieldReport[]> => delay(reports),

  /** POST /reports */
  submitFieldReport: (
    input: Omit<FieldReport, "id" | "submittedAt">,
  ): Promise<FieldReport> => {
    const report: FieldReport = {
      ...input,
      id: `fr-${Math.random().toString(36).slice(2, 8)}`,
      submittedAt: new Date().toISOString(),
    };
    reports = [report, ...reports];
    return delay(report, 160);
  },

  /**
   * Real Landslide Risk Prediction via Python FastAPI backend (/predict).
   * Queries the scikit-learn GradientBoostingRegressor pipeline with 5 rainfall inputs.
   */
  assessLocation: async (
    lat: number,
    lng: number,
    rainfall?: RainfallModelInputs,
  ): Promise<LocationAssessment> => {
    const nearest = DISTRICTS.map((d) => ({
      d,
      km: haversineKm([lat, lng], [d.lat, d.lng]),
    })).sort((a, b) => a.km - b.km)[0]!;

    const payload: RainfallModelInputs = {
      rainfall_1d: rainfall?.rainfall_1d ?? null,
      rainfall_3d: rainfall?.rainfall_3d ?? null,
      rainfall_7d: rainfall?.rainfall_7d ?? null,
      rainfall_14d: rainfall?.rainfall_14d ?? null,
      rainfall_30d: rainfall?.rainfall_30d ?? null,
    };

    const res = await fetch(`${PYTHON_API_BASE}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Risk prediction request failed (${res.status}: ${res.statusText})`);
    }

    const data: {
      status: "success" | "insufficient_data";
      risk_score: number | null;
      risk_level: "Low" | "Moderate" | "High" | "Very High" | "Insufficient Data";
    } = await res.json();

    const levelMap: Record<string, RiskLevel> = {
      Low: "low",
      Moderate: "moderate",
      High: "high",
      "Very High": "very-high",
      "Insufficient Data": "insufficient-data",
    };
    const level: RiskLevel = levelMap[data.risk_level] ?? "insufficient-data";

    // Explanatory model feature importance (from trained GradientBoostingRegressor pipeline)
    const factors: AssessmentFactor[] = [
      {
        label: "7-Day Rainfall (rainfall_7d)",
        value: payload.rainfall_7d,
        weight: 0.5247,
        importancePct: 52.47,
      },
      {
        label: "3-Day Rainfall (rainfall_3d)",
        value: payload.rainfall_3d,
        weight: 0.3424,
        importancePct: 34.24,
      },
      {
        label: "14-Day Rainfall (rainfall_14d)",
        value: payload.rainfall_14d,
        weight: 0.0938,
        importancePct: 9.38,
      },
      {
        label: "30-Day Rainfall (rainfall_30d)",
        value: payload.rainfall_30d,
        weight: 0.0220,
        importancePct: 2.20,
      },
      {
        label: "1-Day Rainfall (rainfall_1d)",
        value: payload.rainfall_1d,
        weight: 0.0171,
        importancePct: 1.71,
      },
    ];

    let recommendation = "";
    if (level === "very-high") {
      recommendation =
        "Critical landslide risk: High antecedent rainfall saturation. Restrict traffic along cut-slopes and vulnerable highway corridors, alert district emergency operations, and inspect known landslide chutes.";
    } else if (level === "high") {
      recommendation =
        "High landslide risk: Increase monitoring frequency, prepare local response units, and check drainage paths above arterial roads.";
    } else if (level === "moderate") {
      recommendation =
        "Moderate landslide risk: Routine vigilance recommended after intense rainfall spells. Monitor retaining structures for seepage.";
    } else if (level === "low") {
      recommendation =
        "Low landslide risk: Antecedent rainfall is currently within baseline thresholds. No immediate emergency action indicated.";
    } else {
      recommendation =
        "Insufficient rainfall data: One or more critical antecedent rainfall metrics are missing or unavailable. Supply all 5 metrics (1d, 3d, 7d, 14d, 30d) to generate a reliable risk score.";
    }

    return {
      lat,
      lng,
      district: nearest.d.name,
      score: data.risk_score,
      level,
      factors,
      recommendation,
      rainfallInputs: payload,
    };
  },
};
