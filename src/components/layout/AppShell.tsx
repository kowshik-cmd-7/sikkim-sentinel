import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  CloudRain,
  Crosshair,
  LayoutDashboard,
  Menu,
  Mountain,
  Table2,
  ClipboardList,
  X,
  Radio,
} from "lucide-react";
import { DemoBadge } from "@/components/common/DemoBadge";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assessment", label: "Assessment", icon: Crosshair, highlight: true },
  { to: "/alerts", label: "Early Warning & Alerts", icon: Bell, highlight: true },
  { to: "/rainfall", label: "Rainfall Intelligence", icon: CloudRain },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/historical", label: "Historical Events", icon: Table2 },
  { to: "/report", label: "Field Reporting", icon: ClipboardList },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top header bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex h-14 items-center gap-3 px-4">
          <button
            className="rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500/15 border border-sky-500/30">
              <Mountain className="h-4 w-4 text-sky-400" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-foreground leading-none">
                Sikkim Sentinel
              </p>
              <p className="truncate text-[10px] text-muted-foreground leading-none mt-0.5">
                NER Landslide Early Warning · SIH 26001
              </p>
            </div>
          </div>

          {/* Status indicators */}
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-[11px] font-medium text-emerald-300 sm:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live ML Service
            </span>
            <span className="hidden items-center gap-1.5 text-[11px] font-medium text-sky-300 sm:flex">
              <Radio className="h-3 w-3" />
              8 NER States
            </span>
            <DemoBadge label="SIH Demo" />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            open ? "block" : "hidden"
          } fixed inset-x-0 top-14 z-30 border-b border-border bg-card p-2 lg:static lg:block lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r lg:p-3`}
        >
          <nav className="grid gap-0.5">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                activeOptions={{ exact: item.to === "/" }}
                activeProps={{
                  className:
                    "bg-accent text-foreground border-l-2 border-primary pl-[10px]",
                }}
                inactiveProps={{
                  className:
                    "text-muted-foreground hover:bg-accent/50 hover:text-foreground border-l-2 border-transparent pl-[10px]",
                }}
                className="flex items-center gap-2.5 rounded-r-md py-2 pr-3 text-sm transition-colors"
              >
                <item.icon
                  className={`h-4 w-4 shrink-0 ${"highlight" in item && item.highlight ? "text-sky-400" : ""}`}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* System info footer */}
          <div className="mt-4 space-y-2">
            <div className="rounded-md border border-border bg-background/60 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                System
              </p>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">ML Model</span>
                  <span className="text-emerald-400 font-medium">GBR Active</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Rainfall</span>
                  <span className="text-emerald-400 font-medium">Open-Meteo</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Elevation</span>
                  <span className="text-emerald-400 font-medium">Copernicus DEM</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Boundaries</span>
                  <span className="text-emerald-400 font-medium">BharatMaps</span>
                </div>
              </div>
            </div>

            <p className="text-[9px] leading-relaxed text-muted-foreground/70 px-1">
              SIH Problem Statement 26001 · AI-Based Early Warning &amp;
              Landslide Risk Monitoring System for NER
            </p>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-7xl space-y-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
