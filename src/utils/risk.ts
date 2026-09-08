import type { RiskCell, RiskLevel } from "@/types";
import { SIKKIM_CENTER } from "@/data/sikkim";

export function levelFromScore(score: number): RiskLevel {
  if (score >= 75) return "severe";
  if (score >= 55) return "high";
  if (score >= 35) return "moderate";
  return "low";
}

export const RISK_COLORS: Record<RiskLevel, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  severe: "#ef4444",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
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
      const score = Math.round(Math.min(98, Math.max(6, noise * 60 + northBias * 40)));
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
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
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
