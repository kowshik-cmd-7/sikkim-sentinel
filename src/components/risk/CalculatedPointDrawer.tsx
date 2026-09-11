import { Link } from "@tanstack/react-router";
import { MapPin, Mountain, X, TrendingUp } from "lucide-react";
import type { CalculatedRiskPoint } from "@/types";
import { cn } from "@/lib/utils";

export interface CalculatedPointDrawerProps {
  point: CalculatedRiskPoint | null;
  selectedState: string;
  onClose: () => void;
  className?: string;
}

function riskBg(score: number) {
  if (score >= 80) return "bg-red-600";
  if (score >= 60) return "bg-orange-600";
  if (score >= 40) return "bg-amber-600";
  return "bg-emerald-600";
}

function riskBorder(score: number) {
  if (score >= 80) return "border-red-500/40 bg-red-500/5";
  if (score >= 60) return "border-orange-500/40 bg-orange-500/5";
  if (score >= 40) return "border-amber-500/40 bg-amber-500/5";
  return "border-emerald-500/40 bg-emerald-500/5";
}

export function CalculatedPointDrawer({
  point,
  selectedState,
  onClose,
  className,
}: CalculatedPointDrawerProps) {
  if (!point) return null;

  const riskScore = point.riskScore ?? 0;

  return (
    <div
      className={cn(
        "rounded-lg border p-4 text-xs shadow-sm",
        riskBorder(riskScore),
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Left: location info */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/60">
            <Mountain className="h-4 w-4 text-sky-400" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-foreground text-sm">
                {point.locationName || `${selectedState} Grid Node`}
              </strong>
              <span
                className={cn(
                  "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold text-white uppercase",
                  riskBg(riskScore),
                )}
              >
                {point.riskLevel}
              </span>
              {point.riskScore !== null && (
                <span className="font-mono font-bold text-sm text-foreground">
                  {point.riskScore.toFixed(1)}
                  <span className="text-[10px] font-normal text-muted-foreground"> / 100</span>
                </span>
              )}
            </div>
            {/* Telemetry row */}
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {point.latitude.toFixed(4)}°N, {point.longitude.toFixed(4)}°E
              </span>
              {point.elevation != null && (
                <span>⬆ {Math.round(point.elevation)}m elev.</span>
              )}
              {point.slope != null && (
                <span>↗ {point.slope.toFixed(1)}° slope ({point.terrainSusceptibility || "Moderate"})</span>
              )}
              {point.rainfall7d != null && (
                <span>🌧 {point.rainfall7d.toFixed(1)}mm (7d)</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/assessment"
            search={{
              lat: Number(point.latitude.toFixed(4)),
              lng: Number(point.longitude.toFixed(4)),
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Full Assessment
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
