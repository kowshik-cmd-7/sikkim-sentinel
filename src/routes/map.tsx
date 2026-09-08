import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/services/api";
import { MapPanel } from "@/components/map/MapPanel";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoNotice } from "@/components/common/DemoBadge";
import type { RiskLevel } from "@/types";
import { RISK_LABELS } from "@/utils/risk";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Risk Map — NER Landslide Early Warning (Sikkim)" },
      {
        name: "description",
        content:
          "Interactive Sikkim landslide risk map with a demo risk grid and historical event markers.",
      },
      { property: "og:title", content: "Risk Map — NER Landslide Early Warning" },
      {
        property: "og:description",
        content: "Interactive Sikkim landslide risk map. Demo data only.",
      },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const events = useQuery({ queryKey: ["events"], queryFn: api.getHistoricalEvents });
  const cells = useQuery({ queryKey: ["grid"], queryFn: api.getRiskGrid });
  const [showGrid, setShowGrid] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [minLevel, setMinLevel] = useState<RiskLevel | "all">("all");

  const order: RiskLevel[] = ["low", "moderate", "high", "severe"];
  const filteredCells = (cells.data ?? []).filter(
    (c) => minLevel === "all" || order.indexOf(c.level) >= order.indexOf(minLevel),
  );

  return (
    <>
      <PageHeader
        title="Risk Map"
        description="Sikkim-centred map layer stack: synthetic risk grid plus illustrative historical landslide markers."
      />
      <DemoNotice>
        The coloured grid is a deterministic DEMO surface generated in the browser. It is
        not derived from terrain, rainfall or satellite analysis.
      </DemoNotice>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
          />
          Demo risk grid
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showEvents}
            onChange={(e) => setShowEvents(e.target.checked)}
          />
          Historical events
        </label>
        <label className="flex items-center gap-2">
          Minimum level
          <select
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            value={minLevel}
            onChange={(e) => setMinLevel(e.target.value as RiskLevel | "all")}
          >
            <option value="all">All</option>
            {order.map((l) => (
              <option key={l} value={l}>
                {RISK_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto text-xs text-muted-foreground">
          {filteredCells.length} cells · {events.data?.length ?? 0} events
        </span>
      </div>

      <MapPanel
        events={events.data ?? []}
        cells={filteredCells}
        showGrid={showGrid}
        showEvents={showEvents}
        height={600}
      />
    </>
  );
}
