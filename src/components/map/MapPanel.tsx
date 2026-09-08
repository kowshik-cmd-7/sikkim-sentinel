import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import type { LandslideEvent, RiskCell } from "@/types";
import { RISK_COLORS, RISK_LABELS } from "@/utils/risk";
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

export function MapPanel(props: {
  events?: LandslideEvent[];
  cells?: RiskCell[];
  showGrid?: boolean;
  showEvents?: boolean;
  height?: number;
  zoom?: number;
  onPick?: (lat: number, lng: number) => void;
  marker?: [number, number] | null;
}) {
  const height = props.height ?? 520;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Sikkim risk map</span>
          <DemoBadge label="Demo heatmap" />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {(["low", "moderate", "high", "severe"] as const).map((l) => (
            <span key={l} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: RISK_COLORS[l] }}
              />
              {RISK_LABELS[l]}
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
        Grid squares are a synthetic DEMO risk surface, not model or satellite output.
        Circles are illustrative historical landslide records for the Sikkim pilot area.
      </p>
    </div>
  );
}
