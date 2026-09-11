import { useMemo } from "react";
import { RefreshCw, AlertCircle, Map, CheckCircle2, Loader2 } from "lucide-react";
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

  const progressPct =
    calcProgress.total > 0
      ? Math.round((calcProgress.completed / calcProgress.total) * 100)
      : 0;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card shadow-xs",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        {/* Left: label + selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Map className="h-4 w-4 text-sky-400 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              Monitoring State
            </span>
          </div>

          <select
            value={activeSelected}
            onChange={(e) => onStateChange(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-3 py-0 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
          >
            {stateOptions.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        {/* Center: status */}
        <div className="flex flex-wrap items-center gap-2">
          {calcStatus === "calculating" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-300">
              <Loader2 className="h-3 w-3 animate-spin text-sky-400" />
              Calculating risk… {calcProgress.completed}/{calcProgress.total} ({progressPct}%)
            </span>
          )}

          {calcStatus === "ready" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              Heatmap live · {assessedCount} locations assessed
            </span>
          )}

          {calcStatus === "idle" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
              Select state to calculate
            </span>
          )}

          {isBoundaryError && (
            <span className="inline-flex items-center gap-1 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5" />
              Boundary unavailable — using fallback grid
            </span>
          )}
        </div>

        {/* Right: refresh */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={calcStatus === "calculating"}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={cn("h-3 w-3", calcStatus === "calculating" && "animate-spin")} />
          Refresh Heatmap
        </button>
      </div>

      {/* Progress bar during calculation */}
      {calcStatus === "calculating" && calcProgress.total > 0 && (
        <div className="h-0.5 bg-muted/40 rounded-b-lg overflow-hidden">
          <div
            className="h-full bg-sky-500/70 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </div>
  );
}
