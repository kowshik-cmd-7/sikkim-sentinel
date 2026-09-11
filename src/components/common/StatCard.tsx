import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatCardVariant = "default" | "critical" | "high" | "moderate" | "low" | "info";

const variantStyles: Record<StatCardVariant, { border: string; value: string }> = {
  default: { border: "", value: "text-foreground" },
  critical: { border: "border-l-2 border-l-red-500", value: "text-red-300" },
  high: { border: "border-l-2 border-l-orange-500", value: "text-orange-300" },
  moderate: { border: "border-l-2 border-l-amber-500", value: "text-amber-300" },
  low: { border: "border-l-2 border-l-emerald-500", value: "text-emerald-300" },
  info: { border: "border-l-2 border-l-sky-500", value: "text-sky-300" },
};

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "text-sky-400",
  variant = "default",
  className,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  accent?: string;
  variant?: StatCardVariant;
  className?: string;
}) {
  const v = variantStyles[variant];
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-card p-4",
        v.border,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
            {label}
          </p>
          <p className={cn("mt-2 font-mono text-3xl font-bold tabular-nums", v.value)}>
            {value}
          </p>
          {sub && <p className="mt-1 text-xs text-muted-foreground truncate">{sub}</p>}
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/60">
          <Icon className={`h-4 w-4 ${accent}`} />
        </div>
      </div>
    </div>
  );
}
