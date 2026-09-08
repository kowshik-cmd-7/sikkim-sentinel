import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/services/api";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoNotice } from "@/components/common/DemoBadge";
import { DISTRICTS } from "@/data/sikkim";

export const Route = createFileRoute("/rainfall")({
  head: () => ({
    meta: [
      { title: "Rainfall Monitoring — NER Landslide Early Warning" },
      {
        name: "description",
        content:
          "Demo rainfall, antecedent rainfall and soil-moisture trends for Sikkim districts.",
      },
      { property: "og:title", content: "Rainfall Monitoring — NER Landslide Early Warning" },
      {
        property: "og:description",
        content: "Demo rainfall and soil-moisture trends for Sikkim districts.",
      },
    ],
  }),
  component: RainfallPage,
});

const axis = { stroke: "#94a3b8", fontSize: 11 };
const tip = {
  contentStyle: { background: "#1e293b", border: "1px solid #334155", fontSize: 12 },
};

function RainfallPage() {
  const { data } = useQuery({ queryKey: ["rainfall"], queryFn: api.getRainfall });
  const [district, setDistrict] = useState(DISTRICTS[0].name);

  const series = (data ?? [])
    .filter((r) => r.district === district)
    .map((r) => ({ ...r, day: r.date.slice(5) }));

  const latestByDistrict = DISTRICTS.map((d) => {
    const rows = (data ?? []).filter((r) => r.district === d.name);
    const last = rows.at(-1);
    return {
      district: d.name.split(" ")[0],
      rainfall: last?.rainfallMm ?? 0,
      soil: last?.soilMoisturePct ?? 0,
    };
  });

  return (
    <>
      <PageHeader
        title="Rainfall & Soil Moisture"
        description="Synthetic hydro-meteorological inputs that a future ML pipeline would consume."
      />
      <DemoNotice>
        No IMD, AWS gauge or satellite precipitation product is connected. Values are
        deterministic pseudo-random demo numbers.
      </DemoNotice>

      <div className="flex flex-wrap items-center gap-2">
        {DISTRICTS.map((d) => (
          <button
            key={d.id}
            onClick={() => setDistrict(d.name)}
            className={`rounded-full border px-3 py-1 text-xs ${
              district === d.name
                ? "border-sky-400/60 bg-sky-400/15 text-sky-200"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {d.name}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium">
          {district} — 14-day rainfall vs soil moisture (demo)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="day" {...axis} />
            <YAxis {...axis} />
            <Tooltip {...tip} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="rainfallMm"
              name="Rainfall (mm)"
              stroke="#38bdf8"
              fill="#38bdf8"
              fillOpacity={0.25}
            />
            <Area
              type="monotone"
              dataKey="soilMoisturePct"
              name="Soil moisture (%)"
              stroke="#a78bfa"
              fill="#a78bfa"
              fillOpacity={0.15}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium">Latest reading by district (demo)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={latestByDistrict}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="district" {...axis} />
            <YAxis {...axis} />
            <Tooltip {...tip} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="rainfall" name="Rainfall (mm)" fill="#38bdf8" radius={[3, 3, 0, 0]} />
            <Bar dataKey="soil" name="Soil moisture (%)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
