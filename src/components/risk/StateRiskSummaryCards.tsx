import type { StateRiskSummary } from "@/types";
import { cn } from "@/lib/utils";

export interface StateRiskSummaryCardsProps {
  summary: StateRiskSummary;
  className?: string;
}

export function StateRiskSummaryCards({ summary, className }: StateRiskSummaryCardsProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6",
        className
      )}
    >
      <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Monitoring State
        </span>
        <div className="mt-1">
          <p className="text-base font-bold text-foreground truncate">{summary.stateName}</p>
          <span className="text-[10px] text-muted-foreground">Active Territory</span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Locations Assessed
        </span>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-2xl font-bold font-mono text-sky-400">
            {summary.assessedCount}
          </span>
          <span className="text-[10px] text-muted-foreground">grid nodes</span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Low Risk
        </span>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-2xl font-bold font-mono text-emerald-400">
            {summary.lowCount}
          </span>
          <span className="text-[10px] text-muted-foreground">0–39 score</span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Moderate Risk
        </span>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-2xl font-bold font-mono text-yellow-400">
            {summary.moderateCount}
          </span>
          <span className="text-[10px] text-muted-foreground">40–59 score</span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          High Risk
        </span>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-2xl font-bold font-mono text-orange-400">
            {summary.highCount}
          </span>
          <span className="text-[10px] text-muted-foreground">60–79 score</span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Highest Risk
        </span>
        <div className="mt-1 flex items-baseline gap-1">
          <span
            className={cn(
              "text-2xl font-bold font-mono",
              summary.highestRisk >= 80
                ? "text-red-500"
                : summary.highestRisk >= 60
                  ? "text-orange-400"
                  : summary.highestRisk >= 40
                    ? "text-yellow-400"
                    : "text-emerald-400"
            )}
          >
            {summary.highestRisk > 0 ? summary.highestRisk.toFixed(1) : "—"}
          </span>
          <span className="text-[10px] text-muted-foreground">/ 100</span>
        </div>
      </div>
    </div>
  );
}
