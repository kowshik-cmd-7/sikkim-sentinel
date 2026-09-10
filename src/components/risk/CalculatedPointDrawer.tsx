import { Mountain, X } from "lucide-react";
import type { CalculatedRiskPoint } from "@/types";
import { cn } from "@/lib/utils";

export interface CalculatedPointDrawerProps {
  point: CalculatedRiskPoint | null;
  selectedState: string;
  onClose: () => void;
  className?: string;
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
        "rounded-lg border border-primary/40 bg-card p-3 text-xs flex flex-wrap items-center justify-between gap-3 shadow-xs",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Mountain className="h-4 w-4" />
        </div>
        <div>
          <strong className="text-foreground text-sm">
            {point.locationName || `${selectedState} Grid Coordinate`}
          </strong>
          <div className="text-[11px] text-muted-foreground">
            Coordinates: {point.latitude.toFixed(3)}°N, {point.longitude.toFixed(3)}°E ·{" "}
            Elevation: {point.elevation !== null && point.elevation !== undefined ? `${Math.round(point.elevation)}m` : "N/A"} ·{" "}
            Slope: {point.slope !== null && point.slope !== undefined ? `${point.slope.toFixed(1)}°` : "N/A"} (
            {point.terrainSusceptibility || "Moderate"} susceptibility) ·{" "}
            Rainfall 7d: {point.rainfall7d !== null && point.rainfall7d !== undefined ? `${point.rainfall7d.toFixed(1)}mm` : "N/A"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Calculated Risk:</span>
        <span className="font-mono font-bold text-sm text-foreground">
          {point.riskScore !== null ? `${point.riskScore.toFixed(1)} / 100` : "N/A"}
        </span>
        <span
          className={cn(
            "rounded px-2 py-0.5 text-[10px] font-bold text-white uppercase",
            riskScore >= 80
              ? "bg-red-600"
              : riskScore >= 60
                ? "bg-orange-600"
                : riskScore >= 40
                  ? "bg-amber-600"
                  : "bg-emerald-600"
          )}
        >
          {point.riskLevel}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 rounded p-1 text-muted-foreground hover:bg-muted transition-colors"
          title="Dismiss point inspection"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
