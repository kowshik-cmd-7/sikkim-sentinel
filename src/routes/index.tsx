import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bell, CloudRain, Mountain, TrendingUp, Radio } from "lucide-react";
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
          "Prototype landslide monitoring dashboard for Sikkim: risk map, alerts, rainfall trends, historical events and emergency priorities.",
      },
      { property: "og:title", content: "Command Dashboard — NER Landslide Early Warning" },
      {
        property: "og:description",
        content: "Prototype landslide monitoring dashboard for Sikkim.",
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
    (c) => c.level === "high" || c.level === "very-high" || c.level === "severe",
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

  const forecast = rainByDate.slice(-7).map((r, i, rows) => {
    const previous = rows[i - 1]?.mm ?? r.mm;
    return {
      date: r.date,
      risk: Math.min(100, Math.round(20 + r.mm * 0.75 + Math.max(0, r.mm - previous) * 0.35)),
    };
  });

  const priorities = [
    {
      district: "Mangan (North)",
      level: "very-high" as const,
      asset: "NH-10 / North Sikkim corridor",
      action: "Traffic inspection + drainage check",
    },
    {
      district: "Gangtok",
      level: "high" as const,
      asset: "Ranipool cut slopes",
      action: "Deploy field verification team",
    },
    {
      district: "Namchi (South)",
      level: "high" as const,
      asset: "Melli road / riverbank",
      action: "Monitor connectivity and debris",
    },
  ];

  return (
    <>
      <PageHeader
        title="Sikkim Command Dashboard"
        description="Prototype early-warning surface for landslide risk in the North Eastern Region."
      />

      <DemoNotice>
        Hackathon prototype: risk prediction is connected to the trained rainfall ML service on
        the Assessment page. GIS cells, alerts and operational context below remain demo data.
      </DemoNotice>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active alerts" value={activeAlerts.length} sub="Unacknowledged alerts" icon={Bell} accent="text-red-300" />
        <StatCard label="High / very-high cells" value={highCells.length} sub={`of ${cells.data?.length ?? 0} demo grid cells`} icon={AlertTriangle} accent="text-orange-300" />
        <StatCard label="Historical events" value={events.data?.length ?? 0} sub="Illustrative Sikkim records" icon={Mountain} accent="text-sky-300" />
        <StatCard label="Latest rainfall" value={`${Math.round(rainByDate.at(-1)?.mm ?? 0)} mm`} sub="All districts — demo series" icon={CloudRain} accent="text-cyan-300" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <MapPanel events={events.data ?? []} cells={cells.data ?? []} height={460} />
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium">Latest alerts</h2>
            <Link to="/alerts" className="text-xs text-sky-300 hover:underline">View all</Link>
          </div>
          <ul className="divide-y divide-border">
            {(alerts.data ?? []).slice(0, 5).map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{a.district}</span>
                  <RiskBadge level={a.level} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{a.headline}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/70">{formatDateTime(a.issuedAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium">Emergency response priority</h2>
              <p className="text-xs text-muted-foreground">Operational queue for field teams</p>
            </div>
            <Radio className="h-4 w-4 text-orange-300" />
          </div>
          <div className="space-y-2">
            {priorities.map((p, i) => (
              <div key={p.district} className="rounded-md border border-border/80 bg-background/40 p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
                  <span className="text-sm font-medium">{p.district}</span>
                  <RiskBadge level={p.level} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{p.asset}</p>
                <p className="mt-1 text-xs font-medium text-foreground">Next: {p.action}</p>
              </div>
            ))}
          </div>
        </div>

        <ChartCard title="Weather-linked risk outlook (demo)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={forecast}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", fontSize: 12 }} />
              <Line type="monotone" dataKey="risk" name="Risk outlook" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Demo operational indicator derived from the rainfall series; the trained ML model is
            evaluated on the Assessment page using the required 1d/3d/7d/14d/30d inputs.
          </p>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Daily rainfall — last 14 days (demo)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={rainByDate}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", fontSize: 12 }} />
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
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", fontSize: 12 }} />
              <Bar dataKey="count" fill="#f97316" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/assessment" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          <TrendingUp className="h-4 w-4" /> Assess a location
        </Link>
        <Link to="/report" className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
          Submit a field report
        </Link>
      </div>
    </>
  );
}

export function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      {children}
    </div>
  );
}
