/**
 * DEMO rule automation.
 *
 * Evaluates synthetic rainfall/soil-moisture readings against clearly labelled
 * DEMO thresholds and proposes draft alerts. A future FastAPI + ML service can
 * replace this with POST /api/v1/alerts/evaluate.
 */
import { DISTRICTS, RAINFALL_SERIES } from "@/data/sikkim";
import type { RiskLevel } from "@/types";
import type { AlertType, WarningAlert } from "@/types/alerts";

export interface DemoThreshold {
  id: string;
  label: string;
  type: AlertType;
  severity: RiskLevel;
  antecedent7dMm: number;
  soilMoisturePct: number;
}

/** DEMO THRESHOLDS — illustrative values, not calibrated science. */
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
