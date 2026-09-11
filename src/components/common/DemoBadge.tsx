import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function DemoBadge({ className, label = "SCENARIO DATA" }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-400",
        className,
      )}
    >
      <AlertTriangle className="h-3 w-3" />
      {label}
    </span>
  );
}

export function DemoNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
      <p>{children}</p>
    </div>
  );
}
