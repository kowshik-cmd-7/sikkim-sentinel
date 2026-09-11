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
  CalculatedRiskPoint,
  District,
  Facility,
  FieldReport,
  LandslideEvent,
  LocationAssessment,
  MonitoringRiskPoint,
  RainfallModelInputs,
  RainfallReading,
  RiskAlert,
  RiskCell,
  RiskLevel,
  SlopeCategory,
  StateBoundaryFeature,
  TerrainAssessment,
  TerrainSusceptibility,
} from "@/types";
import { NER_STATES } from "@/types";
import { findNearbyFacilities } from "@/data/facilities";
import {
  calculateHybridRisk,
  generateRiskGrid,
  haversineKm,
  TERRAIN_SUSCEPTIBILITY_SCORES,
  TERRAIN_WEIGHT,
  type HybridRiskResult,
} from "@/utils/risk";
import {
  getStoredFieldReports,
  saveFieldReport,
  updateFieldReportStatus,
  deleteFieldReport,
} from "./fieldReportService";

export {
  calculateHybridRisk,
  TERRAIN_SUSCEPTIBILITY_SCORES,
  TERRAIN_WEIGHT,
  type HybridRiskResult,
  getStoredFieldReports,
  saveFieldReport,
  updateFieldReportStatus,
  deleteFieldReport,
};
export { findNearbyFacilities };

export const API_BASE = "/api/v1";

const envPythonApi = import.meta.env.VITE_PYTHON_API_URL;
export const PYTHON_API_BASE: string =
  envPythonApi && !envPythonApi.includes(":8080")
    ? envPythonApi
    : "http://127.0.0.1:8000";

const LATENCY = 220;

function delay<T>(value: T, ms = LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

let reports: FieldReport[] = [...FIELD_REPORTS];
let alerts: RiskAlert[] = [...ALERTS];

export type RainfallFeatures = {
  rainfall_1d: number;
  rainfall_3d: number;
  rainfall_7d: number;
  rainfall_14d: number;
  rainfall_30d: number;
  data_source?: string;
};

export type RiskPredictionResponse = {
  status: "success" | "insufficient_data";
  risk_score: number | null;
  risk_level: "Low" | "Moderate" | "High" | "Very High" | "Insufficient Data";
};

export async function getRainfallFeatures(
  latitude: number,
  longitude: number,
): Promise<RainfallFeatures> {
  const response = await fetch(
    `${PYTHON_API_BASE}/weather/rainfall?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch rainfall data (${response.status}: ${response.statusText})`);
  }

  return response.json();
}

export async function getTerrainFeatures(
  latitude: number,
  longitude: number,
): Promise<TerrainAssessment> {
  const response = await fetch(
    `${PYTHON_API_BASE}/terrain?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch terrain data (${response.status}: ${response.statusText})`);
  }

  return response.json();
}

export async function predictRisk(
  rainfall: RainfallModelInputs,
): Promise<RiskPredictionResponse> {
  const response = await fetch(`${PYTHON_API_BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rainfall),
  });

  if (!response.ok) {
    throw new Error(`Risk prediction request failed (${response.status}: ${response.statusText})`);
  }

  return response.json();
}

export type HourlyForecastItem = {
  time: string;
  rainfall_mm: number;
  precipitation_probability: number | null;
  temperature_c: number | null;
  condition: string;
};

export type RainfallForecastResponse = {
  latitude: number;
  longitude: number;
  hours: number;
  data_source: string;
  total_rainfall_mm: number;
  max_hourly_rainfall_mm: number;
  forecast: HourlyForecastItem[];
};

export async function getRainfallForecast(
  latitude: number,
  longitude: number,
  hours: number = 72,
): Promise<RainfallForecastResponse> {
  const response = await fetch(
    `${PYTHON_API_BASE}/weather/forecast?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&hours=${encodeURIComponent(hours)}`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch rainfall forecast (${response.status}: ${response.statusText})`,
    );
  }

  return response.json();
}

export type NearbyFacilitiesResponse = {
  latitude: number;
  longitude: number;
  radius_km: number;
  count: number;
  facilities: Facility[];
};

export async function getNearbyFacilities(
  latitude: number,
  longitude: number,
  radiusKm: number = 10,
): Promise<Facility[]> {
  try {
    const response = await fetch(
      `${PYTHON_API_BASE}/alerts/nearby?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&radius_km=${encodeURIComponent(radiusKm)}`,
    );
    if (response.ok) {
      const data: NearbyFacilitiesResponse = await response.json();
      if (Array.isArray(data.facilities) && data.facilities.length > 0) {
        return data.facilities;
      }
    }
  } catch {
    // Fall back to client-side geocoded dataset on network failure
  }
  return findNearbyFacilities(latitude, longitude, radiusKm);
}

export { evaluateLandslideAlert } from "./alertEngine";

export type ForecastHorizonKey = "6h" | "24h" | "48h" | "72h";

export interface ForecastHorizonConfig {
  key: ForecastHorizonKey;
  label: string;
  hours: number;
}

export const FORECAST_HORIZONS: ForecastHorizonConfig[] = [
  { key: "6h", label: "Next 6 Hours", hours: 6 },
  { key: "24h", label: "Next 24 Hours", hours: 24 },
  { key: "48h", label: "Next 48 Hours", hours: 48 },
  { key: "72h", label: "Next 72 Hours", hours: 72 },
];

export interface HorizonRiskAssessment {
  key: ForecastHorizonKey;
  label: string;
  hours: number;
  forecastRainfallMm: number;
  peakHourlyMm: number;
  maxPrecipitationProbability: number | null;
  projectedInputs: RainfallModelInputs;
  // Intermediate Rainfall ML prediction
  rainfallRiskScore: number | null;
  rainfallRiskLevel: RiskLevel;
  // Terrain modifiers
  terrainScore: number;
  terrainSusceptibility: TerrainSusceptibility;
  slopeCategory: SlopeCategory;
  slopeDegrees: number | null;
  elevationM: number | null;
  terrainContribution: number;
  // Final Hybrid risk
  finalRiskScore: number | null;
  finalRiskLevel: RiskLevel;
  // Backwards compatibility aliases
  riskScore: number | null;
  riskLevel: RiskLevel;
  interpretation: string;
  status: "success" | "insufficient_data";
}

export function getHorizonInterpretation(
  hours: number,
  finalLevel: RiskLevel,
  rainMm: number,
  terrainSusceptibility?: TerrainSusceptibility,
  slopeCategory?: SlopeCategory,
): string {
  if (finalLevel === "insufficient-data") {
    return "Insufficient data to project landslide risk.";
  }

  const isSteep = slopeCategory === "Steep" || slopeCategory === "Very Steep";

  if (hours === 6) {
    if (finalLevel === "very-high" || finalLevel === "high") {
      return isSteep
        ? "Critical short-term rainfall combined with steep terrain rapidly elevates slope instability risk."
        : "Critical short-term rainfall surge rapidly elevates slope instability risk.";
    }
    if (finalLevel === "moderate") {
      return isSteep
        ? "Short-term rainfall combined with steep slope increases soil saturation and pore water pressure."
        : "Short-term rainfall is increasing soil saturation and pore water pressure.";
    }
    return rainMm > 0
      ? "Light short-term precipitation; slope saturation remains within safe baseline limits."
      : "No significant immediate rainfall; stable slope conditions projected.";
  }
  if (hours === 24) {
    if (finalLevel === "very-high" || finalLevel === "high") {
      return isSteep
        ? "High 24-hour accumulation on steep topography pushes antecedent moisture toward critical thresholds."
        : "High 24-hour accumulation pushes antecedent moisture toward critical thresholds.";
    }
    if (finalLevel === "moderate") {
      return isSteep
        ? "Accumulating 24-hour rainfall warrants heightened vigilance on vulnerable slopes."
        : "24-hour projected rainfall accumulation moderately elevates baseline risk.";
    }
    return "24-hour projected rainfall accumulation remains within safe baseline limits.";
  }
  if (hours === 48) {
    if (finalLevel === "very-high" || finalLevel === "high") {
      return isSteep
        ? "Sustained 48-hour precipitation on steep terrain drives deep soil saturation and severe hazard."
        : "Sustained 48-hour precipitation drives deep soil saturation and severe hazard.";
    }
    if (finalLevel === "moderate") {
      return isSteep
        ? "Cumulative 48-hour rainfall may induce drainage buildup and localized slope movements."
        : "Cumulative 48-hour rainfall may induce localized drainage saturation.";
    }
    return "48-hour cumulative rainfall is low; baseline slope stability expected.";
  }
  // 72 hours
  if (finalLevel === "very-high" || finalLevel === "high") {
    return isSteep
      ? "Multi-day cumulative rainfall combined with steep terrain reaches dangerous levels; widespread hazard projected."
      : "Multi-day cumulative rainfall reaches dangerous levels; widespread hazard projected.";
  }
  if (finalLevel === "moderate") {
    return isSteep
      ? "Extended 72-hour moisture accumulation requires ongoing monitoring on vulnerable slopes."
      : "Extended 72-hour moisture accumulation requires ongoing regional monitoring.";
  }
  return "72-hour total rainfall remains within normal ranges; low landslide risk projected.";
}

export function constructProjectedFeatures(
  baseline: RainfallModelInputs,
  forecastItems: HourlyForecastItem[],
  horizonHours: number,
): {
  projectedInputs: RainfallModelInputs;
  forecastRainfallMm: number;
  peakHourlyMm: number;
  maxProb: number | null;
} | null {
  if (
    baseline.rainfall_1d === null ||
    baseline.rainfall_3d === null ||
    baseline.rainfall_7d === null ||
    baseline.rainfall_14d === null ||
    baseline.rainfall_30d === null ||
    forecastItems.length === 0
  ) {
    return null;
  }

  const items = forecastItems.slice(0, horizonHours);
  if (items.length === 0) return null;

  const f_total = Number(items.reduce((sum, it) => sum + (it.rainfall_mm || 0), 0).toFixed(2));
  const peakHourlyMm = Number(Math.max(...items.map((it) => it.rainfall_mm || 0)).toFixed(2));

  const probs = items
    .map((it) => it.precipitation_probability)
    .filter((p): p is number => p !== null && p !== undefined);
  const maxProb = probs.length > 0 ? Math.max(...probs) : null;

  const f_0_24 = forecastItems.slice(0, 24).reduce((sum, it) => sum + (it.rainfall_mm || 0), 0);
  const f_24_48 = forecastItems.slice(24, 48).reduce((sum, it) => sum + (it.rainfall_mm || 0), 0);
  const f_48_72 = forecastItems.slice(48, 72).reduce((sum, it) => sum + (it.rainfall_mm || 0), 0);

  let add_1d: number;
  if (horizonHours <= 24) {
    add_1d = f_total;
  } else if (horizonHours <= 48) {
    add_1d = Math.max(f_0_24, f_24_48);
  } else {
    add_1d = Math.max(f_0_24, f_24_48, f_48_72);
  }

  const add_3d = f_total;
  const add_7d = f_total;
  const add_14d = f_total;
  const add_30d = f_total;

  return {
    projectedInputs: {
      rainfall_1d: Number((baseline.rainfall_1d + add_1d).toFixed(2)),
      rainfall_3d: Number((baseline.rainfall_3d + add_3d).toFixed(2)),
      rainfall_7d: Number((baseline.rainfall_7d + add_7d).toFixed(2)),
      rainfall_14d: Number((baseline.rainfall_14d + add_14d).toFixed(2)),
      rainfall_30d: Number((baseline.rainfall_30d + add_30d).toFixed(2)),
    },
    forecastRainfallMm: f_total,
    peakHourlyMm,
    maxProb,
  };
}

export async function predictForecastRisk(
  baseline: RainfallModelInputs,
  forecastItems: HourlyForecastItem[],
  horizonHours: number,
  terrain?: TerrainAssessment | null,
): Promise<HorizonRiskAssessment> {
  const horizonKey = `${horizonHours}h` as ForecastHorizonKey;
  const horizonConfig = FORECAST_HORIZONS.find((h) => h.key === horizonKey);
  const label = horizonConfig?.label ?? `Next ${horizonHours} Hours`;

  const projected = constructProjectedFeatures(baseline, forecastItems, horizonHours);
  if (!projected) {
    return {
      key: horizonKey,
      label,
      hours: horizonHours,
      projectedInputs: {
        rainfall_1d: null,
        rainfall_3d: null,
        rainfall_7d: null,
        rainfall_14d: null,
        rainfall_30d: null,
      },
      forecastRainfallMm: 0,
      peakHourlyMm: 0,
      maxPrecipitationProbability: null,
      rainfallRiskScore: null,
      rainfallRiskLevel: "insufficient-data",
      terrainScore: terrain ? (TERRAIN_SUSCEPTIBILITY_SCORES[terrain.terrain_susceptibility] ?? 0) : 0,
      terrainSusceptibility: terrain?.terrain_susceptibility ?? "Low",
      slopeCategory: terrain?.slope_category ?? "Flat",
      slopeDegrees: terrain?.slope_degrees ?? null,
      elevationM: terrain?.elevation_m ?? null,
      terrainContribution: 0,
      finalRiskScore: null,
      finalRiskLevel: "insufficient-data",
      riskScore: null,
      riskLevel: "insufficient-data",
      interpretation: "Insufficient baseline rainfall or forecast data to evaluate projected risk.",
      status: "insufficient_data",
    };
  }

  const prediction = await predictRisk(projected.projectedInputs);

  const levelMap: Record<string, RiskLevel> = {
    Low: "low",
    Moderate: "moderate",
    High: "high",
    "Very High": "very-high",
    "Insufficient Data": "insufficient-data",
  };
  const rainfallLevel: RiskLevel = levelMap[prediction.risk_level] ?? "insufficient-data";

  // Calculate Hybrid Risk combining rainfall ML risk and terrain susceptibility
  const hybrid = calculateHybridRisk(prediction.risk_score, terrain);

  const interpretation = getHorizonInterpretation(
    horizonHours,
    hybrid.finalRiskLevel,
    projected.forecastRainfallMm,
    terrain?.terrain_susceptibility,
    terrain?.slope_category,
  );

  return {
    key: horizonKey,
    label,
    hours: horizonHours,
    projectedInputs: projected.projectedInputs,
    forecastRainfallMm: projected.forecastRainfallMm,
    peakHourlyMm: projected.peakHourlyMm,
    maxPrecipitationProbability: projected.maxProb,
    rainfallRiskScore: prediction.risk_score,
    rainfallRiskLevel: rainfallLevel,
    terrainScore: hybrid.terrainScore,
    terrainSusceptibility: hybrid.terrainSusceptibility,
    slopeCategory: terrain?.slope_category ?? "Flat",
    slopeDegrees: terrain?.slope_degrees ?? null,
    elevationM: terrain?.elevation_m ?? null,
    terrainContribution: hybrid.terrainContribution,
    finalRiskScore: hybrid.finalRiskScore,
    finalRiskLevel: hybrid.finalRiskLevel,
    riskScore: hybrid.finalRiskScore,
    riskLevel: hybrid.finalRiskLevel,
    interpretation,
    status: prediction.status,
  };
}

export async function predictAllForecastHorizons(
  baseline: RainfallModelInputs,
  forecastItems: HourlyForecastItem[],
  terrain?: TerrainAssessment | null,
): Promise<HorizonRiskAssessment[]> {
  return Promise.all(
    FORECAST_HORIZONS.map((h) => predictForecastRisk(baseline, forecastItems, h.hours, terrain)),
  );
}

/**
 * GET /dashboard/risk-grid
 * Retrieves calculated current and multi-horizon landslide risks for predefined
 * monitoring watchpoints across Sikkim directly from the Python ML service.
 */
export async function getDashboardRiskGrid(forceRefresh = false): Promise<MonitoringRiskPoint[]> {
  const url = `${PYTHON_API_BASE}/dashboard/risk-grid${forceRefresh ? "?force_refresh=true" : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch dashboard risk grid (${res.status}: ${res.statusText})`);
  }
  const data: { points: MonitoringRiskPoint[] } = await res.json();
  return data.points;
}

/**
 * GET /boundaries/states
 * Retrieves the list of Indian states from BharatMaps and filters strictly to the 8 NER states.
 */
export async function getIndianStates(): Promise<string[]> {
  try {
    const res = await fetch(`${PYTHON_API_BASE}/boundaries/states`);
    if (res.ok) {
      const data: { states: { name: string }[] } = await res.json();
      const fetchedNames = data.states.map((s) => s.name);
      const nerFiltered = NER_STATES.filter((st) => fetchedNames.includes(st));
      if (nerFiltered.length > 0) {
        return [...nerFiltered];
      }
    }
  } catch (e) {
    console.warn("Failed to fetch states from backend, using canonical NER list:", e);
  }
  return [...NER_STATES];
}

/**
 * GET /boundaries/state?name={name}
 * Retrieves official GeoJSON boundary feature for an Indian state from BharatMaps.
 * Enforces that the requested state is within the North Eastern Region (NER).
 */
export async function getStateBoundary(stateName: string): Promise<StateBoundaryFeature> {
  if (!NER_STATES.includes(stateName as any)) {
    throw new Error(`State "${stateName}" is outside the North Eastern Region scope.`);
  }
  const url = `${PYTHON_API_BASE}/boundaries/state?name=${encodeURIComponent(stateName)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load state boundary for "${stateName}" (${res.status}: ${res.statusText})`);
  }
  const data: StateBoundaryFeature = await res.json();
  return data;
}

/**
 * POST /risk/grid
 * Batch calculates hybrid landslide risk for multiple coordinates within an NER state.
 */
export async function evaluateRiskGridBatch(
  points: { latitude: number; longitude: number; name?: string }[],
  forceRefresh = false,
  stateName?: string,
): Promise<CalculatedRiskPoint[]> {
  if (!points || points.length === 0) return [];
  if (stateName && !NER_STATES.includes(stateName as any)) {
    throw new Error("State is outside the North Eastern Region scope.");
  }
  const url = `${PYTHON_API_BASE}/risk/grid`;
  const payload: any = { points, force_refresh: forceRefresh };
  if (stateName) {
    payload.state_name = stateName;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || `Failed to calculate risk grid batch (${res.status}: ${res.statusText})`);
  }
  const data = await res.json();
  return (data.results || []).map((r: any) => ({
    latitude: r.latitude,
    longitude: r.longitude,
    locationName: r.location_name,
    riskScore: r.risk_score,
    riskLevel: r.risk_level,
    rainfallRiskScore: r.rainfall_risk_score,
    terrainScore: r.terrain_score,
    terrainSusceptibility: r.terrain_susceptibility,
    elevation: r.elevation,
    slope: r.slope,
    rainfall7d: r.rainfall_7d,
    status: r.status,
  }));
}

export const api = {
  /** GET /districts */
  getDistricts: (): Promise<District[]> => delay(DISTRICTS),

  /** GET /landslides/historical */
  getHistoricalEvents: (): Promise<LandslideEvent[]> => delay(HISTORICAL_EVENTS),

  /** GET /boundaries/states — List of Indian states (restricted to NER) */
  getIndianStates: (): Promise<string[]> => getIndianStates(),

  /** GET /boundaries/state — GeoJSON boundary for a state */
  getStateBoundary: (stateName: string): Promise<StateBoundaryFeature> => getStateBoundary(stateName),

  /** POST /risk/grid — Batch calculate hybrid risk for coordinates */
  evaluateRiskGridBatch: (
    points: { latitude: number; longitude: number; name?: string }[],
    forceRefresh?: boolean,
    stateName?: string,
  ): Promise<CalculatedRiskPoint[]> => evaluateRiskGridBatch(points, forceRefresh, stateName),

  /** GET /dashboard/risk-grid — Data-driven Sikkim landslide risk heatmap */
  getDashboardRiskGrid: (forceRefresh?: boolean): Promise<MonitoringRiskPoint[]> =>
    getDashboardRiskGrid(forceRefresh),

  /** GET /risk/grid — Legacy synthetic grid */
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
  getFieldReports: (): Promise<FieldReport[]> => delay(getStoredFieldReports(), 100),

  /** POST /reports */
  submitFieldReport: (
    input: Omit<FieldReport, "id" | "timestamp" | "status"> & Partial<Pick<FieldReport, "status">>,
  ): Promise<FieldReport> => {
    const saved = saveFieldReport(input);
    return delay(saved, 150);
  },

  /** PATCH /reports/{id}/status */
  updateFieldReportStatus: (
    id: string,
    status: FieldReport["status"],
  ): Promise<FieldReport | null> => {
    const updated = updateFieldReportStatus(id, status);
    return delay(updated, 120);
  },

  /** DELETE /reports/{id} */
  deleteFieldReport: (id: string): Promise<boolean> => {
    const success = deleteFieldReport(id);
    return delay(success, 100);
  },

  /**
   * Real Landslide Risk Prediction via Python FastAPI backend (/predict).
   * Queries the scikit-learn GradientBoostingRegressor pipeline with 5 rainfall inputs.
   * If rainfall inputs are not provided, automatically fetches them using the given coordinates.
   */
  assessLocation: async (
    lat: number,
    lng: number,
    rainfall?: RainfallModelInputs,
    terrain?: TerrainAssessment | null,
  ): Promise<LocationAssessment> => {
    const nearest = DISTRICTS.map((d) => ({
      d,
      km: haversineKm([lat, lng], [d.lat, d.lng]),
    })).sort((a, b) => a.km - b.km)[0]!;

    let inputs: RainfallModelInputs;
    let source = "FastAPI /weather/rainfall";

    if (
      rainfall &&
      rainfall.rainfall_1d !== null &&
      rainfall.rainfall_3d !== null &&
      rainfall.rainfall_7d !== null &&
      rainfall.rainfall_14d !== null &&
      rainfall.rainfall_30d !== null
    ) {
      inputs = { ...rainfall };
      source = "Manual / Preset Override";
    } else {
      // Automatically fetch rainfall from the selected coordinates
      const liveRainfall = await getRainfallFeatures(lat, lng);
      inputs = {
        rainfall_1d: liveRainfall.rainfall_1d,
        rainfall_3d: liveRainfall.rainfall_3d,
        rainfall_7d: liveRainfall.rainfall_7d,
        rainfall_14d: liveRainfall.rainfall_14d,
        rainfall_30d: liveRainfall.rainfall_30d,
      };
      if (liveRainfall.data_source) {
        source = liveRainfall.data_source;
      }
    }

    // If terrain was not provided, attempt to retrieve it automatically
    let resolvedTerrain: TerrainAssessment | null = terrain ?? null;
    if (terrain === undefined) {
      try {
        resolvedTerrain = await getTerrainFeatures(lat, lng);
      } catch {
        resolvedTerrain = null;
      }
    }

    const prediction = await predictRisk(inputs);

    const levelMap: Record<string, RiskLevel> = {
      Low: "low",
      Moderate: "moderate",
      High: "high",
      "Very High": "very-high",
      "Insufficient Data": "insufficient-data",
    };
    const rainfallLevel: RiskLevel = levelMap[prediction.risk_level] ?? "insufficient-data";

    // Explicit Hybrid Risk interaction
    const hybrid = calculateHybridRisk(prediction.risk_score, resolvedTerrain);
    const finalLevel = hybrid.finalRiskLevel;

    // Explanatory model feature importance (from trained GradientBoostingRegressor pipeline)
    const factors: AssessmentFactor[] = [
      {
        label: "7-Day Rainfall (rainfall_7d)",
        value: inputs.rainfall_7d,
        weight: 0.5247,
        importancePct: 52.47,
      },
      {
        label: "3-Day Rainfall (rainfall_3d)",
        value: inputs.rainfall_3d,
        weight: 0.3424,
        importancePct: 34.24,
      },
      {
        label: "14-Day Rainfall (rainfall_14d)",
        value: inputs.rainfall_14d,
        weight: 0.0938,
        importancePct: 9.38,
      },
      {
        label: "30-Day Rainfall (rainfall_30d)",
        value: inputs.rainfall_30d,
        weight: 0.022,
        importancePct: 2.2,
      },
      {
        label: "1-Day Rainfall (rainfall_1d)",
        value: inputs.rainfall_1d,
        weight: 0.0171,
        importancePct: 1.71,
      },
    ];

    let recommendation = "";
    if (finalLevel === "very-high") {
      recommendation =
        "Critical hybrid landslide risk: Severe antecedent rainfall saturation coupled with steep terrain susceptibility. Restrict traffic along cut-slopes and vulnerable highway corridors, alert district emergency operations, and inspect known landslide chutes.";
    } else if (finalLevel === "high") {
      recommendation =
        "High hybrid landslide risk: Elevated moisture accumulation on vulnerable topography. Increase monitoring frequency, prepare local response units, and inspect drainage paths above arterial roads.";
    } else if (finalLevel === "moderate") {
      recommendation =
        "Moderate hybrid landslide risk: Moderate vulnerability under observed precipitation. Routine vigilance recommended after intense rainfall spells. Monitor retaining structures for seepage.";
    } else if (finalLevel === "low") {
      recommendation =
        "Low hybrid landslide risk: Antecedent rainfall and terrain susceptibility are within baseline thresholds. No immediate emergency action indicated.";
    } else {
      recommendation =
        "Insufficient data: One or more critical rainfall metrics or DEM terrain parameters are unavailable. Both complete rainfall metrics and DEM terrain data are required for reliable hybrid risk scoring.";
    }

    return {
      lat,
      lng,
      district: nearest.d.name,
      score: hybrid.finalRiskScore,
      level: finalLevel,
      factors,
      recommendation,
      rainfallInputs: inputs,
      rainfallSource: source,
      rainfallRiskScore: prediction.risk_score,
      rainfallRiskLevel: rainfallLevel,
      terrainAssessment: resolvedTerrain,
      terrainScore: hybrid.terrainScore,
      terrainContribution: hybrid.terrainContribution,
      finalRiskScore: hybrid.finalRiskScore,
      finalRiskLevel: finalLevel,
    };
  },
};
