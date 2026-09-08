import type { RiskLevel } from "@/types";
import { RISK_LABELS } from "@/utils/risk";
import { cn } from "@/lib/utils";

const styles: Record<RiskLevel, string> = {
  low: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  moderate: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
  high: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  severe: "border-red-500/40 bg-red-500/10 text-red-300",
};

export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        styles[level],
        className,
      )}
    >
      {RISK_LABELS[level]}
    </span>
  );
}
