/**
 * Alert Generation & Management Service for Sikkim Sentinel.
 *
 * Implements the alert-generation layer based on the existing hybrid risk results:
 * - HIGH: final hybrid risk >= 60
 * - VERY HIGH: final hybrid risk >= 80
 *
 * Supports sources: Current risk, Next 6h, Next 24h, Next 48h, Next 72h.
 * Manages status transitions (ACTIVE -> SENT -> ACKNOWLEDGED -> RESOLVED) and localStorage persistence.
 */

import type {
  DashboardAlert,
  DashboardAlertHorizon,
  DashboardAlertSeverity,
  DashboardAlertStatus,
  LocationAssessment,
  TerrainAssessment,
} from "@/types";
import type { HorizonRiskAssessment } from "@/services/api";
import { findNearbyFacilities } from "@/data/facilities";

export const DEFAULT_ALERT_RADIUS_KM = 5;
export const ALERT_STORAGE_KEY = "sikkim-sentinel-alerts";
export const ALERT_THRESHOLD_HIGH = 60.0;
export const ALERT_THRESHOLD_VERY_HIGH = 80.0;
export const DEFAULT_ALERT_EXPIRY_HOURS = 24;
export const ALERT_EXPIRY_OPTIONS = [6, 12, 24, 48, 72] as const;
export type AlertExpiryOption = (typeof ALERT_EXPIRY_OPTIONS)[number];

export interface RecommendedContact {
  role: string;
  name: string;
  contact: string;
  category: "authority" | "police" | "admin" | "health" | "roads";
  isOfficialHelpline: boolean;
}

/**
 * Builds a dynamic human-readable message based on score, location, horizon and topography.
 */
export function generateHumanReadableMessage(params: {
  severity: DashboardAlertSeverity;
  score: number;
  locationLabel: string;
  horizon: DashboardAlertHorizon;
  slopeDegrees?: number | undefined;
  slopeClassification?: string | undefined;
  rainfallMm: number;
  isDemo?: boolean | undefined;
}): string {
  const {
    severity,
    score,
    locationLabel,
    horizon,
    slopeDegrees,
    slopeClassification,
    rainfallMm,
    isDemo,
  } = params;

  const prefix = isDemo ? "[DEMO] " : "";
  const slopeDesc =
    slopeDegrees !== undefined && slopeDegrees > 0
      ? `${slopeDegrees.toFixed(1)}° ${slopeClassification || "steep"} terrain`
      : "steep mountain terrain";
  const rainDesc = `${rainfallMm.toFixed(1)} mm rainfall`;

  if (horizon === "CURRENT") {
    if (severity === "VERY_HIGH") {
      return `${prefix}VERY HIGH LANDSLIDE RISK detected near ${locationLabel}. Current hybrid risk is ${score.toFixed(1)}%. ${slopeDesc} combined with ${rainDesc} may increase slope instability. Authorities should monitor the area and consider precautionary action.`;
    }
    return `${prefix}HIGH LANDSLIDE RISK detected near ${locationLabel}. Hybrid risk is ${score.toFixed(1)}%. Rainfall (${rainDesc}) and terrain conditions indicate elevated slope instability. Increased monitoring is recommended.`;
  }

  const horizonHours = horizon.replace("H", "");
  const sevLabel = severity === "VERY_HIGH" ? "Very high" : "High";

  if (horizon === "6H") {
    return `${prefix}${sevLabel} landslide risk (${score.toFixed(1)}%) is projected within the next 6 hours near ${locationLabel} based on forecast rainfall (${rainDesc}) and terrain susceptibility.`;
  }

  return `${prefix}${sevLabel} landslide risk (${score.toFixed(1)}%) is projected within the next ${horizonHours} hours near ${locationLabel} based on cumulative forecast precipitation (${rainDesc}).`;
}

/**
 * Evaluates current hybrid risk assessment and 4 future horizons to automatically
 * generate alerts whenever final hybrid risk >= 60 (HIGH) or >= 80 (VERY HIGH).
 */
export function generateAlertsFromRiskResults(params: {
  locationLabel: string;
  lat: number;
  lng: number;
  currentAssessment?: LocationAssessment | null | undefined;
  forecastHorizons?: HorizonRiskAssessment[] | null | undefined;
  terrain?: TerrainAssessment | null | undefined;
  radiusKm?: number | undefined;
  expiryDurationHours?: number | undefined;
}): DashboardAlert[] {
  const {
    locationLabel,
    lat,
    lng,
    currentAssessment,
    forecastHorizons = [],
    terrain,
    radiusKm = DEFAULT_ALERT_RADIUS_KM,
    expiryDurationHours = DEFAULT_ALERT_EXPIRY_HOURS,
  } = params;

  const alerts: DashboardAlert[] = [];
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiryDurationHours * 3600 * 1000).toISOString();
  const expiryDuration = `${expiryDurationHours}h`;

  // 1. Evaluate Current Risk
  const currentFinalScore =
    currentAssessment?.finalRiskScore ?? currentAssessment?.score ?? null;

  if (currentFinalScore !== null && currentFinalScore >= ALERT_THRESHOLD_HIGH) {
    const severity: DashboardAlertSeverity =
      currentFinalScore >= ALERT_THRESHOLD_VERY_HIGH ? "VERY_HIGH" : "HIGH";

    const rainfallVal = currentAssessment?.rainfallInputs?.rainfall_7d ?? 0;
    const slopeVal = terrain?.slope_degrees ?? currentAssessment?.terrainAssessment?.slope_degrees;
    const elevVal = terrain?.elevation_m ?? currentAssessment?.terrainAssessment?.elevation_m;
    const slopeClass = terrain?.slope_category ?? currentAssessment?.terrainAssessment?.slope_category;

    alerts.push({
      id: `alert-${lat.toFixed(3)}-${lng.toFixed(3)}-CURRENT`,
      severity,
      status: "ACTIVE",
      notificationStatus: "NOT_SENT",
      latitude: lat,
      longitude: lng,
      locationLabel,
      horizon: "CURRENT",
      riskScore: Number(currentFinalScore.toFixed(1)),
      riskLevel: severity === "VERY_HIGH" ? "Very High" : "High",
      rainfallRiskScore: Number((currentAssessment?.rainfallRiskScore ?? currentFinalScore).toFixed(1)),
      terrainScore: currentAssessment?.terrainScore ?? 0,
      terrainSusceptibility: currentAssessment?.terrainAssessment?.terrain_susceptibility ?? terrain?.terrain_susceptibility ?? "Moderate",
      terrainContribution: currentAssessment?.terrainContribution ?? 0,
      finalRiskScore: Number(currentFinalScore.toFixed(1)),
      finalRiskLevel: severity === "VERY_HIGH" ? "Very High" : "High",
      rainfall: Number(rainfallVal.toFixed(1)),
      elevation: elevVal !== undefined ? Math.round(elevVal) : undefined,
      slope: slopeVal !== undefined ? Number(slopeVal.toFixed(1)) : undefined,
      slopeClassification: slopeClass,
      radiusKm,
      message: generateHumanReadableMessage({
        severity,
        score: currentFinalScore,
        locationLabel,
        horizon: "CURRENT",
        slopeDegrees: slopeVal,
        slopeClassification: slopeClass,
        rainfallMm: rainfallVal,
      }),
      createdAt: now,
      expiresAt,
      expiryDuration,
    });
  }

  // 2. Evaluate Forecast Horizons (6h, 24h, 48h, 72h)
  const horizonMap: Record<string, DashboardAlertHorizon> = {
    "6h": "6H",
    "24h": "24H",
    "48h": "48H",
    "72h": "72H",
  };

  for (const h of forecastHorizons || []) {
    const horizonKey = horizonMap[h.key];
    if (!horizonKey) continue;

    const score = h.finalRiskScore ?? h.riskScore;
    if (score !== null && score !== undefined && score >= ALERT_THRESHOLD_HIGH) {
      const severity: DashboardAlertSeverity =
        score >= ALERT_THRESHOLD_VERY_HIGH ? "VERY_HIGH" : "HIGH";

      const slopeVal = h.slopeDegrees ?? terrain?.slope_degrees;
      const elevVal = h.elevationM ?? terrain?.elevation_m;
      const slopeClass = h.slopeCategory ?? terrain?.slope_category;
      const rainfallVal = h.forecastRainfallMm;

      alerts.push({
        id: `alert-${lat.toFixed(3)}-${lng.toFixed(3)}-${horizonKey}`,
        severity,
        status: "ACTIVE",
        notificationStatus: "NOT_SENT",
        latitude: lat,
        longitude: lng,
        locationLabel,
        horizon: horizonKey,
        riskScore: Number(score.toFixed(1)),
        riskLevel: severity === "VERY_HIGH" ? "Very High" : "High",
        rainfallRiskScore: Number((h.rainfallRiskScore ?? score).toFixed(1)),
        terrainScore: h.terrainScore,
        terrainSusceptibility: h.terrainSusceptibility,
        terrainContribution: h.terrainContribution,
        finalRiskScore: Number(score.toFixed(1)),
        finalRiskLevel: severity === "VERY_HIGH" ? "Very High" : "High",
        rainfall: Number(rainfallVal.toFixed(1)),
        elevation: elevVal !== null && elevVal !== undefined ? Math.round(elevVal) : undefined,
        slope: slopeVal !== null && slopeVal !== undefined ? Number(slopeVal.toFixed(1)) : undefined,
        slopeClassification: slopeClass,
        radiusKm,
        message: generateHumanReadableMessage({
          severity,
          score,
          locationLabel,
          horizon: horizonKey,
          slopeDegrees: slopeVal ?? undefined,
          slopeClassification: slopeClass,
          rainfallMm: rainfallVal,
        }),
        createdAt: now,
        expiresAt,
        expiryDuration,
      });
    }
  }

  return alerts;
}

/**
 * Returns recommended response contacts for the given coordinate and district.
 * Uses authentic government helplines (112, 1070, 1077) or clearly labeled demo contacts.
 */
export function getRecommendedContacts(
  latitude: number,
  longitude: number,
  district: string = "Sikkim",
): RecommendedContact[] {
  const nearby = findNearbyFacilities(latitude, longitude, 15);
  const auth = nearby.find((f) => f.type === "authority");
  const hosp = nearby.find((f) => f.type === "hospital");

  return [
    {
      role: "District Disaster Management Authority (DDMA)",
      name: auth?.name || `DDMA ${district} Control Room`,
      contact: "1077 / 03592-284444 (Official DEOC Helpline)",
      category: "authority",
      isOfficialHelpline: true,
    },
    {
      role: "Police Emergency Response Support System (ERSS)",
      name: "Sikkim Police Emergency Dispatch",
      contact: "112 / 100 (Official National ERSS Helpline)",
      category: "police",
      isOfficialHelpline: true,
    },
    {
      role: "State Emergency Operation Centre (SSDMA)",
      name: "Sikkim State Disaster Management Authority",
      contact: "1070 / 03592-202461 (Official State SEOC)",
      category: "authority",
      isOfficialHelpline: true,
    },
    {
      role: "District Health & Referral Hospital",
      name: hosp?.name || `${district} District Hospital`,
      contact: hosp?.contact || "Demo contact — replace with official number",
      category: "health",
      isOfficialHelpline: false,
    },
    {
      role: "Road & Highway Maintenance (BRO / PWD)",
      name: "Sikkim Border Roads / PWD Hill Highway Cell",
      contact: "Contact information configured by local authorities (Demo contact)",
      category: "roads",
      isOfficialHelpline: false,
    },
  ];
}

/**
 * Evaluates expiration timestamps and transitions alerts to EXPIRED if now >= expiresAt.
 * Also performs backwards-compatible migration for alerts without expiresAt.
 */
export function checkAndExpireAlerts(alerts: DashboardAlert[]): {
  updated: DashboardAlert[];
  hasChanges: boolean;
} {
  const nowMs = Date.now();
  let hasChanges = false;

  const updated = alerts.map((alert) => {
    let changed = false;
    let expiresAt = alert.expiresAt;
    let expiryDuration = alert.expiryDuration || "24h";

    // Backward compatibility: migrate missing expiresAt (default 24h from createdAt or now)
    if (!expiresAt) {
      const createdMs = alert.createdAt ? new Date(alert.createdAt).getTime() : nowMs;
      expiresAt = new Date(createdMs + DEFAULT_ALERT_EXPIRY_HOURS * 3600 * 1000).toISOString();
      changed = true;
    }

    let status = alert.status;
    // Expire if beyond expiry timestamp and not already resolved
    if (status !== "RESOLVED" && status !== "EXPIRED") {
      const expiryMs = new Date(expiresAt).getTime();
      if (!isNaN(expiryMs) && expiryMs <= nowMs) {
        status = "EXPIRED";
        changed = true;
      }
    }

    if (changed) {
      hasChanges = true;
      return {
        ...alert,
        status,
        expiresAt,
        expiryDuration,
      };
    }
    return alert;
  });

  return { updated, hasChanges };
}

/**
 * Formats time remaining until alert expiration for UI display.
 */
export function formatExpiresIn(expiresAt: string | undefined): string {
  if (!expiresAt) return "—";
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return "Expired";
  const hours = Math.floor(diffMs / (3600 * 1000));
  const mins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
  if (hours > 0) {
    return `Expires in ${hours}h ${mins}m`;
  }
  return `Expires in ${mins}m`;
}

/**
 * Permanently removes an alert from localStorage.
 */
export function deleteStoredAlert(
  alertId: string,
  alertsList: DashboardAlert[],
): DashboardAlert[] {
  const updated = alertsList.filter((a) => a.id !== alertId);
  saveStoredAlerts(updated);
  return updated;
}

/**
 * Retrieves alerts stored in localStorage, automatically running migration and expiration checks.
 */
export function getStoredAlerts(): DashboardAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ALERT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: DashboardAlert[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const { updated, hasChanges } = checkAndExpireAlerts(parsed);
    if (hasChanges) {
      saveStoredAlerts(updated);
    }
    return updated;
  } catch (err) {
    console.error("Failed to load alerts from localStorage:", err);
    return [];
  }
}

/**
 * Saves alerts array to localStorage.
 */
export function saveStoredAlerts(alerts: DashboardAlert[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(alerts));
  } catch (err) {
    console.error("Failed to save alerts to localStorage:", err);
  }
}

/**
 * Merges newly generated alerts with existing stored alerts.
 * Preserves user-updated status (SENT, ACKNOWLEDGED, RESOLVED, EXPIRED) and timestamps.
 */
export function mergeGeneratedAlerts(
  existingAlerts: DashboardAlert[],
  newAlerts: DashboardAlert[],
): DashboardAlert[] {
  const alertMap = new Map<string, DashboardAlert>();

  // 1. Put existing alerts in map
  for (const a of existingAlerts) {
    alertMap.set(a.id, a);
  }

  // 2. Merge incoming alerts
  for (const n of newAlerts) {
    const existing = alertMap.get(n.id);
    if (existing) {
      // Keep existing status and timestamps; update latest dynamic risk telemetry
      alertMap.set(n.id, {
        ...n,
        status: existing.status,
        notificationStatus: existing.notificationStatus,
        sentAt: existing.sentAt,
        acknowledgedAt: existing.acknowledgedAt,
        resolvedAt: existing.resolvedAt,
        expiresAt: existing.expiresAt || n.expiresAt,
        expiryDuration: existing.expiryDuration || n.expiryDuration,
        isDemo: existing.isDemo,
      });
    } else {
      // New alert
      alertMap.set(n.id, n);
    }
  }

  return Array.from(alertMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Handles valid status transitions:
 * Active -> Sent -> Acknowledged -> Resolved
 */
export function updateStoredAlertStatus(
  alertId: string,
  targetStatus: DashboardAlertStatus,
  alertsList: DashboardAlert[],
): { success: boolean; updatedList: DashboardAlert[]; message?: string } {
  const targetAlert = alertsList.find((a) => a.id === alertId);
  if (!targetAlert) {
    return { success: false, updatedList: alertsList, message: "Alert not found" };
  }

  const current = targetAlert.status;
  const now = new Date().toISOString();

  // Prevent transitions for expired alerts
  if (current === "EXPIRED") {
    return {
      success: false,
      updatedList: alertsList,
      message: "Expired alerts cannot be transitioned or acknowledged",
    };
  }

  // Validate state transitions
  if (targetStatus === "SENT") {
    if (current !== "ACTIVE") {
      return { success: false, updatedList: alertsList, message: `Cannot transition from ${current} to SENT` };
    }
    const updated = alertsList.map((a) =>
      a.id === alertId
        ? {
            ...a,
            status: "SENT" as DashboardAlertStatus,
            notificationStatus: "SENT" as const,
            sentAt: now,
          }
        : a,
    );
    saveStoredAlerts(updated);
    return { success: true, updatedList: updated };
  }

  if (targetStatus === "ACKNOWLEDGED") {
    if (current !== "ACTIVE" && current !== "SENT") {
      return { success: false, updatedList: alertsList, message: `Cannot transition from ${current} to ACKNOWLEDGED` };
    }
    const updated = alertsList.map((a) =>
      a.id === alertId
        ? {
            ...a,
            status: "ACKNOWLEDGED" as DashboardAlertStatus,
            acknowledgedAt: now,
          }
        : a,
    );
    saveStoredAlerts(updated);
    return { success: true, updatedList: updated };
  }

  if (targetStatus === "RESOLVED") {
    if (current !== "ACKNOWLEDGED" && current !== "SENT" && current !== "ACTIVE") {
      return { success: false, updatedList: alertsList, message: `Cannot transition from ${current} to RESOLVED` };
    }
    const updated = alertsList.map((a) =>
      a.id === alertId
        ? {
            ...a,
            status: "RESOLVED" as DashboardAlertStatus,
            resolvedAt: now,
          }
        : a,
    );
    saveStoredAlerts(updated);
    return { success: true, updatedList: updated };
  }

  return { success: false, updatedList: alertsList, message: "Invalid status transition" };
}

/**
 * Creates a simulated DEMO alert for presentation purposes.
 * Clearly tagged with isDemo = true.
 */
export function createDemoSimulatedAlert(
  locationLabel: string,
  lat: number,
  lng: number,
  severity: "HIGH" | "VERY_HIGH",
  expiryDurationHours: number = DEFAULT_ALERT_EXPIRY_HOURS,
): DashboardAlert {
  const isVeryHigh = severity === "VERY_HIGH";
  const finalRiskScore = isVeryHigh ? 84.5 : 68.2;
  const rainfallRiskScore = isVeryHigh ? 78.0 : 58.0;
  const terrainScore = 90;
  const terrainContribution = 18.5;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiryDurationHours * 3600 * 1000).toISOString();
  const id = `demo-alert-${Date.now()}`;

  return {
    id,
    severity,
    status: "ACTIVE",
    notificationStatus: "NOT_SENT",
    latitude: lat,
    longitude: lng,
    locationLabel: `${locationLabel} (Demo Sector)`,
    horizon: isVeryHigh ? "6H" : "24H",
    riskScore: finalRiskScore,
    riskLevel: isVeryHigh ? "Very High" : "High",
    rainfallRiskScore,
    terrainScore,
    terrainSusceptibility: "Very High",
    terrainContribution,
    finalRiskScore,
    finalRiskLevel: isVeryHigh ? "Very High" : "High",
    rainfall: isVeryHigh ? 52.4 : 38.0,
    elevation: 2450,
    slope: 42.5,
    slopeClassification: "Very Steep",
    radiusKm: DEFAULT_ALERT_RADIUS_KM,
    message: generateHumanReadableMessage({
      severity,
      score: finalRiskScore,
      locationLabel,
      horizon: isVeryHigh ? "6H" : "24H",
      slopeDegrees: 42.5,
      slopeClassification: "Very Steep",
      rainfallMm: isVeryHigh ? 52.4 : 38.0,
      isDemo: true,
    }),
    createdAt: now,
    expiresAt,
    expiryDuration: `${expiryDurationHours}h`,
    isDemo: true,
  };
}
