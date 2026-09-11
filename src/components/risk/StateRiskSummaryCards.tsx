import type { StateRiskSummary } from "@/types";
import { cn } from "@/lib/utils";
import { MapPin, TrendingUp, AlertTriangle, ShieldAlert, Activity, CheckCircle2 } from "lucide-react";

export interface StateRiskSummaryCardsProps {
  summary: StateRiskSummary;
  className?: string;
}

const CARD = "rounded-lg border border-border bg-card p-3.5 shadow-xs";
const LABEL = "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground";
const NUM_BASE = "text-2xl font-bold font-mono tabular-nums";

export function StateRiskSummaryCards({ summary, className }: StateRiskSummaryCardsProps) {
  const veryHighCount = summary.assessedCount > 0
    ? Math.max(0, summary.assessedCount - summary.lowCount - summary.moderateCount - summary.highCount)
    : 0;

  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6", className)}>
      {/* Monitoring State */}
      <div className={cn(CARD, "border-l-2 border-l-sky-500")}>
        <div className="flex items-center gap-1.5 mb-2">
          <MapPin className="h-3.5 w-3.5 text-sky-400 shrink-0" />
          <span className={LABEL}>Monitoring</span>
        </div>
        <p className="text-sm font-bold text-foreground truncate leading-tight">{summary.stateName}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">NER State</p>
      </div>

      {/* Locations Assessed */}
      <div className={CARD}>
        <div className="flex items-center gap-1.5 mb-2">
          <Activity className="h-3.5 w-3.5 text-sky-400 shrink-0" />
          <span className={LABEL}>Assessed</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn(NUM_BASE, "text-sky-400")}>{summary.assessedCount}</span>
          <span className="text-[10px] text-muted-foreground">nodes</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">Grid locations</p>
      </div>

      {/* Low Risk */}
      <div className={CARD}>
        <div className="flex items-center gap-1.5 mb-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span className={LABEL}>Low Risk</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn(NUM_BASE, "text-emerald-400")}>{summary.lowCount}</span>
          <span className="text-[10px] text-muted-foreground">zones</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">Score 0–39</p>
      </div>

      {/* Moderate Risk */}
      <div className={CARD}>
        <div className="flex items-center gap-1.5 mb-2">
          <TrendingUp className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
          <span className={LABEL}>Moderate</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn(NUM_BASE, "text-yellow-400")}>{summary.moderateCount}</span>
          <span className="text-[10px] text-muted-foreground">zones</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">Score 40–59</p>
      </div>

      {/* High Risk */}
      <div className={CARD}>
        <div className="flex items-center gap-1.5 mb-2">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-400 shrink-0" />
          <span className={LABEL}>High Risk</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn(NUM_BASE, "text-orange-400")}>{summary.highCount}</span>
          <span className="text-[10px] text-muted-foreground">zones</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">Score 60–79</p>
      </div>

      {/* Highest Risk */}
      <div className={cn(CARD, summary.highestRisk >= 80 ? "border-l-2 border-l-red-500" : summary.highestRisk >= 60 ? "border-l-2 border-l-orange-500" : "")}>
        <div className="flex items-center gap-1.5 mb-2">
          <ShieldAlert className="h-3.5 w-3.5 text-red-400 shrink-0" />
          <span className={LABEL}>Peak Risk</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              NUM_BASE,
              summary.highestRisk >= 80
                ? "text-red-400"
                : summary.highestRisk >= 60
                  ? "text-orange-400"
                  : summary.highestRisk >= 40
                    ? "text-yellow-400"
                    : "text-emerald-400",
            )}
          >
            {summary.highestRisk > 0 ? summary.highestRisk.toFixed(1) : "—"}
          </span>
          <span className="text-[10px] text-muted-foreground">/ 100</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {veryHighCount > 0 ? `${veryHighCount} Very High zone${veryHighCount > 1 ? "s" : ""}` : "Highest recorded"}
        </p>
      </div>
    </div>
  );
}
