import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { AlertCircle, Bell, CloudRain, FileText, Loader2, Mountain, RotateCcw, TrendingUp } from "lucide-react";

import {
  api,
  getNearbyFacilities,
  getRainfallFeatures,
  getRainfallForecast,
  getTerrainFeatures,
  predictAllForecastHorizons,
  evaluateLandslideAlert,
  type HorizonRiskAssessment,
} from "@/services/api";

import { PageHeader, LiveDataNotice } from "@/components/common/PageHeader";
import { RiskBadge } from "@/components/common/RiskBadge";
import { MapPanel } from "@/components/map/MapPanel";
import { EarlyWarningAlertPanel } from "@/components/assessment/EarlyWarningAlertPanel";

import { DISTRICTS, SIKKIM_CENTER } from "@/data/sikkim";
import { cn } from "@/lib/utils";

import { useStateRiskGrid } from "@/hooks/useStateRiskGrid";
import { StateSelectorBar } from "@/components/risk/StateSelectorBar";
import { StateRiskSummaryCards } from "@/components/risk/StateRiskSummaryCards";
import { CalculatedPointDrawer } from "@/components/risk/CalculatedPointDrawer";

import type { AlertEvaluation, AssessmentFactor, LandslideAlert, RainfallModelInputs } from "@/types";

export const Route = createFileRoute("/assessment")({
  validateSearch: (search: Record<string, unknown>): { lat?: number; lng?: number } => {
    const rawLat = search["lat"];
    const rawLng = search["lng"];
    const lat = typeof rawLat === "number" ? rawLat : typeof rawLat === "string" ? parseFloat(rawLat) : undefined;
    const lng = typeof rawLng === "number" ? rawLng : typeof rawLng === "string" ? parseFloat(rawLng) : undefined;
    const result: { lat?: number; lng?: number } = {};
    if (lat !== undefined && !isNaN(lat)) {
      result.lat = lat;
    }
    if (lng !== undefined && !isNaN(lng)) {
      result.lng = lng;
    }
    return result;
  },
  head: () => ({
    meta: [
      {
        title: "Bhurakshak — Location Risk Assessment",
      },
      {
        name: "description",
        content:
          "Bhurakshak location risk assessment: evaluate landslide hazard using the trained GradientBoostingRegressor pipeline and antecedent rainfall accumulation lags.",
      },
      {
        property: "og:title",
        content: "Bhurakshak — Location Risk Assessment",
      },
      {
        property: "og:description",
        content: "Rainfall-based and terrain hybrid landslide risk scoring for the North Eastern Region.",
      },
    ],
  }),

  component: AssessmentPage,
});

/* ---------------------------------------------------------
   Demo presets
--------------------------------------------------------- */

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

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */

function parseInput(value: string): number | null {
  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  const number = Number(trimmed);

  return Number.isNaN(number) ? null : number;
}

/* ---------------------------------------------------------
   Page
--------------------------------------------------------- */

function AssessmentPage() {
  const search = Route.useSearch();

  /* -------------------------------------------------------
     Location state
  ------------------------------------------------------- */

  const [lat, setLat] = useState<number>(() => {
    if (typeof search.lat === "number" && !isNaN(search.lat)) return search.lat;
    return SIKKIM_CENTER[0];
  });
  const [lng, setLng] = useState<number>(() => {
    if (typeof search.lng === "number" && !isNaN(search.lng)) return search.lng;
    return SIKKIM_CENTER[1];
  });

  useEffect(() => {
    if (
      typeof search.lat === "number" &&
      !isNaN(search.lat) &&
      typeof search.lng === "number" &&
      !isNaN(search.lng)
    ) {
      setLat(search.lat);
      setLng(search.lng);
      setIsManualOverride(false);
      setActivePresetName(null);
    }
  }, [search.lat, search.lng]);

  /* -------------------------------------------------------
     Rainfall inputs & override mode
  ------------------------------------------------------- */

  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);
  const [activePresetName, setActivePresetName] = useState<string | null>(null);
  const [manualRainfall, setManualRainfall] = useState<{
    r1d: string;
    r3d: string;
    r7d: string;
    r14d: string;
    r30d: string;
  }>({
    r1d: "",
    r3d: "",
    r7d: "",
    r14d: "",
    r30d: "",
  });

  /* -------------------------------------------------------
     Map grid query
  ------------------------------------------------------- */

  const cells = useQuery({
    queryKey: ["grid"],
    queryFn: api.getRiskGrid,
  });

  /* -------------------------------------------------------
     Automatic live rainfall query keyed by coordinates
  ------------------------------------------------------- */

  const rainfallQuery = useQuery({
    queryKey: ["weather-rainfall", lat, lng],
    queryFn: () => getRainfallFeatures(lat, lng),
    enabled: !isManualOverride && !Number.isNaN(lat) && !Number.isNaN(lng),
    staleTime: 30 * 1000,
    retry: 1,
  });

  /* -------------------------------------------------------
     Automatic 72-hour rainfall forecast query keyed by coordinates
  ------------------------------------------------------- */

  const forecastQuery = useQuery({
    queryKey: ["weather-forecast", lat, lng],
    queryFn: () => getRainfallForecast(lat, lng, 72),
    enabled: !Number.isNaN(lat) && !Number.isNaN(lng),
    staleTime: 60 * 1000,
    retry: 1,
  });

  /* -------------------------------------------------------
     Automatic terrain query (elevation & slope) keyed by coordinates
  ------------------------------------------------------- */

  const terrainQuery = useQuery({
    queryKey: ["terrain", lat, lng],
    queryFn: () => getTerrainFeatures(lat, lng),
    enabled: !Number.isNaN(lat) && !Number.isNaN(lng),
    staleTime: 60 * 1000,
    retry: 1,
  });

  /* -------------------------------------------------------
     Current displayed rainfall values (auto or manual)
  ------------------------------------------------------- */

  const currentR1d = isManualOverride
    ? manualRainfall.r1d
    : rainfallQuery.data?.rainfall_1d !== undefined
      ? String(rainfallQuery.data.rainfall_1d)
      : "";
  const currentR3d = isManualOverride
    ? manualRainfall.r3d
    : rainfallQuery.data?.rainfall_3d !== undefined
      ? String(rainfallQuery.data.rainfall_3d)
      : "";
  const currentR7d = isManualOverride
    ? manualRainfall.r7d
    : rainfallQuery.data?.rainfall_7d !== undefined
      ? String(rainfallQuery.data.rainfall_7d)
      : "";
  const currentR14d = isManualOverride
    ? manualRainfall.r14d
    : rainfallQuery.data?.rainfall_14d !== undefined
      ? String(rainfallQuery.data.rainfall_14d)
      : "";
  const currentR30d = isManualOverride
    ? manualRainfall.r30d
    : rainfallQuery.data?.rainfall_30d !== undefined
      ? String(rainfallQuery.data.rainfall_30d)
      : "";

  /* -------------------------------------------------------
     Parsed rainfall values for validation & inference
  ------------------------------------------------------- */

  const parsed1d = parseInput(currentR1d);
  const parsed3d = parseInput(currentR3d);
  const parsed7d = parseInput(currentR7d);
  const parsed14d = parseInput(currentR14d);
  const parsed30d = parseInput(currentR30d);

  /* -------------------------------------------------------
     Baseline rainfall inputs for future risk projection
  ------------------------------------------------------- */

  const baselineForProjection: RainfallModelInputs | null = useMemo(() => {
    if (isManualOverride) {
      if (
        parsed1d !== null &&
        parsed3d !== null &&
        parsed7d !== null &&
        parsed14d !== null &&
        parsed30d !== null
      ) {
        return {
          rainfall_1d: parsed1d,
          rainfall_3d: parsed3d,
          rainfall_7d: parsed7d,
          rainfall_14d: parsed14d,
          rainfall_30d: parsed30d,
        };
      }
      return null;
    }
    if (rainfallQuery.data) {
      return {
        rainfall_1d: rainfallQuery.data.rainfall_1d,
        rainfall_3d: rainfallQuery.data.rainfall_3d,
        rainfall_7d: rainfallQuery.data.rainfall_7d,
        rainfall_14d: rainfallQuery.data.rainfall_14d,
        rainfall_30d: rainfallQuery.data.rainfall_30d,
      };
    }
    return null;
  }, [isManualOverride, parsed1d, parsed3d, parsed7d, parsed14d, parsed30d, rainfallQuery.data]);

  /* -------------------------------------------------------
     Automatic future landslide risk prediction for 6h, 24h, 48h, 72h (Hybrid Layer)
  ------------------------------------------------------- */

  const futureRiskQuery = useQuery({
    queryKey: [
      "future-risk",
      lat,
      lng,
      baselineForProjection?.rainfall_1d,
      baselineForProjection?.rainfall_3d,
      baselineForProjection?.rainfall_7d,
      baselineForProjection?.rainfall_14d,
      baselineForProjection?.rainfall_30d,
      forecastQuery.data?.forecast?.length,
      terrainQuery.data?.slope_degrees,
      terrainQuery.data?.terrain_susceptibility,
    ],
    queryFn: async (): Promise<HorizonRiskAssessment[]> => {
      if (!baselineForProjection || !forecastQuery.data?.forecast?.length) {
        return [];
      }
      return predictAllForecastHorizons(
        baselineForProjection,
        forecastQuery.data.forecast,
        terrainQuery.data ?? null,
      );
    },
    enabled:
      Boolean(baselineForProjection) &&
      Boolean(forecastQuery.data?.forecast?.length) &&
      !Number.isNaN(lat) &&
      !Number.isNaN(lng),
    staleTime: 60 * 1000,
    retry: 1,
  });

  /* -------------------------------------------------------
     Validation for manual mode
  ------------------------------------------------------- */

  const hasNegative = [parsed1d, parsed3d, parsed7d, parsed14d, parsed30d].some(
    (value) => value !== null && value < 0,
  );

  const hasMissing = [parsed1d, parsed3d, parsed7d, parsed14d, parsed30d].some(
    (value) => value === null,
  );

  const nonMonotonic =
    parsed1d !== null && parsed3d !== null && parsed1d > parsed3d
      ? true
      : parsed3d !== null && parsed7d !== null && parsed3d > parsed7d
        ? true
        : parsed7d !== null && parsed14d !== null && parsed7d > parsed14d
          ? true
          : parsed14d !== null && parsed30d !== null && parsed14d > parsed30d;

  /* -------------------------------------------------------
     Automatic Current Landslide Risk assessment (Hybrid Layer)
  ------------------------------------------------------- */

  const currentRiskQuery = useQuery({
    queryKey: [
      "current-risk",
      lat,
      lng,
      baselineForProjection?.rainfall_1d,
      baselineForProjection?.rainfall_3d,
      baselineForProjection?.rainfall_7d,
      baselineForProjection?.rainfall_14d,
      baselineForProjection?.rainfall_30d,
      terrainQuery.data?.slope_degrees,
      terrainQuery.data?.terrain_susceptibility,
    ],
    queryFn: async () => {
      if (!baselineForProjection) return null;
      return api.assessLocation(lat, lng, baselineForProjection, terrainQuery.data ?? null);
    },
    enabled:
      Boolean(baselineForProjection) &&
      !Number.isNaN(lat) &&
      !Number.isNaN(lng) &&
      (!isManualOverride || (!hasNegative && !hasMissing)),
    staleTime: 30 * 1000,
    retry: 1,
  });

  /* -------------------------------------------------------
     Coordinate updater: switches to auto mode & clears stale assessment
  ------------------------------------------------------- */

  const handleLocationChange = (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    setIsManualOverride(false);
    setActivePresetName(null);
    setManualRainfall({ r1d: "", r3d: "", r7d: "", r14d: "", r30d: "" });
    assess.reset();
  };

  /* -------------------------------------------------------
     State-Wide Risk Grid & Boundary Engine
  ------------------------------------------------------- */

  const stateRisk = useStateRiskGrid({
    storageKey: "sikkim_sentinel_selected_state",
    defaultState: "Sikkim",
    onStateChangeCoordinate: (newLat, newLng) => {
      handleLocationChange(
        Number(newLat.toFixed(4)),
        Number(newLng.toFixed(4)),
      );
    },
  });

  /* -------------------------------------------------------
     ML assessment via React Query mutation (CURRENT RISK MANUAL TRIGGER)
  ------------------------------------------------------- */

  const assess = useMutation({
    mutationFn: async () => {
      let inputsToUse: RainfallModelInputs | undefined = undefined;

      if (isManualOverride) {
        inputsToUse = {
          rainfall_1d: parsed1d,
          rainfall_3d: parsed3d,
          rainfall_7d: parsed7d,
          rainfall_14d: parsed14d,
          rainfall_30d: parsed30d,
        };
      } else if (rainfallQuery.data) {
        inputsToUse = {
          rainfall_1d: rainfallQuery.data.rainfall_1d,
          rainfall_3d: rainfallQuery.data.rainfall_3d,
          rainfall_7d: rainfallQuery.data.rainfall_7d,
          rainfall_14d: rainfallQuery.data.rainfall_14d,
          rainfall_30d: rainfallQuery.data.rainfall_30d,
        };
      }

      return api.assessLocation(lat, lng, inputsToUse, terrainQuery.data ?? null);
    },
  });

  const result = isManualOverride
    ? (assess.data ?? currentRiskQuery.data)
    : (currentRiskQuery.data ?? assess.data);

  /* -------------------------------------------------------
     Manual editing of rainfall fields
  ------------------------------------------------------- */

  const handleFieldChange = (
    field: "1d" | "3d" | "7d" | "14d" | "30d",
    value: string,
  ) => {
    setIsManualOverride(true);
    setActivePresetName(null);
    setManualRainfall({
      r1d: field === "1d" ? value : currentR1d,
      r3d: field === "3d" ? value : currentR3d,
      r7d: field === "7d" ? value : currentR7d,
      r14d: field === "14d" ? value : currentR14d,
      r30d: field === "30d" ? value : currentR30d,
    });
    assess.reset();
  };

  /* -------------------------------------------------------
     Load preset (for benchmark / scenario testing)
  ------------------------------------------------------- */

  const loadPreset = (preset: (typeof PRESETS)[number]) => {
    setIsManualOverride(true);
    setActivePresetName(preset.name);
    setManualRainfall({
      r1d: String(preset.values.rainfall_1d),
      r3d: String(preset.values.rainfall_3d),
      r7d: String(preset.values.rainfall_7d),
      r14d: String(preset.values.rainfall_14d),
      r30d: String(preset.values.rainfall_30d),
    });
    assess.reset();
  };

  /* -------------------------------------------------------
     Reset to live coordinate automatic mode
  ------------------------------------------------------- */

  const resetToLiveAuto = () => {
    setIsManualOverride(false);
    setActivePresetName(null);
    setManualRainfall({ r1d: "", r3d: "", r7d: "", r14d: "", r30d: "" });
    assess.reset();
    rainfallQuery.refetch();
    forecastQuery.refetch();
    terrainQuery.refetch();
    currentRiskQuery.refetch();
  };

  /* -------------------------------------------------------
     Alert & Early Warning System State & Evaluation
  ------------------------------------------------------- */

  const [alertRadiusKm, setAlertRadiusKm] = useState<number>(10);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<
    Record<string, { timestamp: string; operator: string }>
  >({});
  const [sessionAlertHistory, setSessionAlertHistory] = useState<LandslideAlert[]>([]);

  const nearbyFacilitiesQuery = useQuery({
    queryKey: ["nearby-facilities", lat, lng, alertRadiusKm],
    queryFn: () => getNearbyFacilities(lat, lng, alertRadiusKm),
    enabled: !Number.isNaN(lat) && !Number.isNaN(lng),
    staleTime: 60 * 1000,
    retry: 1,
  });

  const alertEvaluation: AlertEvaluation | null = useMemo(() => {
    if (!result && !futureRiskQuery.data?.length) {
      return null;
    }

    const currentRisk = result?.finalRiskScore ?? result?.score ?? null;
    const currentLevel = result?.finalRiskLevel ?? result?.level ?? "insufficient-data";
    const district = result?.district ?? "Sikkim";

    const horizons = (futureRiskQuery.data || []).map((h) => ({
      horizon: h.key,
      label: h.label,
      score: h.finalRiskScore ?? h.riskScore,
      level: h.finalRiskLevel ?? h.riskLevel,
      rainfallMm: h.forecastRainfallMm,
    }));

    const evalResult = evaluateLandslideAlert({
      lat,
      lng,
      district,
      currentRisk,
      currentLevel,
      horizons,
      terrain: terrainQuery.data ?? result?.terrainAssessment ?? null,
      rainfall: baselineForProjection,
      radiusKm: alertRadiusKm,
      nearbyFacilitiesPool: nearbyFacilitiesQuery.data ?? undefined,
    });

    if (evalResult.alert) {
      const stableAlertId = `alert-${lat.toFixed(3)}-${lng.toFixed(3)}-${evalResult.severity}`;
      evalResult.alert.id = stableAlertId;
      const ack = acknowledgedAlerts[stableAlertId];
      if (ack) {
        evalResult.alert.acknowledged = true;
        evalResult.alert.acknowledgedAt = ack.timestamp;
        evalResult.alert.acknowledgedBy = ack.operator;
      }
    }

    return evalResult;
  }, [
    result,
    futureRiskQuery.data,
    lat,
    lng,
    terrainQuery.data,
    baselineForProjection,
    alertRadiusKm,
    nearbyFacilitiesQuery.data,
    acknowledgedAlerts,
  ]);

  const handleAcknowledgeAlert = (alertId: string) => {
    const timestamp = new Date().toISOString();
    const operator = "District Control Room (Duty Officer)";
    setAcknowledgedAlerts((prev) => ({
      ...prev,
      [alertId]: { timestamp, operator },
    }));

    if (alertEvaluation?.alert) {
      const updatedAlert: LandslideAlert = {
        ...alertEvaluation.alert,
        acknowledged: true,
        acknowledgedAt: timestamp,
        acknowledgedBy: operator,
      };
      setSessionAlertHistory((prev) => {
        const filtered = prev.filter((a) => a.id !== alertId);
        return [updatedAlert, ...filtered];
      });
    }
  };

  useEffect(() => {
    if (alertEvaluation?.shouldAlert && alertEvaluation.alert) {
      const curAlert = alertEvaluation.alert;
      setSessionAlertHistory((prev) => {
        const exists = prev.find((a) => a.id === curAlert.id);
        if (!exists) {
          return [curAlert, ...prev].slice(0, 25);
        }
        return prev;
      });
    }
  }, [alertEvaluation]);

  /* -------------------------------------------------------
     Render
  ------------------------------------------------------- */

  return (
    <>
      <PageHeader
        title="Location Risk Assessment"
        description="Select a state, pick a point on the map, and retrieve live telemetry to compute current and projected landslide risk."
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            ML Risk Engine
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/report"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <FileText className="h-3.5 w-3.5 text-emerald-400" />
              Field Reports
            </Link>
            <Link
              to="/alerts"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Bell className="h-3.5 w-3.5 text-red-400" />
              Alert Console
            </Link>
          </div>
        }
      />

      <LiveDataNotice>
        Connected to live GradientBoostingRegressor risk engine. Rainfall fetched from Open-Meteo · Terrain from Copernicus 90m DEM · Boundaries from BharatMaps.
      </LiveDataNotice>

      {/* -------------------------------------------------------------
          STATE SELECTOR BAR
      ------------------------------------------------------------- */}
      <StateSelectorBar
        selectedState={stateRisk.selectedState}
        states={stateRisk.statesQuery.data ?? []}
        onStateChange={stateRisk.handleStateChange}
        calcStatus={stateRisk.calcStatus}
        calcProgress={stateRisk.calcProgress}
        assessedCount={stateRisk.calculatedPoints.length}
        isBoundaryError={stateRisk.boundaryQuery.isError}
        onRefresh={stateRisk.handleRefresh}
        className="mb-4"
      />

      {/* -------------------------------------------------------------
          STATE RISK SUMMARY STATISTICS CARDS (ROW OF 6)
      ------------------------------------------------------------- */}
      <StateRiskSummaryCards
        summary={stateRisk.stateSummary}
        className="mb-4"
      />

      <div className="grid gap-4 lg:grid-cols-5">
        {/* -------------------------------------------------
            MAP & FUTURE LANDSLIDE RISK (LEFT COLUMN)
        ------------------------------------------------- */}

        <div className="space-y-4 lg:col-span-3">
          <MapPanel
            cells={[]}
            showEvents={false}
            height={460}
            marker={[lat, lng]}
            stateBoundary={stateRisk.boundaryQuery.data}
            selectedStateName={stateRisk.selectedState}
            calculatedRiskPoints={stateRisk.calculatedPoints}
            onSelectCalculatedPoint={(p) => {
              stateRisk.setSelectedCalculatedPoint(p);
              handleLocationChange(
                Number(p.latitude.toFixed(4)),
                Number(p.longitude.toFixed(4)),
              );
            }}
            onPick={(latitude, longitude) => {
              handleLocationChange(
                Number(latitude.toFixed(4)),
                Number(longitude.toFixed(4)),
              );
            }}
          />

          {/* Selected Calculated Point Drawer */}
          <CalculatedPointDrawer
            point={stateRisk.selectedCalculatedPoint}
            selectedState={stateRisk.selectedState}
            onClose={() => stateRisk.setSelectedCalculatedPoint(null)}
          />

          {/* -------------------------------------------------
              FUTURE LANDSLIDE RISK SECTION
          ------------------------------------------------- */}

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-sky-400" />
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    Future Landslide Risk
                  </h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Projected risk horizons (6h, 24h, 48h, 72h) combining antecedent saturation with weather forecasts.
                </p>
              </div>

              {futureRiskQuery.isFetching && (
                <span className="flex items-center gap-1.5 text-xs text-sky-400 font-medium">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Evaluating projected risk...
                </span>
              )}
            </div>

            {/* Error state */}
            {(futureRiskQuery.isError || rainfallQuery.isError || forecastQuery.isError) && (
              <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-300">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                  <div>
                    <strong className="font-semibold">Unable to project future landslide risk.</strong>
                    <p className="mt-0.5 text-[11px] text-red-200/80">
                      Make sure the Python FastAPI service is running on <code>http://127.0.0.1:8000</code>.
                      {(futureRiskQuery.error || rainfallQuery.error || forecastQuery.error) && (
                        <span className="mt-1 block font-mono text-[10px] text-red-300/80">
                          Error detail: {String(futureRiskQuery.error?.message || rainfallQuery.error?.message || forecastQuery.error?.message)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading state */}
            {(futureRiskQuery.isLoading || rainfallQuery.isLoading || forecastQuery.isLoading) && !futureRiskQuery.data ? (
              <div className="flex items-center justify-center py-10 text-xs text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                Projecting landslide risk for next 6h, 24h, 48h, and 72h horizons...
              </div>
            ) : futureRiskQuery.data && futureRiskQuery.data.length > 0 ? (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {futureRiskQuery.data.map((item) => {
                    return (
                      <div
                        key={item.key}
                        className={cn(
                          "flex flex-col justify-between rounded-lg border p-3.5 transition-all shadow-xs",
                          item.finalRiskLevel === "very-high"
                            ? "border-red-500/40 bg-red-500/5"
                            : item.finalRiskLevel === "high"
                              ? "border-orange-500/40 bg-orange-500/5"
                              : item.finalRiskLevel === "moderate"
                                ? "border-yellow-500/40 bg-yellow-500/5"
                                : item.finalRiskLevel === "low"
                                  ? "border-emerald-500/30 bg-emerald-500/5"
                                  : "border-border bg-card",
                        )}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-2">
                            <div>
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Horizon
                              </span>
                              <h3 className="text-sm font-semibold text-foreground">
                                {item.label}
                              </h3>
                            </div>
                            <RiskBadge level={item.finalRiskLevel} />
                          </div>

                          {/* Final Hybrid Risk */}
                          <div className="mt-3">
                            <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider block">
                              Final Hybrid Risk
                            </span>
                            <div className="flex items-baseline gap-1">
                              <span className="font-mono text-3xl font-bold tracking-tight text-foreground">
                                {item.finalRiskScore !== null ? item.finalRiskScore.toFixed(1) : "--"}
                              </span>
                              <span className="text-xs text-muted-foreground">/ 100</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              rainfall trigger + terrain susceptibility
                            </p>
                          </div>

                          {/* Transparent breakdown: Rainfall ML Risk vs Terrain Susceptibility */}
                          <div className="mt-2.5 rounded-md border border-border/50 bg-background/50 p-2 space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-muted-foreground">Rainfall ML Risk:</span>
                              <span className="font-mono font-medium text-foreground">
                                {item.rainfallRiskScore !== null ? `${item.rainfallRiskScore.toFixed(1)} / 100` : "—"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-muted-foreground">Terrain:</span>
                              <span className="font-medium text-foreground">
                                {item.slopeCategory} {item.slopeDegrees !== null ? `(${item.slopeDegrees.toFixed(1)}°)` : ""}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-muted-foreground">Susceptibility:</span>
                              <span
                                className={cn(
                                  "font-medium text-[11px]",
                                  item.terrainSusceptibility === "Very High"
                                    ? "text-red-400"
                                    : item.terrainSusceptibility === "High"
                                      ? "text-orange-400"
                                      : item.terrainSusceptibility === "Moderate"
                                        ? "text-yellow-400"
                                        : "text-emerald-400",
                                )}
                              >
                                {item.terrainSusceptibility}
                              </span>
                            </div>
                          </div>

                          {/* Forecast rainfall parameters */}
                          <div className="mt-2 grid grid-cols-3 gap-1 rounded-md border border-border/50 bg-background/40 p-1.5 text-center text-xs">
                            <div>
                              <span className="text-[9px] text-muted-foreground block">
                                Forecast
                              </span>
                              <span
                                className={cn(
                                  "font-mono text-[11px] font-medium",
                                  item.forecastRainfallMm > 0
                                    ? "text-sky-400 font-semibold"
                                    : "text-foreground",
                                )}
                              >
                                {item.forecastRainfallMm.toFixed(1)} mm
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] text-muted-foreground block">
                                Peak
                              </span>
                              <span className="font-mono text-[11px] font-medium text-foreground">
                                {item.peakHourlyMm.toFixed(1)} mm/h
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] text-muted-foreground block">
                                Rain Prob
                              </span>
                              <span className="font-mono text-[11px] font-medium text-sky-300">
                                {item.maxPrecipitationProbability !== null
                                  ? `${item.maxPrecipitationProbability}%`
                                  : "—"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <p className="mt-3 border-t border-border/40 pt-2 text-[11px] leading-relaxed text-muted-foreground italic">
                          "{item.interpretation}"
                        </p>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[11px] text-muted-foreground border-t border-border/40 pt-2.5">
                  <strong>Note:</strong> Final projected risk combines rainfall-driven ML hazard (from GradientBoostingRegressor) with topographic slope susceptibility derived from Copernicus 90m DEM.
                </p>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Select coordinates on the map or choose a district to generate future risk horizons.
              </div>
            )}
          </div>
        </div>

        {/* -------------------------------------------------
            RIGHT PANEL: COORDINATES, ANTECEDENT & CURRENT RISK
        ------------------------------------------------- */}

        <div className="space-y-4 lg:col-span-2">
          {/* -------------------------------------------------
              Coordinates
          ------------------------------------------------- */}

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-medium">Coordinates</h2>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs text-muted-foreground">
                Latitude
                <input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    if (!Number.isNaN(parsed)) {
                      handleLocationChange(parsed, lng);
                    }
                  }}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>

              <label className="text-xs text-muted-foreground">
                Longitude
                <input
                  type="number"
                  step="0.0001"
                  value={lng}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    if (!Number.isNaN(parsed)) {
                      handleLocationChange(lat, parsed);
                    }
                  }}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
            </div>

            {stateRisk.selectedState === "Sikkim" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {DISTRICTS.map((district) => {
                  const isSelected =
                    Math.abs(district.lat - lat) < 0.001 &&
                    Math.abs(district.lng - lng) < 0.001;

                  return (
                    <button
                      key={district.id}
                      type="button"
                      onClick={() => {
                        handleLocationChange(district.lat, district.lng);
                      }}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground font-medium"
                          : "border-border hover:bg-accent text-foreground",
                      )}
                    >
                      {district.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              stateRisk.calculatedPoints.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block">
                    {stateRisk.selectedState} Sample Nodes:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {stateRisk.calculatedPoints.slice(0, 6).map((node, idx) => {
                      const isSelected =
                        Math.abs(node.latitude - lat) < 0.001 &&
                        Math.abs(node.longitude - lng) < 0.001;
                      return (
                        <button
                          key={`${node.latitude}-${node.longitude}`}
                          type="button"
                          onClick={() => {
                            stateRisk.setSelectedCalculatedPoint(node);
                            handleLocationChange(node.latitude, node.longitude);
                          }}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground font-medium"
                              : "border-border hover:bg-accent text-foreground",
                          )}
                        >
                          Node {idx + 1} ({node.latitude.toFixed(2)}°, {node.longitude.toFixed(2)}°)
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>

          {/* -------------------------------------------------
              Terrain & Slope Assessment
          ------------------------------------------------- */}

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mountain className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-medium">Terrain & Slope Assessment</h2>
              </div>

              {terrainQuery.isFetching && (
                <span className="flex items-center gap-1.5 text-xs text-sky-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading terrain data...
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              Topographic elevation and slope gradient calculated via Copernicus 90m DEM.
            </p>

            {/* Error state */}
            {terrainQuery.isError && (
              <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-300">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                  <div>
                    <strong className="font-semibold">Terrain data unavailable</strong>
                    <p className="mt-0.5 text-[11px] text-red-200/80">
                      {terrainQuery.error instanceof Error
                        ? terrainQuery.error.message
                        : "Failed to retrieve terrain parameters."}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Make sure the Python FastAPI service is running on <code>http://127.0.0.1:8000</code>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading placeholder when no data yet */}
            {terrainQuery.isLoading && !terrainQuery.data && !terrainQuery.isError && (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                Loading terrain data...
              </div>
            )}

            {/* Data display */}
            {terrainQuery.data && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-border/60 bg-background/50 p-2.5">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                      Elevation
                    </span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="font-mono text-2xl font-semibold text-foreground">
                        {Math.round(terrainQuery.data.elevation_m).toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">m MSL</span>
                    </div>
                  </div>

                  <div className="rounded-md border border-border/60 bg-background/50 p-2.5">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                      Slope Gradient
                    </span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="font-mono text-2xl font-semibold text-foreground">
                        {terrainQuery.data.slope_degrees.toFixed(1)}°
                      </span>
                      <span
                        className={cn(
                          "ml-1 text-xs font-medium",
                          terrainQuery.data.slope_category === "Very Steep"
                            ? "text-red-400"
                            : terrainQuery.data.slope_category === "Steep"
                              ? "text-orange-400"
                              : terrainQuery.data.slope_category === "Moderate"
                                ? "text-yellow-400"
                                : "text-emerald-400",
                        )}
                      >
                        ({terrainQuery.data.slope_category})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/50 px-3 py-2">
                  <span className="text-xs text-muted-foreground">Terrain Susceptibility</span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                      terrainQuery.data.terrain_susceptibility === "Very High"
                        ? "border-red-500/40 bg-red-500/10 text-red-300"
                        : terrainQuery.data.terrain_susceptibility === "High"
                          ? "border-orange-500/40 bg-orange-500/10 text-orange-300"
                          : terrainQuery.data.terrain_susceptibility === "Moderate"
                            ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
                            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
                    )}
                  >
                    {terrainQuery.data.terrain_susceptibility}
                  </span>
                </div>

                <p className="text-[10px] text-muted-foreground border-t border-border/40 pt-2">
                  Source: {terrainQuery.data.data_source || "Open-Meteo Elevation API / Copernicus DEM GLO-90"}
                </p>
              </div>
            )}
          </div>

          {/* -------------------------------------------------
              Antecedent Rainfall
          ------------------------------------------------- */}

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Antecedent Rainfall (mm)</h2>

              <div className="flex items-center gap-2">
                {rainfallQuery.isFetching && !isManualOverride && (
                  <span className="flex items-center gap-1 text-xs text-sky-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading rainfall...
                  </span>
                )}
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {isManualOverride
                    ? activePresetName
                      ? `Preset: ${activePresetName}`
                      : "Manual Override"
                    : "Auto-fetch enabled"}
                </span>
              </div>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              {isManualOverride
                ? "Custom or preset rainfall values will be evaluated."
                : "Five cumulative rainfall windows are automatically fetched for these coordinates."}
            </p>

            {/* -------------------------------------------------
                Get rainfall automatically button
            ------------------------------------------------- */}

            <button
              type="button"
              onClick={resetToLiveAuto}
              disabled={rainfallQuery.isFetching || assess.isPending}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60"
            >
              {rainfallQuery.isFetching && !isManualOverride ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading rainfall...
                </>
              ) : (
                <>
                  <CloudRain className="h-4 w-4" />
                  Get rainfall automatically
                </>
              )}
            </button>

            {rainfallQuery.isError && !isManualOverride && (
              <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-300">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                  <div>
                    <strong className="font-semibold">Unable to retrieve rainfall from the FastAPI service.</strong>
                    <p className="mt-0.5">
                      {rainfallQuery.error instanceof Error
                        ? rainfallQuery.error.message
                        : "Network error occurred."}
                    </p>
                    <p className="mt-1 text-[11px] text-red-200/80">
                      Make sure the Python backend is running on <code>http://127.0.0.1:8000</code>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!isManualOverride && rainfallQuery.data?.data_source && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Source: {rainfallQuery.data.data_source}
              </p>
            )}

            {/* -------------------------------------------------
                Rainfall fields
            ------------------------------------------------- */}

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label className="text-xs text-muted-foreground">
                1-Day Rainfall (mm)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={rainfallQuery.isLoading && !isManualOverride ? "Loading..." : "auto"}
                  value={currentR1d}
                  onChange={(event) => handleFieldChange("1d", event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>

              <label className="text-xs text-muted-foreground">
                3-Day Rainfall (mm)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={rainfallQuery.isLoading && !isManualOverride ? "Loading..." : "auto"}
                  value={currentR3d}
                  onChange={(event) => handleFieldChange("3d", event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>

              <label className="text-xs text-muted-foreground">
                7-Day Rainfall (mm)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={rainfallQuery.isLoading && !isManualOverride ? "Loading..." : "auto"}
                  value={currentR7d}
                  onChange={(event) => handleFieldChange("7d", event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>

              <label className="text-xs text-muted-foreground">
                14-Day Rainfall (mm)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={rainfallQuery.isLoading && !isManualOverride ? "Loading..." : "auto"}
                  value={currentR14d}
                  onChange={(event) => handleFieldChange("14d", event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>

              <label className="col-span-2 text-xs text-muted-foreground sm:col-span-1">
                30-Day Rainfall (mm)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={rainfallQuery.isLoading && !isManualOverride ? "Loading..." : "auto"}
                  value={currentR30d}
                  onChange={(event) => handleFieldChange("30d", event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
            </div>

            {/* -------------------------------------------------
                Presets & mode reset
            ------------------------------------------------- */}

            <div className="mt-3">
              <span className="text-[11px] text-muted-foreground">Preset scenarios (optional for testing):</span>

              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => loadPreset(preset)}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                      activePresetName === preset.name
                        ? "border-sky-500 bg-sky-500/20 text-sky-200"
                        : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {preset.name}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={resetToLiveAuto}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                    !isManualOverride
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <RotateCcw className="h-3 w-3" />
                  Auto-live mode
                </button>
              </div>
            </div>

            {/* -------------------------------------------------
                Validation warnings (only if manually overriding)
            ------------------------------------------------- */}

            {isManualOverride && hasNegative && (
              <div className="mt-3 flex items-center gap-2 rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Rainfall values cannot be negative.</span>
              </div>
            )}

            {isManualOverride && nonMonotonic && !hasNegative && (
              <div className="mt-3 flex items-center gap-2 rounded border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-yellow-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Notice: cumulative rainfall windows are non-monotonic.</span>
              </div>
            )}

            {isManualOverride && hasMissing && !hasNegative && (
              <div className="mt-3 flex items-center gap-2 rounded border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-yellow-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  One or more rainfall values are missing. The model will return Insufficient Data.
                </span>
              </div>
            )}

            {/* -------------------------------------------------
                Assess button
            ------------------------------------------------- */}

            <button
              type="button"
              onClick={() => {
                assess.mutate();
                currentRiskQuery.refetch();
              }}
              disabled={
                assess.isPending ||
                (currentRiskQuery.isFetching && !result) ||
                (rainfallQuery.isLoading && !isManualOverride) ||
                (isManualOverride && (hasNegative || hasMissing))
              }
              className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {assess.isPending || (currentRiskQuery.isFetching && !result) ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Assessing landslide risk...
                </span>
              ) : (
                "Assess landslide risk"
              )}
            </button>

            {(assess.isError || currentRiskQuery.isError) && (
              <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold">Prediction failed.</strong>
                    <p className="mt-0.5">
                      {String(assess.error?.message || currentRiskQuery.error?.message || "Prediction request failed.")}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Make sure the Python FastAPI server is running on: <code>http://127.0.0.1:8000</code>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* -------------------------------------------------
              CURRENT LANDSLIDE RISK SECTION
          ------------------------------------------------- */}

          {currentRiskQuery.isFetching && !result ? (
            <div className="rounded-lg border border-border bg-card p-6 flex flex-col items-center justify-center text-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground font-medium">
                Computing hybrid landslide risk…
              </span>
            </div>
          ) : result ? (
            <div
              className={cn(
                "rounded-lg border p-4",
                (result.finalRiskScore ?? 0) >= 80
                  ? "border-red-500/40 bg-red-500/5"
                  : (result.finalRiskScore ?? 0) >= 60
                    ? "border-orange-500/40 bg-orange-500/5"
                    : (result.finalRiskScore ?? 0) >= 40
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-emerald-500/30 bg-emerald-500/5",
              )}
            >
              {/* Section heading */}
              <div className="flex items-center justify-between border-b border-border/50 pb-2.5 mb-3">
                <span className="text-[10px] font-bold text-foreground uppercase tracking-widest">
                  Current Landslide Risk
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {result.district} · {result.lat.toFixed(4)}°N
                </span>
              </div>

              {/* Dominant score */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "font-mono text-5xl font-bold tabular-nums leading-none",
                        (result.finalRiskScore ?? 0) >= 80
                          ? "text-red-400"
                          : (result.finalRiskScore ?? 0) >= 60
                            ? "text-orange-400"
                            : (result.finalRiskScore ?? 0) >= 40
                              ? "text-amber-400"
                              : "text-emerald-400",
                      )}
                    >
                      {result.finalRiskScore !== null && result.finalRiskScore !== undefined
                        ? result.finalRiskScore.toFixed(1)
                        : "—"}
                    </span>
                    <span className="text-lg text-muted-foreground font-mono">/100</span>
                  </div>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Final Hybrid Risk Score
                  </p>
                </div>
                <RiskBadge
                  level={result.finalRiskLevel ?? result.level}
                  className="text-sm px-3 py-1 text-xs"
                />
              </div>

              {/* Breakdown grid */}
              <div className="mt-4 rounded-md border border-border/50 bg-background/50 divide-y divide-border/50">
                <div className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="text-muted-foreground font-medium">Rainfall ML Risk</span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-foreground">
                      {result.rainfallRiskScore !== null && result.rainfallRiskScore !== undefined
                        ? `${result.rainfallRiskScore.toFixed(1)} / 100`
                        : "—"}
                    </span>
                    <span className="ml-2 text-[10px] text-muted-foreground uppercase">
                      {result.rainfallRiskLevel ?? ""}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="text-muted-foreground font-medium">Terrain Susceptibility</span>
                  <span
                    className={cn(
                      "font-semibold",
                      result.terrainAssessment?.terrain_susceptibility === "Very High"
                        ? "text-red-400"
                        : result.terrainAssessment?.terrain_susceptibility === "High"
                          ? "text-orange-400"
                          : result.terrainAssessment?.terrain_susceptibility === "Moderate"
                            ? "text-yellow-400"
                            : "text-emerald-400",
                    )}
                  >
                    {result.terrainAssessment?.terrain_susceptibility ?? "Unavailable"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="text-muted-foreground font-medium">Slope</span>
                  <span className="font-mono font-semibold text-foreground">
                    {result.terrainAssessment?.slope_degrees !== undefined
                      ? `${result.terrainAssessment.slope_degrees.toFixed(1)}°`
                      : "—"}
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                      ({result.terrainAssessment?.slope_category ?? "—"})
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="text-muted-foreground font-medium">Elevation</span>
                  <span className="font-mono font-semibold text-foreground">
                    {result.terrainAssessment?.elevation_m !== undefined
                      ? `${Math.round(result.terrainAssessment.elevation_m).toLocaleString()} m`
                      : "—"}
                  </span>
                </div>
              </div>

              {/* Warning if terrain data unavailable */}
              {!result.terrainAssessment && (
                <div className="mt-3 flex items-center gap-2 rounded border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-yellow-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Terrain data unavailable — hybrid risk marked as Insufficient Data.</span>
                </div>
              )}

              {/* Feature importance */}
              <div className="mt-4 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-1.5">
                  ML Feature Importance (GBR)
                </p>
                {result.factors.map((factor: AssessmentFactor) => (
                  <div key={factor.label}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-foreground truncate pr-2">{factor.label}</span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {factor.value !== null && factor.value !== undefined
                          ? `${factor.value.toFixed(1)}mm`
                          : "—"}{" "}
                        · <strong className="text-foreground">{factor.importancePct}%</strong>
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-sky-500/70"
                        style={{ width: `${Math.min(100, factor.importancePct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Recommendation */}
              <p className="mt-4 rounded-md border border-border/50 bg-background/50 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
                {result.recommendation}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* -------------------------------------------------
          EARLY WARNING & AUTOMATED EMERGENCY ALERT SYSTEM
      ------------------------------------------------- */}
      <div className="mt-6">
        <EarlyWarningAlertPanel
          evaluation={alertEvaluation}
          isLoading={nearbyFacilitiesQuery.isLoading || currentRiskQuery.isLoading || futureRiskQuery.isLoading}
          radiusKm={alertRadiusKm}
          onRadiusChange={setAlertRadiusKm}
          onAcknowledge={handleAcknowledgeAlert}
          history={sessionAlertHistory}
        />
      </div>
    </>
  );
}
