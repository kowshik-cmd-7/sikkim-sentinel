import type { LucideIcon } from "lucide-react";
import { DemoBadge } from "./DemoBadge";

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "text-sky-300",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  accent?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-mono text-3xl font-semibold text-foreground">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <Icon className={`h-5 w-5 ${accent}`} />
      </div>
      <DemoBadge className="mt-3" />
    </div>
  );
}
