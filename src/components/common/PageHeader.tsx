import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  badge,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
      <div className="space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Compact section heading for use inside pages */
export function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  className,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2", className)}>
      <div>
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-sky-400 shrink-0" />}
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        </div>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

/** Live data connected notice (replaces DemoNotice on live-data pages) */
export function LiveDataNotice({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs text-sky-200/80">
      <span className="relative flex h-2 w-2 mt-0.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
      </span>
      <p>
        {children ??
          "Connected to live Python FastAPI service. Rainfall, elevation and forecast data fetched in real time via Open-Meteo and Copernicus DEM."}
      </p>
    </div>
  );
}
