/**
 * Mock API service boundary.
 *
 * Every function here mimics an async HTTP call. When the FastAPI + ML backend
 * exists, swap the bodies for `fetch(`${API_BASE}/...`)` calls — the component
 * layer never needs to change.
 */
import {
  ALERTS,
  DISTRICTS,
  FIELD_REPORTS,
  HISTORICAL_EVENTS,
  RAINFALL_SERIES,
} from "@/data/sikkim";
import type {
  District,
  FieldReport,
  LandslideEvent,
  LocationAssessment,
  RainfallReading,
  RiskAlert,
  RiskCell,
} from "@/types";
import { generateRiskGrid, haversineKm, levelFromScore } from "@/utils/risk";

export const API_BASE = "/api/v1"; // future FastAPI base URL
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

  /** GET /risk/grid — DEMO synthetic grid, replace with model raster */
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
   * POST /assess — DEMO scoring only.
   * Rule-based weighted sum over synthetic inputs. No trained model is involved.
   */
  assessLocation: (lat: number, lng: number): Promise<LocationAssessment> => {
    const nearest = DISTRICTS.map((d) => ({
      d,
      km: haversineKm([lat, lng], [d.lat, d.lng]),
    })).sort((a, b) => a.km - b.km)[0]!;

    const nearbyEvents = HISTORICAL_EVENTS.filter(
      (e) => haversineKm([lat, lng], [e.lat, e.lng]) < 20,
    );

    const rain = RAINFALL_SERIES.filter((r) => r.district === nearest.d.name).slice(-7);
    const rain7 = rain.reduce((s, r) => s + r.rainfallMm, 0);
    const soil = rain.length ? rain[rain.length - 1]!.soilMoisturePct : 50;
    const slopeProxy = Math.min(100, 30 + Math.abs(lat - 27.3) * 400);
    const historyProxy = Math.min(100, nearbyEvents.length * 22);

    const factors = [
      { label: "Slope steepness (proxy)", value: Math.round(slopeProxy), weight: 0.3 },
      { label: "7-day rainfall", value: Math.round(Math.min(100, rain7 / 3)), weight: 0.3 },
      { label: "Soil moisture", value: soil, weight: 0.2 },
      { label: "Historical density", value: Math.round(historyProxy), weight: 0.2 },
    ];

    const score = Math.round(factors.reduce((s, f) => s + f.value * f.weight, 0));
    const level = levelFromScore(score);

    return delay({
      lat,
      lng,
      district: nearest.d.name,
      score,
      level,
      factors,
      recommendation:
        level === "severe"
          ? "Demo guidance: avoid the slope, restrict traffic and request an engineering inspection."
          : level === "high"
            ? "Demo guidance: increase monitoring frequency and prepare evacuation routes."
            : level === "moderate"
              ? "Demo guidance: routine inspection after heavy rainfall spells."
              : "Demo guidance: no immediate action indicated.",
    });
  },
};
