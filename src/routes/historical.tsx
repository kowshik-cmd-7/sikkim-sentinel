import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Table2, AlertTriangle } from "lucide-react";
import { api } from "@/services/api";
import { PageHeader } from "@/components/common/PageHeader";
import { RiskBadge } from "@/components/common/RiskBadge";
import { DISTRICTS } from "@/data/sikkim";
import { formatDate } from "@/utils/risk";
import type { LandslideEvent } from "@/types";

export const Route = createFileRoute("/historical")({
  head: () => ({
    meta: [
      { title: "Bhurakshak — Historical Events" },
      {
        name: "description",
        content:
          "Bhurakshak searchable archive of historical landslide records across the North Eastern Region.",
      },
      { property: "og:title", content: "Bhurakshak — Historical Events" },
      {
        property: "og:description",
        content: "Searchable landslide event archive for the North Eastern Region.",
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
        description="Illustrative archive of past landslide events across the monitoring territory to contextualize hazard thresholds."
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
            <Table2 className="h-3 w-3" />
            Archive
          </span>
        }
      />

      {/* Notice */}
      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
        <p>
          Historical events shown are illustrative benchmark records for command center evaluation and model testing.
        </p>
      </div>

      {/* Filter controls */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex min-w-56 flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search location, trigger, notes…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <select
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2.5 py-0 text-sm text-foreground"
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
          className="h-9 rounded-md border border-input bg-background px-2.5 py-0 text-sm text-foreground"
        >
          <option value="date">Newest first</option>
          <option value="fatalities">Most fatalities</option>
          <option value="district">District A–Z</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">
          {rows.length} record{rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-border text-left">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
              <tr key={e.id} className="hover:bg-accent/30 transition-colors">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                  {formatDate(e.date)}
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{e.location}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{e.district}</td>
                <td className="px-4 py-3 capitalize text-sm text-muted-foreground">{e.trigger}</td>
                <td className="px-4 py-3">
                  <RiskBadge level={e.severity} />
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                  {e.fatalities > 0 ? (
                    <span className="text-red-400">{e.fatalities}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="max-w-xs px-4 py-3 text-xs text-muted-foreground">
                  {e.notes}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <Search className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
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
