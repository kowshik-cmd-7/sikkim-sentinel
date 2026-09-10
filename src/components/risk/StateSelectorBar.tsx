import { useMemo } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { NER_STATES } from "@/types";

export interface StateSelectorBarProps {
  selectedState: string;
  states: string[];
  onStateChange: (state: string) => void;
  calcStatus: "idle" | "calculating" | "ready" | "error";
  calcProgress: { completed: number; total: number };
  assessedCount: number;
  isBoundaryError?: boolean;
  onRefresh: () => void;
  className?: string;
}

export function StateSelectorBar({
  selectedState,
  states,
  onStateChange,
  calcStatus,
  calcProgress,
  assessedCount,
  isBoundaryError = false,
  onRefresh,
  className,
}: StateSelectorBarProps) {
  // Restrict to ONLY the 8 North Eastern Region (NER) States (SIH Problem 26001)
  const stateOptions = useMemo(() => {
    if (states && states.length > 0) {
      const filtered = NER_STATES.filter((ner) => states.includes(ner));
      if (filtered.length > 0) return filtered;
    }
    return [...NER_STATES];
  }, [states]);

  // Enforce selected state is an NER state; if not, fall back to Sikkim
  const activeSelected = (NER_STATES as readonly string[]).includes(selectedState)
    ? selectedState
    : "Sikkim";

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm space-y-3",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
            Monitoring State / Region
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeSelected}
              onChange={(e) => onStateChange(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {stateOptions.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            {calcStatus === "calculating" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-300">
                <RefreshCw className="h-3 w-3 animate-spin text-sky-400" />
                Calculating state risk… ({calcProgress.completed} / {calcProgress.total} assessed)
              </span>
            )}

            {calcStatus === "ready" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Calculated Heatmap ({assessedCount} locations assessed)
              </span>
            )}

            {isBoundaryError && (
              <span className="inline-flex items-center gap-1 text-xs text-red-400">
                <AlertCircle className="h-3.5 w-3.5" />
                Official boundary service unavailable for {activeSelected}. Check network connection.
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div>
            <span className="text-muted-foreground">Selected State: </span>
            <strong className="text-foreground">{activeSelected}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Risk Map Status: </span>
            <span
              className={cn(
                "font-medium",
                calcStatus === "ready"
                  ? "text-emerald-400"
                  : calcStatus === "calculating"
                    ? "text-sky-400"
                    : "text-amber-400"
              )}
            >
              {calcStatus === "ready"
                ? "Live / Updated"
                : calcStatus === "calculating"
                  ? "Calculating…"
                  : "Ready"}
            </span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={calcStatus === "calculating"}
            className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3 w-3", calcStatus === "calculating" && "animate-spin")} />
            Refresh Risk
          </button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Select an Indian state to fetch official BharatMaps administrative boundaries and evaluate a real-time landslide risk grid using Open-Meteo precipitation, Copernicus 90m DEM elevation/slope, and the trained ML model.
      </p>
    </div>
  );
}
