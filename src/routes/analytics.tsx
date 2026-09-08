import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/services/api";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoNotice } from "@/components/common/DemoBadge";
import { RISK_COLORS } from "@/utils/risk";
import { DISTRICTS } from "@/data/sikkim";
import type { RiskLevel } from "@/types";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — NER Landslide Early Warning" },
      {
        name: "description",
        content:
          "Demo analytics on landslide triggers, district exposure and risk-level distribution in Sikkim.",
      },
      { property: "og:title", content: "Analytics — NER Landslide Early Warning" },
      {
        property: "og:description",
        content: "Demo landslide analytics for the Sikkim pilot area.",
      },
    ],
  }),
  component: AnalyticsPage,
});

const axis = { stroke: "#94a3b8", fontSize: 11 };
const tip = {
  contentStyle: { background: "#1e293b", border: "1px solid #334155", fontSize: 12 },
};

function AnalyticsPage() {
  const events = useQuery({ queryKey: ["events"], queryFn: api.getHistoricalEvents });
  const cells = useQuery({ queryKey: ["grid"], queryFn: api.getRiskGrid });
  const rain = useQuery({ queryKey: ["rainfall"], queryFn: api.getRainfall });

  const triggers = Object.entries(
    (events.data ?? []).reduce<Record<string, number>>((acc, e) => {
      acc[e.trigger] = (acc[e.trigger] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const levels = (["low", "moderate", "high", "severe"] as RiskLevel[]).map((l) => ({
    name: l,
    value: (cells.data ?? []).filter((c) => c.level === l).length,
  }));

  const byDistrict = DISTRICTS.map((d) => ({
    district: d.name.split(" ")[0],
    events: (events.data ?? []).filter((e) => e.district === d.name).length,
    fatalities: (events.data ?? [])
      .filter((e) => e.district === d.name)
      .reduce((s, e) => s + e.fatalities, 0),
  }));

  const exposure = DISTRICTS.map((d) => {
    const rows = (rain.data ?? []).filter((r) => r.district === d.name);
    const avgRain = rows.reduce((s, r) => s + r.rainfallMm, 0) / (rows.length || 1);
    const evts = (events.data ?? []).filter((e) => e.district === d.name).length;
    return {
      district: d.name.split(" ")[0],
      index: Math.round(Math.min(100, avgRain * 1.1 + evts * 9)),
    };
  });

  const TRIGGER_COLORS = ["#38bdf8", "#f97316", "#a78bfa", "#64748b"];

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Aggregated views over the demo archive, demo grid and demo rainfall series."
      />
      <DemoNotice>
        Charts summarise synthetic data only. They illustrate the analytics surface a real
        deployment would provide once GSI, IMD and satellite feeds are wired in.
      </DemoNotice>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Events & fatalities by district (demo)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byDistrict}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="district" {...axis} />
              <YAxis {...axis} allowDecimals={false} />
              <Tooltip {...tip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="events" name="Events" fill="#38bdf8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="fatalities" name="Fatalities" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Trigger mix (demo)">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={triggers} dataKey="value" nameKey="name" outerRadius={95} label>
                {triggers.map((_, i) => (
                  <Cell key={i} fill={TRIGGER_COLORS[i % TRIGGER_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Risk-level distribution across demo grid">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={levels}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" {...axis} />
              <YAxis {...axis} />
              <Tooltip {...tip} />
              <Bar dataKey="value" name="Cells" radius={[3, 3, 0, 0]}>
                {levels.map((l) => (
                  <Cell key={l.name} fill={RISK_COLORS[l.name as RiskLevel]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Composite exposure index (demo)">
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={exposure}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="district" {...axis} />
              <Radar
                dataKey="index"
                name="Exposure"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.3}
              />
              <Tooltip {...tip} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      {children}
    </div>
  );
}
