import type { RiskCell, RiskLevel, TerrainAssessment, TerrainSusceptibility } from "@/types";
import { SIKKIM_CENTER } from "@/data/sikkim";

export function levelFromScore(score: number | null | undefined): RiskLevel {
  if (score === null || score === undefined || isNaN(score))
    return "insufficient-data";
  if (score >= 75) return "very-high";
  if (score >= 55) return "high";
  if (score >= 30) return "moderate";
  return "low";
}

export const TERRAIN_SUSCEPTIBILITY_SCORES: Record<TerrainSusceptibility, number> = {
  Low: 0,
  Moderate: 25,
  High: 60,
  "Very High": 90,
};

export const TERRAIN_WEIGHT = 0.35;

export interface HybridRiskResult {
  rainfallRiskScore: number | null;
  rainfallRiskLevel: RiskLevel;
  terrainScore: number;
  terrainSusceptibility: TerrainSusceptibility;
  finalRiskScore: number | null;
  finalRiskLevel: RiskLevel;
  terrainContribution: number;
}

/**
 * Combines rainfall-driven ML risk with real terrain susceptibility.
 *
 * Formula:
 * terrainContribution = terrainScore * (1 - rainfallRiskScore / 100)
 * finalRiskScore = clamp(rainfallRiskScore + terrainContribution * TERRAIN_WEIGHT, 0, 100)
 *
 * Rainfall remains the primary trigger; terrain modifies vulnerability.
 */
export function calculateHybridRisk(
  rainfallRiskScore: number | null | undefined,
  terrain: TerrainAssessment | null | undefined,
): HybridRiskResult {
  if (
    rainfallRiskScore === null ||
    rainfallRiskScore === undefined ||
    Number.isNaN(rainfallRiskScore) ||
    !terrain
  ) {
    const rainfallLevel = levelFromScore(rainfallRiskScore);
    return {
      rainfallRiskScore: rainfallRiskScore ?? null,
      rainfallRiskLevel: rainfallLevel,
      terrainScore: terrain ? (TERRAIN_SUSCEPTIBILITY_SCORES[terrain.terrain_susceptibility] ?? 0) : 0,
      terrainSusceptibility: terrain?.terrain_susceptibility ?? "Low",
      finalRiskScore: null,
      finalRiskLevel: "insufficient-data",
      terrainContribution: 0,
    };
  }

  const terrainScore = TERRAIN_SUSCEPTIBILITY_SCORES[terrain.terrain_susceptibility] ?? 0;
  const terrainContribution = Number((terrainScore * (1 - rainfallRiskScore / 100)).toFixed(2));
  const rawFinalScore = rainfallRiskScore + terrainContribution * TERRAIN_WEIGHT;
  const clampedFinalScore = Math.max(0, Math.min(100, Number(rawFinalScore.toFixed(2))));
  const finalLevel = levelFromScore(clampedFinalScore);
  const rainfallLevel = levelFromScore(rainfallRiskScore);

  return {
    rainfallRiskScore: Number(rainfallRiskScore.toFixed(2)),
    rainfallRiskLevel: rainfallLevel,
    terrainScore,
    terrainSusceptibility: terrain.terrain_susceptibility,
    finalRiskScore: clampedFinalScore,
    finalRiskLevel: finalLevel,
    terrainContribution,
  };
}

export const RISK_COLORS: Record<RiskLevel, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  "very-high": "#ef4444",
  severe: "#ef4444",
  "insufficient-data": "#94a3b8",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  "very-high": "Very High",
  severe: "Very High",
  "insufficient-data": "Insufficient Data",
};

function pseudoRandom(a: number, b: number) {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** DEMO heatmap grid — deterministic synthetic scores, not a model output. */
export function generateRiskGrid(size = 0.05, span = 5): RiskCell[] {
  const [clat, clng] = SIKKIM_CENTER;
  const cells: RiskCell[] = [];
  for (let i = -span; i <= span; i++) {
    for (let j = -span; j <= span; j++) {
      const lat = clat + i * size;
      const lng = clng + j * size;
      const noise = pseudoRandom(i, j);
      const northBias = (i + span) / (2 * span);
      const score = Math.round(
        Math.min(98, Math.max(6, noise * 60 + northBias * 40)),
      );
      cells.push({
        id: `cell-${i}-${j}`,
        lat,
        lng,
        size,
        score,
        level: levelFromScore(score),
      });
    }
  }
  return cells;
}

export function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
