import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import type {
  CalculatedRiskPoint,
  FieldReport,
  LandslideEvent,
  MonitoringRiskPoint,
  RiskCell,
  StateBoundaryFeature,
} from "@/types";
import { DemoBadge } from "@/components/common/DemoBadge";

const RiskMap = lazy(() => import("./RiskMap"));

function Skeleton({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-md border border-border bg-muted/30 text-sm text-muted-foreground"
      style={{ height }}
    >
      Loading map…
    </div>
  );
}

import type { AlertCircleConfig } from "./RiskMap";

export function MapPanel(props: {
  events?: LandslideEvent[];
  cells?: RiskCell[];
  showGrid?: boolean;
  showEvents?: boolean;
  height?: number;
  zoom?: number;
  onPick?: (lat: number, lng: number) => void;
  marker?: [number, number] | null;
  alertCircle?: AlertCircleConfig | null;
  heatPoints?: MonitoringRiskPoint[] | undefined;
  calculatedRiskPoints?: CalculatedRiskPoint[] | undefined;
  stateBoundary?: StateBoundaryFeature | null | undefined;
  selectedStateName?: string | undefined;
  selectedPointId?: string | null | undefined;
  onSelectPoint?: ((point: MonitoringRiskPoint) => void) | undefined;
  onSelectCalculatedPoint?: ((point: CalculatedRiskPoint) => void) | undefined;
  fieldReports?: FieldReport[] | undefined;
  selectedReportId?: string | null | undefined;
  onSelectFieldReport?: ((report: FieldReport) => void) | undefined;
  markerLabel?: string | undefined;
}) {
  const height = props.height ?? 520;
  const isDynamicHeatmap = Boolean(
    (props.heatPoints && props.heatPoints.length > 0) ||
      (props.calculatedRiskPoints && props.calculatedRiskPoints.length > 0),
  );

  const title = props.selectedStateName
    ? `${props.selectedStateName} Landslide Risk Heatmap`
    : isDynamicHeatmap
      ? "Sikkim Landslide Risk Heatmap"
      : "Sikkim risk map";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          {isDynamicHeatmap ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Calculated Heatmap
            </span>
          ) : (
            <DemoBadge label="Demo heatmap" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {[
            { label: "Low (0–39)", color: "#10b981" },
            { label: "Moderate (40–59)", color: "#eab308" },
            { label: "High (60–79)", color: "#ea580c" },
            { label: "Very High (80–100)", color: "#dc2626" },
          ].map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: l.color }}
              />
              {l.label}
            </span>
          ))}
        </div>
      </div>
      <ClientOnly fallback={<Skeleton height={height} />}>
        <Suspense fallback={<Skeleton height={height} />}>
          <RiskMap {...props} height={height} />
        </Suspense>
      </ClientOnly>
      <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        {isDynamicHeatmap
          ? "Heat zones indicate calculated landslide risk from real Open-Meteo weather telemetry, Copernicus 90m DEM, and trained ML models. Radius represents monitoring influence area."
          : "Grid squares are a synthetic DEMO risk surface, not model or satellite output. Circles are illustrative historical landslide records."}
      </p>
    </div>
  );
}
