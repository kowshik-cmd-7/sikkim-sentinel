import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/services/api";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoNotice } from "@/components/common/DemoBadge";
import { RiskBadge } from "@/components/common/RiskBadge";
import { DISTRICTS } from "@/data/sikkim";
import { formatDate } from "@/utils/risk";
import type { LandslideEvent } from "@/types";

export const Route = createFileRoute("/historical")({
  head: () => ({
    meta: [
      { title: "Historical Events — NER Landslide Early Warning" },
      {
        name: "description",
        content:
          "Searchable table of illustrative historical landslide records across Sikkim districts.",
      },
      { property: "og:title", content: "Historical Events — NER Landslide Early Warning" },
      {
        property: "og:description",
        content: "Searchable Sikkim landslide event archive. Demo data only.",
      },
    ],
  }),
  component: HistoricalPage,
});

type SortKey = "date" | "fatalities" | "district";

function HistoricalPage() {
  const { data } = useQuery({ queryKey: ["events"], queryFn: api.getHistoricalEvents });
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("all");
  const [sort, setSort] = useState<SortKey>("date");

  const rows = useMemo(() => {
    const list = (data ?? []).filter((e) => {
      const matchQ =
        !q ||
        `${e.location} ${e.district} ${e.trigger} ${e.notes}`
          .toLowerCase()
          .includes(q.toLowerCase());
      const matchD = district === "all" || e.district === district;
      return matchQ && matchD;
    });
    return [...list].sort((a: LandslideEvent, b: LandslideEvent) => {
      if (sort === "fatalities") return b.fatalities - a.fatalities;
      if (sort === "district") return a.district.localeCompare(b.district);
      return b.date.localeCompare(a.date);
    });
  }, [data, q, district, sort]);

  return (
    <>
      <PageHeader
        title="Historical Landslide Events"
        description="Illustrative archive used to give the prototype realistic spatial and temporal structure."
      />
      <DemoNotice>
        These records are fabricated for demonstration. Verify against GSI / state DMD
        archives before any operational use.
      </DemoNotice>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex min-w-56 flex-1 items-center gap-2 rounded-md border border-border bg-background px-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search location, trigger, notes…"
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
        </div>
        <select
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-2 text-sm"
        >
          <option value="all">All districts</option>
          {DISTRICTS.map((d) => (
            <option key={d.id} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-border bg-background px-2 py-2 text-sm"
        >
          <option value="date">Newest first</option>
          <option value="fatalities">Most fatalities</option>
          <option value="district">District A–Z</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">District</th>
              <th className="px-4 py-3">Trigger</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3 text-right">Fatalities</th>
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((e) => (
              <tr key={e.id} className="hover:bg-accent/40">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                  {formatDate(e.date)}
                </td>
                <td className="px-4 py-3 font-medium">{e.location}</td>
                <td className="px-4 py-3 text-muted-foreground">{e.district}</td>
                <td className="px-4 py-3 capitalize text-muted-foreground">{e.trigger}</td>
                <td className="px-4 py-3">
                  <RiskBadge level={e.severity} />
                </td>
                <td className="px-4 py-3 text-right font-mono">{e.fatalities}</td>
                <td className="max-w-xs px-4 py-3 text-xs text-muted-foreground">
                  {e.notes}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No records match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
