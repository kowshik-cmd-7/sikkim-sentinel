/**
 * Landslide Alert & Early Warning Engine for Bhurakshak.
 *
 * 1. Evaluates current hybrid risk and projected multi-horizon forecasts (6h, 24h, 48h, 72h)
 *    against official disaster management thresholds (CRITICAL, WARNING, WATCH).
 *    Automatically identifies and prioritizes nearby response entities (Authorities, Hospitals, Schools)
 *    and generates actionable dispatch payloads.
 *
 * 2. Preserves DEMO rule automation (evaluateDemoRules, draftFromEvaluation, DEMO_THRESHOLDS)
 *    for admin mock alerts.
 */

import { DISTRICTS, RAINFALL_SERIES } from "@/data/sikkim";
import type {
  AlertEvaluation,
  AlertRecipient,
  AlertSeverity,
  Facility,
  LandslideAlert,
  RainfallModelInputs,
  RiskLevel,
  TerrainAssessment,
} from "@/types";
import type { AlertType, WarningAlert } from "@/types/alerts";
import { findNearbyFacilities } from "@/data/facilities";

/* =========================================================================
   PART 1: REAL-TIME ML & TERRAIN MULTI-HORIZON ALERT ENGINE
   ========================================================================= */

export interface HorizonRiskItem {
  horizon: string; // e.g. "6h", "24h", "48h", "72h"
  label: string; // e.g. "+6 Hours"
  score: number | null;
  level: RiskLevel;
  rainfallMm: number;
}

export interface EvaluateAlertParams {
  lat: number;
  lng: number;
  district?: string | undefined;
  currentRisk: number | null;
  currentLevel: RiskLevel;
  horizons?: HorizonRiskItem[] | undefined;
  terrain?: TerrainAssessment | null | undefined;
  rainfall?: RainfallModelInputs | null | undefined;
  radiusKm?: number | undefined;
  nearbyFacilitiesPool?: Facility[] | undefined;
  existingAlertState?: Partial<LandslideAlert> | null | undefined;
}

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  CRITICAL: 3,
  WARNING: 2,
  WATCH: 1,
};

function scoreToSeverity(score: number | null, level: RiskLevel): AlertSeverity | null {
  if (score !== null) {
    if (score >= 75) return "CRITICAL";
    if (score >= 55) return "WARNING";
    if (score >= 30) return "WATCH";
    return null;
  }
  // Fallback to categorical level if score is null
  if (level === "very-high" || level === "severe") return "CRITICAL";
  if (level === "high") return "WARNING";
  if (level === "moderate") return "WATCH";
  return null;
}

function getRecommendedActions(severity: AlertSeverity, peakHorizon: string): string[] {
  if (severity === "CRITICAL") {
    return [
      "Evacuate high-risk downslope settlements along active debris corridors immediately.",
      "Issue immediate vehicular traffic halt on vulnerable hill highway sectors and mountain passes.",
      "Activate District Emergency Operation Centre (DEOC) & alert SDRF/NDRF search and rescue battalions.",
      "Prepare emergency casualty, trauma, and triage wards at nearest referral medical centres.",
      "Order suspension of classes and activities in all nearby educational institutions in vulnerable zones.",
      "Deploy rapid road clearance earthmoving machinery to predetermined standby choke points.",
    ];
  }
  if (severity === "WARNING") {
    return [
      `Initiate high-alert early warning protocols for projected escalation within ${peakHorizon}.`,
      "Deploy road patrol teams to monitor active fissures, culvert chokes, and slope toe erosion.",
      "Advise public against non-essential transit across steep mountain corridors.",
      "Alert local Primary Health Centres (PHCs) and emergency ambulance fleets.",
      "Instruct school administrations to restrict outdoor assemblies and review emergency evacuation routes.",
    ];
  }
  // WATCH
  return [
    "Activate continuous monitoring of automatic weather telemetry and soil saturation rates.",
    "Issue advisory to local Gram Panchayats and community early-warning focal points.",
    "Verify operability of backup satellite and VHF emergency communication links.",
    "Inspect hillside drainage channels and culverts for sediment blockages.",
  ];
}

/**
 * Evaluates coordinates, current hybrid risk, and multi-horizon projections
 * to produce an AlertEvaluation with synthesized early warning and prioritized recipients.
 */
export function evaluateLandslideAlert(params: EvaluateAlertParams): AlertEvaluation {
  const {
    lat,
    lng,
    district = "Sikkim",
    currentRisk,
    currentLevel,
    horizons = [],
    terrain = null,
    rainfall = null,
    radiusKm = 10,
    nearbyFacilitiesPool,
    existingAlertState,
  } = params;

  // 1. Determine current severity
  const currentSeverity = scoreToSeverity(currentRisk, currentLevel);

  // 2. Determine horizon severities
  let highestSeverity: AlertSeverity | null = currentSeverity;
  let highestScore = currentRisk ?? 0;
  let highestHorizon = "Current";
  let peakRainfallMm = 0;

  for (const h of horizons) {
    const hSev = scoreToSeverity(h.score, h.level);
    if (hSev) {
      const currentRank = highestSeverity ? SEVERITY_RANK[highestSeverity] : 0;
      const hRank = SEVERITY_RANK[hSev];
      if (hRank > currentRank || (hRank === currentRank && (h.score ?? 0) > highestScore)) {
        highestSeverity = hSev;
        highestScore = h.score ?? highestScore;
        highestHorizon = h.horizon;
        peakRainfallMm = h.rainfallMm;
      }
    }
  }

  // 3. Obtain nearby facilities
  const facilities = nearbyFacilitiesPool && nearbyFacilitiesPool.length > 0
    ? nearbyFacilitiesPool
    : findNearbyFacilities(lat, lng, radiusKm);

  // If no severity reached threshold (score < 30 and no horizon >= 30)
  if (!highestSeverity) {
    return {
      shouldAlert: false,
      severity: null,
      alert: null,
      triggerReason: "Normal Conditions — Combined current and projected risk remain below alert threshold (<30).",
      nearbyFacilities: facilities,
    };
  }

  // 4. Construct early warning synthesis
  const isEarlyWarning = currentSeverity !== highestSeverity && highestHorizon !== "Current";
  let title = "";
  let triggerReason = "";

  if (isEarlyWarning) {
    title = `EARLY WARNING — ${highestSeverity} RISK PROJECTED WITHIN ${highestHorizon.toUpperCase()}`;
    triggerReason = `Forecast precipitation (+${peakRainfallMm.toFixed(1)}mm) escalates projected risk to ${highestScore.toFixed(1)} (${highestSeverity}) within ${highestHorizon}.`;
  } else {
    title = `${highestSeverity} LANDSLIDE ALERT — ${district.toUpperCase()} SECTOR`;
    triggerReason = `Location evaluated at ${highestSeverity} risk (Score: ${(currentRisk ?? highestScore).toFixed(1)}) due to ${
      terrain && terrain.slope_degrees > 25 ? `${terrain.slope_degrees.toFixed(1)}° ${terrain.slope_category} slope` : "elevated slope instability"
    } and cumulative rainfall.`;
  }

  // Compose comprehensive dispatch message
  const slopeText = terrain ? `${terrain.slope_degrees.toFixed(1)}° (${terrain.slope_category})` : "N/A";
  const elevText = terrain ? `${Math.round(terrain.elevation_m)}m` : "N/A";
  const r7dText = rainfall?.rainfall_7d != null ? `${rainfall.rainfall_7d.toFixed(1)}mm` : "Telemetry pending";

  const message = [
    `ALERT LEVEL: ${highestSeverity}`,
    `LOCATION: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E (${district})`,
    `TERRAIN PROFILE: Elevation ${elevText} | Slope ${slopeText} | Susceptibility: ${terrain?.terrain_susceptibility ?? "Moderate"}`,
    `HYDROLOGICAL TRIGGER: 7-Day Antecedent Rainfall ${r7dText}${peakRainfallMm > 0 ? ` | Projected Forecast +${peakRainfallMm.toFixed(1)}mm` : ""}`,
    `STATUS: ${isEarlyWarning ? `Multi-horizon escalation expected by +${highestHorizon}` : "Active conditions require immediate response"}`,
  ].join(" — ");

  // 5. Build prioritized recipients
  const recipients: AlertRecipient[] = facilities.map((f) => {
    let category: "Authorities" | "Health" | "Education" = "Authorities";
    let priority = 1;
    if (f.type === "hospital") {
      category = "Health";
      priority = 2;
    } else if (f.type === "school") {
      category = "Education";
      priority = 3;
    }

    return {
      id: `recip-${f.id}`,
      facilityId: f.id,
      name: f.name,
      type: f.type,
      category,
      priority,
      distanceKm: f.distance_km ?? 0,
      contact: f.contact,
      status: "queued",
    };
  });

  const actions = getRecommendedActions(highestSeverity, highestHorizon);

  const alert: LandslideAlert = {
    id: existingAlertState?.id ?? `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    severity: highestSeverity,
    title,
    message,
    generatedAt: existingAlertState?.generatedAt ?? new Date().toISOString(),
    affectedLatitude: lat,
    affectedLongitude: lng,
    affectedDistrict: district,
    currentRisk,
    currentRiskLevel: currentLevel,
    forecastRisk: highestScore,
    forecastRiskLevel: highestSeverity === "CRITICAL" ? "very-high" : highestSeverity === "WARNING" ? "high" : "moderate",
    forecastHorizon: highestHorizon,
    forecastRainfall: peakRainfallMm,
    peakRainfallMm: peakRainfallMm || undefined,
    terrainSusceptibility: terrain?.terrain_susceptibility ?? "Moderate",
    slope: terrain?.slope_degrees ?? 0,
    elevation: terrain?.elevation_m ?? 0,
    rainfall: {
      r1d: rainfall?.rainfall_1d ?? null,
      r3d: rainfall?.rainfall_3d ?? null,
      r7d: rainfall?.rainfall_7d ?? null,
      r14d: rainfall?.rainfall_14d ?? null,
      r30d: rainfall?.rainfall_30d ?? null,
    },
    recipients,
    recommendedActions: actions,
    acknowledged: existingAlertState?.acknowledged ?? false,
    acknowledgedAt: existingAlertState?.acknowledgedAt ?? undefined,
    acknowledgedBy: existingAlertState?.acknowledgedBy ?? undefined,
    isDemo: true,
  };

  return {
    shouldAlert: true,
    severity: highestSeverity,
    alert,
    triggerReason,
    nearbyFacilities: facilities,
  };
}

/* =========================================================================
   PART 2: DEMO RULE AUTOMATION (FOR ADMIN / MOCK ALERTS)
   ========================================================================= */

export interface DemoThreshold {
  id: string;
  label: string;
  type: AlertType;
  severity: RiskLevel;
  antecedent7dMm: number;
  soilMoisturePct: number;
}

export const DEMO_THRESHOLDS: DemoThreshold[] = [
  {
    id: "th-severe",
    label: "DEMO: 7-day rainfall > 250 mm and soil moisture > 80%",
    type: "landslide-risk",
    severity: "severe",
    antecedent7dMm: 250,
    soilMoisturePct: 80,
  },
  {
    id: "th-high",
    label: "DEMO: 7-day rainfall > 180 mm and soil moisture > 70%",
    type: "rainfall-threshold",
    severity: "high",
    antecedent7dMm: 180,
    soilMoisturePct: 70,
  },
  {
    id: "th-moderate",
    label: "DEMO: 7-day rainfall > 120 mm and soil moisture > 60%",
    type: "rainfall-threshold",
    severity: "moderate",
    antecedent7dMm: 120,
    soilMoisturePct: 60,
  },
];

export interface RuleEvaluation {
  district: string;
  antecedent7dMm: number;
  soilMoisturePct: number;
  matchedThreshold: DemoThreshold | null;
}

export function evaluateDemoRules(): RuleEvaluation[] {
  return DISTRICTS.map((d) => {
    const rows = RAINFALL_SERIES.filter((r) => r.district === d.name).slice(-7);
    const antecedent7dMm =
      Math.round(rows.reduce((s, r) => s + r.rainfallMm, 0) * 10) / 10;
    const soilMoisturePct = rows.length
      ? Math.round(rows.reduce((s, r) => s + r.soilMoisturePct, 0) / rows.length)
      : 0;
    const matchedThreshold =
      DEMO_THRESHOLDS.find(
        (t) =>
          antecedent7dMm >= t.antecedent7dMm && soilMoisturePct >= t.soilMoisturePct,
      ) ?? null;
    return { district: d.name, antecedent7dMm, soilMoisturePct, matchedThreshold };
  });
}

/** Builds a DRAFT alert from a matched demo rule. Nothing is published automatically. */
export function draftFromEvaluation(ev: RuleEvaluation): WarningAlert | null {
  if (!ev.matchedThreshold) return null;
  const d = DISTRICTS.find((x) => x.name === ev.district)!;
  const now = new Date().toISOString();
  const t = ev.matchedThreshold;
  return {
    id: `wa-auto-${d.id}-${Date.now()}`,
    code: `SKM-AUTO-${d.id.toUpperCase().slice(0, 3)}`,
    type: t.type,
    severity: t.severity,
    status: "draft",
    title: `DEMO auto-draft: ${t.severity} risk in ${d.name}`,
    summary: `DEMO: rule automation matched "${t.label}" using synthetic rainfall (${ev.antecedent7dMm} mm / 7 days) and soil moisture (${ev.soilMoisturePct}%).`,
    instructions:
      "DEMO guidance: verify with field units before publishing. This draft is generated from synthetic data.",
    source: "Demo rule engine v0.1 (synthetic inputs)",
    triggerRule: t.label,
    confidencePct: Math.min(95, 40 + Math.round(ev.soilMoisturePct / 2)),
    issuedAt: now,
    expiresAt: new Date(Date.now() + 36 * 3600_000).toISOString(),
    updatedAt: now,
    affectedAreas: [
      {
        id: `aa-auto-${d.id}`,
        district: d.name,
        locality: `${d.name} district centre`,
        lat: d.lat,
        lng: d.lng,
        radiusKm: 8,
        estimatedPopulation: Math.round(d.population * 0.15),
      },
    ],
    languages: ["en", "hi", "ne"],
    channels: ["in-app", "push"],
    acknowledgedBy: [],
    isDemo: true,
  };
}
