import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bell, CloudRain, Mountain, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/services/api";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { DemoNotice } from "@/components/common/DemoBadge";
import { RiskBadge } from "@/components/common/RiskBadge";
import { MapPanel } from "@/components/map/MapPanel";
import { formatDateTime } from "@/utils/risk";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Command Dashboard — NER Landslide Early Warning (Sikkim)" },
      {
        name: "description",
        content:
          "Prototype landslide monitoring dashboard for Sikkim: demo risk map, alerts, rainfall trends and historical events.",
      },
      { property: "og:title", content: "Command Dashboard — NER Landslide Early Warning" },
      {
        property: "og:description",
        content: "Prototype landslide monitoring dashboard for Sikkim. Demo data only.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const events = useQuery({ queryKey: ["events"], queryFn: api.getHistoricalEvents });
  const cells = useQuery({ queryKey: ["grid"], queryFn: api.getRiskGrid });
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: api.getAlerts });
  const rain = useQuery({ queryKey: ["rainfall"], queryFn: api.getRainfall });

  const activeAlerts = (alerts.data ?? []).filter((a) => !a.acknowledged);
  const highCells = (cells.data ?? []).filter(
    (c) => c.level === "high" || c.level === "severe",
  );

  const rainByDate = Object.values(
    (rain.data ?? []).reduce<Record<string, { date: string; mm: number }>>((acc, r) => {
      const cur = acc[r.date] ?? { date: r.date.slice(5), mm: 0 };
      cur.mm += r.rainfallMm;
      acc[r.date] = cur;
      return acc;
    }, {}),
  );

  const eventsByYear = Object.values(
    (events.data ?? []).reduce<Record<string, { year: string; count: number }>>(
      (acc, e) => {
        const y = e.date.slice(0, 4);
        const cur = acc[y] ?? { year: y, count: 0 };
        cur.count += 1;
        acc[y] = cur;
        return acc;
      },
      {},
    ),
  ).sort((a, b) => a.year.localeCompare(b.year));

  return (
    <>
      <PageHeader
        title="Sikkim Command Dashboard"
        description="Prototype early-warning surface for landslide risk in the North Eastern Region. Every number on this screen is synthetic demo data."
      />

      <DemoNotice>
        This is a hackathon prototype. No real AI model, satellite imagery, NASA/ISRO feed
        or IMD gauge is connected. The mock service layer in <code>src/services/api.ts</code>{" "}
        is the future integration point for a FastAPI + ML backend.
      </DemoNotice>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active alerts"
          value={activeAlerts.length}
          sub="Unacknowledged, demo rules"
          icon={Bell}
          accent="text-red-300"
        />
        <StatCard
          label="High / severe cells"
          value={highCells.length}
          sub={`of ${cells.data?.length ?? 0} demo grid cells`}
          icon={AlertTriangle}
          accent="text-orange-300"
        />
        <StatCard
          label="Historical events"
          value={events.data?.length ?? 0}
          sub="Illustrative Sikkim records"
          icon={Mountain}
          accent="text-sky-300"
        />
        <StatCard
          label="24h rainfall (all districts)"
          value={`${Math.round(rainByDate.at(-1)?.mm ?? 0)} mm`}
          sub="Synthetic gauge total"
          icon={CloudRain}
          accent="text-cyan-300"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <MapPanel
            events={events.data ?? []}
            cells={cells.data ?? []}
            height={460}
          />
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium">Latest alerts</h2>
            <Link to="/alerts" className="text-xs text-sky-300 hover:underline">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {(alerts.data ?? []).slice(0, 5).map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{a.district}</span>
                  <RiskBadge level={a.level} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{a.headline}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/70">
                  {formatDateTime(a.issuedAt)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Daily rainfall — last 14 days (demo)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={rainByDate}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="mm" stroke="#38bdf8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Recorded events per year (demo)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={eventsByYear}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="year" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="#f97316" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/assessment"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <TrendingUp className="h-4 w-4" /> Assess a location
        </Link>
        <Link
          to="/report"
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
        >
          Submit a field report
        </Link>
      </div>
    </>
  );
}

export function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      {children}
    </div>
  );
}
