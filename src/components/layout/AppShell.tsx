import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  CloudRain,
  Crosshair,
  LayoutDashboard,
  Map,
  Menu,
  Mountain,
  Table2,
  ClipboardList,
  X,
} from "lucide-react";
import { DemoBadge } from "@/components/common/DemoBadge";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/map", label: "Risk Map", icon: Map },
  { to: "/assessment", label: "Location Assessment", icon: Crosshair },
  { to: "/historical", label: "Historical Events", icon: Table2 },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/rainfall", label: "Rainfall", icon: CloudRain },
  { to: "/report", label: "Field Reporting", icon: ClipboardList },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4">
          <button
            className="rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <Mountain className="h-5 w-5 text-sky-400" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">
              NER Landslide Early Warning
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              Sikkim pilot · prototype command centre
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-xs text-emerald-300 sm:flex">
              <Activity className="h-3.5 w-3.5" /> Mock service online
            </span>
            <DemoBadge label="Demo build" />
          </div>
        </div>
      </header>

      <div className="flex">
        <aside
          className={`${open ? "block" : "hidden"} fixed inset-x-0 top-14 z-30 border-b border-border bg-card p-2 lg:static lg:block lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r lg:p-3`}
        >
          <nav className="grid gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                activeOptions={{ exact: item.to === "/" }}
                activeProps={{ className: "bg-accent text-foreground" }}
                inactiveProps={{ className: "text-muted-foreground hover:bg-accent/60" }}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <p className="mt-4 rounded-md border border-border bg-background/60 p-2 text-[10px] leading-relaxed text-muted-foreground">
            All figures shown are synthetic demo values. No live satellite, IMD or GSI
            feed is connected and no trained model is running.
          </p>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-7xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
