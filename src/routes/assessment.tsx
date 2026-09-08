import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/services/api";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoNotice } from "@/components/common/DemoBadge";
import { RiskBadge } from "@/components/common/RiskBadge";
import { MapPanel } from "@/components/map/MapPanel";
import { DISTRICTS, SIKKIM_CENTER } from "@/data/sikkim";

export const Route = createFileRoute("/assessment")({
  head: () => ({
    meta: [
      { title: "Location Assessment — NER Landslide Early Warning" },
      {
        name: "description",
        content:
          "Score any point in the Sikkim pilot area against demo slope, rainfall, soil-moisture and history factors.",
      },
      { property: "og:title", content: "Location Assessment — NER Landslide Early Warning" },
      {
        property: "og:description",
        content: "Point-based demo landslide risk scoring for Sikkim.",
      },
    ],
  }),
  component: AssessmentPage,
});

function AssessmentPage() {
  const [lat, setLat] = useState(SIKKIM_CENTER[0]);
  const [lng, setLng] = useState(SIKKIM_CENTER[1]);
  const cells = useQuery({ queryKey: ["grid"], queryFn: api.getRiskGrid });

  const assess = useMutation({
    mutationFn: () => api.assessLocation(lat, lng),
  });

  const result = assess.data;

  return (
    <>
      <PageHeader
        title="Location Assessment"
        description="Pick a point on the map or enter coordinates to get a demo risk score."
      />
      <DemoNotice>
        Scores come from a transparent weighted-sum rule in the mock service, using
        synthetic inputs. This is not a trained machine-learning prediction.
      </DemoNotice>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <MapPanel
            cells={cells.data ?? []}
            showEvents={false}
            height={460}
            marker={[lat, lng]}
            onPick={(la, ln) => {
              setLat(Number(la.toFixed(4)));
              setLng(Number(ln.toFixed(4)));
            }}
          />
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-medium">Coordinates</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs text-muted-foreground">
                Latitude
                <input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Longitude
                <input
                  type="number"
                  step="0.0001"
                  value={lng}
                  onChange={(e) => setLng(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {DISTRICTS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setLat(d.lat);
                    setLng(d.lng);
                  }}
                  className="rounded-full border border-border px-2.5 py-1 text-[11px] hover:bg-accent"
                >
                  {d.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => assess.mutate()}
              disabled={assess.isPending}
              className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {assess.isPending ? "Assessing…" : "Run demo assessment"}
            </button>
          </div>

          {result && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {result.district}
                  </p>
                  <p className="font-mono text-4xl font-semibold">{result.score}</p>
                  <p className="text-xs text-muted-foreground">demo risk index / 100</p>
                </div>
                <RiskBadge level={result.level} />
              </div>

              <div className="mt-4 space-y-3">
                {result.factors.map((f) => (
                  <div key={f.label}>
                    <div className="flex justify-between text-xs">
                      <span>{f.label}</span>
                      <span className="text-muted-foreground">
                        {f.value} · w {f.weight}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-sky-400"
                        style={{ width: `${Math.min(100, f.value)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-4 rounded-md border border-border bg-background/60 p-3 text-xs text-muted-foreground">
                {result.recommendation}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
