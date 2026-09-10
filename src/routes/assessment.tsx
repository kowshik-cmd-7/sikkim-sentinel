import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { api } from "@/services/api";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoNotice } from "@/components/common/DemoBadge";
import { RiskBadge } from "@/components/common/RiskBadge";
import { MapPanel } from "@/components/map/MapPanel";
import { DISTRICTS, SIKKIM_CENTER } from "@/data/sikkim";
import type { RainfallModelInputs } from "@/types";

export const Route = createFileRoute("/assessment")({
  head: () => ({
    meta: [
      { title: "Location Assessment — NER Landslide Early Warning" },
      {
        name: "description",
        content:
          "Assess landslide hazard using the trained GradientBoostingRegressor pipeline and antecedent rainfall accumulation lags.",
      },
      { property: "og:title", content: "Location Assessment — NER Landslide Early Warning" },
      {
        property: "og:description",
        content: "Rainfall-based landslide risk scoring for Sikkim.",
      },
    ],
  }),
  component: AssessmentPage,
});

const PRESETS = [
  {
    name: "Very High Benchmark",
    values: {
      rainfall_1d: 54.635,
      rainfall_3d: 211.665,
      rainfall_7d: 551.32,
      rainfall_14d: 901.84,
      rainfall_30d: 1123.085,
    },
  },
  {
    name: "High Scenario",
    values: {
      rainfall_1d: 126.22,
      rainfall_3d: 213.72,
      rainfall_7d: 382.01,
      rainfall_14d: 417.34,
      rainfall_30d: 616.85,
    },
  },
  {
    name: "Moderate Scenario",
    values: {
      rainfall_1d: 45.55,
      rainfall_3d: 103.56,
      rainfall_7d: 196.08,
      rainfall_14d: 285.44,
      rainfall_30d: 466.19,
    },
  },
  {
    name: "Low Scenario",
    values: {
      rainfall_1d: 2.09,
      rainfall_3d: 21.92,
      rainfall_7d: 68.23,
      rainfall_14d: 229.85,
      rainfall_30d: 278.52,
    },
  },
];

function parseInput(val: string): number | null {
  const trimmed = val.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return isNaN(n) ? null : n;
}

function AssessmentPage() {
  const [lat, setLat] = useState(SIKKIM_CENTER[0]);
  const [lng, setLng] = useState(SIKKIM_CENTER[1]);

  // Five rainfall model inputs
  const [r1d, setR1d] = useState<string>("54.635");
  const [r3d, setR3d] = useState<string>("211.665");
  const [r7d, setR7d] = useState<string>("551.320");
  const [r14d, setR14d] = useState<string>("901.840");
  const [r30d, setR30d] = useState<string>("1123.085");

  const cells = useQuery({ queryKey: ["grid"], queryFn: api.getRiskGrid });

  const parsed1d = parseInput(r1d);
  const parsed3d = parseInput(r3d);
  const parsed7d = parseInput(r7d);
  const parsed14d = parseInput(r14d);
  const parsed30d = parseInput(r30d);

  // Validation checks
  const hasNegative = [parsed1d, parsed3d, parsed7d, parsed14d, parsed30d].some(
    (v) => v !== null && v < 0,
  );

  const nonMonotonic =
    (parsed1d !== null && parsed3d !== null && parsed1d > parsed3d) ||
    (parsed3d !== null && parsed7d !== null && parsed3d > parsed7d) ||
    (parsed7d !== null && parsed14d !== null && parsed7d > parsed14d) ||
    (parsed14d !== null && parsed30d !== null && parsed14d > parsed30d);

  const assess = useMutation({
    mutationFn: () => {
      const rainfall: RainfallModelInputs = {
        rainfall_1d: parsed1d,
        rainfall_3d: parsed3d,
        rainfall_7d: parsed7d,
        rainfall_14d: parsed14d,
        rainfall_30d: parsed30d,
      };
      return api.assessLocation(lat, lng, rainfall);
    },
  });

  const result = assess.data;

  function loadPreset(preset: (typeof PRESETS)[number]) {
    setR1d(String(preset.values.rainfall_1d));
    setR3d(String(preset.values.rainfall_3d));
    setR7d(String(preset.values.rainfall_7d));
    setR14d(String(preset.values.rainfall_14d));
    setR30d(String(preset.values.rainfall_30d));
  }

  function clearRainfall() {
    setR1d("");
    setR3d("");
    setR7d("");
    setR14d("");
    setR30d("");
  }

  return (
    <>
      <PageHeader
        title="Location Assessment"
        description="Pick a point on the map and provide antecedent rainfall metrics to compute the landslide risk score."
      />
      <DemoNotice>
        Connected to the trained GradientBoostingRegressor risk prediction service. Rainfall metrics
        are manually supplied for this development phase (not live weather observations).
      </DemoNotice>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <MapPanel
            cells={cells.data ?? []}
            showEvents={false}
            height={520}
            marker={[lat, lng]}
            onPick={(la, ln) => {
              setLat(Number(la.toFixed(4)));
              setLng(Number(ln.toFixed(4)));
            }}
          />
        </div>

        <div className="space-y-4 lg:col-span-2">
          {/* Coordinates & Location Selection */}
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
          </div>

          {/* Antecedent Rainfall Inputs (Phase 2 Integration) */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Antecedent Rainfall (mm)</h2>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                Manual inputs
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Required by the GradientBoostingRegressor model. Values are manually supplied for this development phase.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label className="text-xs text-muted-foreground">
                1-Day Rainfall (mm)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 54.6"
                  value={r1d}
                  onChange={(e) => setR1d(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                3-Day Rainfall (mm)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 211.7"
                  value={r3d}
                  onChange={(e) => setR3d(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                7-Day Rainfall (mm)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 551.3"
                  value={r7d}
                  onChange={(e) => setR7d(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                14-Day Rainfall (mm)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 901.8"
                  value={r14d}
                  onChange={(e) => setR14d(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="text-xs text-muted-foreground col-span-2 sm:col-span-1">
                30-Day Rainfall (mm)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 1123.1"
                  value={r30d}
                  onChange={(e) => setR30d(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
            </div>

            {/* Quick Profile Presets */}
            <div className="mt-3">
              <span className="text-[11px] text-muted-foreground">Preset scenarios:</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => loadPreset(p)}
                    className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {p.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearRainfall}
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                >
                  Clear (Test Missing)
                </button>
              </div>
            </div>

            {/* Validation Warnings */}
            {hasNegative && (
              <div className="mt-3 flex items-center gap-2 rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Rainfall values cannot be negative.</span>
              </div>
            )}
            {nonMonotonic && !hasNegative && (
              <div className="mt-3 flex items-center gap-2 rounded border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-yellow-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  Notice: Cumulative rainfall windows are non-monotonic (e.g. shorter window exceeds longer window).
                </span>
              </div>
            )}

            <button
              onClick={() => assess.mutate()}
              disabled={assess.isPending || hasNegative}
              className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {assess.isPending ? "Assessing via model…" : "Assess landslide risk"}
            </button>
          </div>

          {/* Assessment Result Display */}
          {result && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {result.district}
                  </p>
                  {result.score !== null ? (
                    <>
                      <p className="font-mono text-4xl font-semibold">
                        {result.score} <span className="text-xl font-normal text-muted-foreground">/ 100</span>
                      </p>
                      <p className="text-xs text-muted-foreground">rainfall risk score / 100</p>
                    </>
                  ) : (
                    <>
                      <p className="font-mono text-4xl font-semibold text-muted-foreground">--</p>
                      <p className="text-xs text-muted-foreground">insufficient rainfall data</p>
                    </>
                  )}
                </div>
                <RiskBadge level={result.level} />
              </div>

              {/* Explanatory Model Feature Importance */}
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-1 text-xs font-medium text-muted-foreground">
                  <span>Model feature importance</span>
                  <span>Contribution</span>
                </div>
                {result.factors.map((f) => (
                  <div key={f.label}>
                    <div className="flex justify-between text-xs">
                      <span className="truncate pr-2">{f.label}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {f.value !== null && f.value !== undefined ? `${f.value} mm` : "—"} · {f.importancePct}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-sky-400"
                        style={{ width: `${Math.min(100, f.importancePct)}%` }}
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
