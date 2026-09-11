import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
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
import {
  CloudRain,
  Clock,
  Compass,
  ArrowRight,
  RefreshCw,
  Droplets,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  MapPin,
} from "lucide-react";

import { getRainfallFeatures, getRainfallForecast } from "@/services/api";
import { PageHeader } from "@/components/common/PageHeader";
import { cn } from "@/lib/utils";
import { NER_STATES, type NERState } from "@/types";

export const Route = createFileRoute("/rainfall")({
  head: () => ({
    meta: [
      { title: "Bhurakshak — Rainfall Intelligence" },
      {
        name: "description",
        content:
          "Bhurakshak real-time antecedent precipitation monitoring and 72-hour NWP rainfall forecasts across 8 North Eastern Region states.",
      },
      { property: "og:title", content: "Bhurakshak — Rainfall Intelligence" },
      {
        property: "og:description",
        content:
          "Antecedent rainfall accumulation lags (1d, 3d, 7d, 14d, 30d) and multi-horizon precipitation forecasting for landslide hazard evaluation.",
      },
    ],
  }),
  component: RainfallPage,
});

/* ---------------------------------------------------------
   Preset Monitored Locations Across 8 NER States
--------------------------------------------------------- */
interface NerWatchpoint {
  name: string;
  state: NERState;
  lat: number;
  lng: number;
  terrainType: string;
}

const NER_PRESET_WATCHPOINTS: NerWatchpoint[] = [
  // Sikkim
  { name: "Gangtok (East Sikkim)", state: "Sikkim", lat: 27.3314, lng: 88.6138, terrainType: "Steep Urbanized Slopes" },
  { name: "Mangan (North Sikkim)", state: "Sikkim", lat: 27.505, lng: 88.532, terrainType: "High-Altitude Fault Zone" },
  { name: "Namchi (South Sikkim)", state: "Sikkim", lat: 27.1667, lng: 88.3667, terrainType: "Hilly Ridge" },
  // Arunachal Pradesh
  { name: "Itanagar (Papum Pare)", state: "Arunachal Pradesh", lat: 27.0844, lng: 93.6053, terrainType: "Sub-Himalayan Foothills" },
  { name: "Tawang", state: "Arunachal Pradesh", lat: 27.586, lng: 91.8594, terrainType: "High Alpine Valleys" },
  // Assam
  { name: "Guwahati (Kamrup)", state: "Assam", lat: 26.1445, lng: 91.7362, terrainType: "Brahmaputra Valley Margins" },
  { name: "Silchar (Cachar)", state: "Assam", lat: 24.8333, lng: 92.7789, terrainType: "Barak Valley Basin" },
  // Manipur
  { name: "Imphal (Imphal West)", state: "Manipur", lat: 24.817, lng: 93.9368, terrainType: "Intermontane Valley" },
  { name: "Churachandpur", state: "Manipur", lat: 24.3333, lng: 93.6667, terrainType: "Rugged Mountain Corridor" },
  // Meghalaya
  { name: "Shillong (East Khasi Hills)", state: "Meghalaya", lat: 25.5788, lng: 91.8933, terrainType: "Plateau Escarpment" },
  { name: "Cherrapunji (Sohra)", state: "Meghalaya", lat: 25.2702, lng: 91.7323, terrainType: "Hyper-Wet Karst Gorge" },
  // Mizoram
  { name: "Aizawl", state: "Mizoram", lat: 23.7271, lng: 92.7176, terrainType: "Steep Linear Anticlinal Ridges" },
  { name: "Lunglei", state: "Mizoram", lat: 22.8671, lng: 92.7358, terrainType: "Dissected Hilly Terrain" },
  // Nagaland
  { name: "Kohima", state: "Nagaland", lat: 25.6751, lng: 94.1086, terrainType: "Barail Range Crest" },
  { name: "Dimapur", state: "Nagaland", lat: 25.9042, lng: 93.7289, terrainType: "Piedmont Plain Border" },
  // Tripura
  { name: "Agartala (West Tripura)", state: "Tripura", lat: 23.8315, lng: 91.2868, terrainType: "Alluvial Lowlands" },
  { name: "Dharmanagar (North Tripura)", state: "Tripura", lat: 24.38, lng: 92.16, terrainType: "Undulating Hillocks" },
];

/* ---------------------------------------------------------
   IMD Rainfall Classification Helper
--------------------------------------------------------- */
function getIMDClassification(hourlyMaxMm: number, total24hMm: number): {
  label: string;
  category: string;
  color: string;
  bg: string;
  badgeBg: string;
  description: string;
} {
  if (total24hMm >= 204.5 || hourlyMaxMm >= 25) {
    return {
      label: "Extremely Heavy Rain",
      category: "Red Category",
      color: "text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/30",
      badgeBg: "bg-purple-600 text-white",
      description: "Precipitation ≥ 204.5 mm in 24h. Extremely critical trigger for debris flows and flash landslides.",
    };
  }
  if (total24hMm >= 115.6 || hourlyMaxMm >= 15) {
    return {
      label: "Very Heavy Rain",
      category: "Orange Category",
      color: "text-red-400",
      bg: "bg-red-500/10 border-red-500/30",
      badgeBg: "bg-red-600 text-white",
      description: "Precipitation 115.6 - 204.4 mm in 24h. High pore-pressure escalation on vulnerable slopes.",
    };
  }
  if (total24hMm >= 64.5 || hourlyMaxMm >= 7.5) {
    return {
      label: "Heavy Rain",
      category: "Yellow Category",
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/30",
      badgeBg: "bg-amber-600 text-white",
      description: "Precipitation 64.5 - 115.5 mm in 24h. Significant slope saturation alert threshold.",
    };
  }
  if (total24hMm >= 15.6 || hourlyMaxMm >= 2.5) {
    return {
      label: "Moderate Rain",
      category: "Advisory Category",
      color: "text-yellow-400",
      bg: "bg-yellow-500/10 border-yellow-500/30",
      badgeBg: "bg-yellow-600/30 text-yellow-300",
      description: "Precipitation 15.6 - 64.4 mm in 24h. Steady infiltration into regional colluvial covers.",
    };
  }
  if (total24hMm >= 2.5 || hourlyMaxMm >= 0.2) {
    return {
      label: "Light Rain",
      category: "Normal Category",
      color: "text-sky-400",
      bg: "bg-sky-500/10 border-sky-500/30",
      badgeBg: "bg-sky-600/30 text-sky-300",
      description: "Precipitation 2.5 - 15.5 mm in 24h. Routine antecedent wetting conditions.",
    };
  }
  return {
    label: "Very Light / Dry",
    category: "Clear Conditions",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    badgeBg: "bg-emerald-600/30 text-emerald-300",
    description: "Precipitation < 2.5 mm in 24h. Baseline ground moisture.",
  };
}

const axisStyle = { stroke: "#94a3b8", fontSize: 11 };
const tooltipStyle = {
  contentStyle: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderRadius: "0.5rem",
    fontSize: "12px",
    color: "#f8fafc",
  },
};

function RainfallPage() {
  const [selectedState, setSelectedState] = useState<NERState>("Sikkim");
  const [selectedWatchpoint, setSelectedWatchpoint] = useState<NerWatchpoint>(NER_PRESET_WATCHPOINTS[0]!);
  const [lat, setLat] = useState<number>(NER_PRESET_WATCHPOINTS[0]!.lat);
  const [lng, setLng] = useState<number>(NER_PRESET_WATCHPOINTS[0]!.lng);
  const [activeChartTab, setActiveChartTab] = useState<"hourly" | "cumulative">("hourly");

  // Filter presets for current state
  const statePresets = useMemo(() => {
    return NER_PRESET_WATCHPOINTS.filter((p) => p.state === selectedState);
  }, [selectedState]);

  // Handle state switch
  const handleStateSelect = (st: NERState) => {
    setSelectedState(st);
    const first = NER_PRESET_WATCHPOINTS.find((p) => p.state === st) || NER_PRESET_WATCHPOINTS[0]!;
    setSelectedWatchpoint(first);
    setLat(first.lat);
    setLng(first.lng);
  };

  // Handle watchpoint switch
  const handleWatchpointSelect = (wp: NerWatchpoint) => {
    setSelectedWatchpoint(wp);
    setLat(wp.lat);
    setLng(wp.lng);
  };

  /* ---------------------------------------------------------
     Live Telemetry Queries (Open-Meteo seamless via backend)
  --------------------------------------------------------- */
  const rainfallFeaturesQuery = useQuery({
    queryKey: ["weather-rainfall", lat, lng],
    queryFn: () => getRainfallFeatures(lat, lng),
    staleTime: 60 * 1000,
    retry: 1,
  });

  const rainfallForecastQuery = useQuery({
    queryKey: ["weather-forecast", lat, lng],
    queryFn: () => getRainfallForecast(lat, lng, 72),
    staleTime: 60 * 1000,
    retry: 1,
  });

  const rfData = rainfallFeaturesQuery.data;
  const fcData = rainfallForecastQuery.data;

  // Forecast calculations
  const {
    forecast6h,
    forecast24h,
    forecast48h,
    forecast72h,
    maxProb,
    peakHourly,
    chartData,
  } = useMemo(() => {
    if (!fcData || !fcData.forecast || fcData.forecast.length === 0) {
      return {
        forecast6h: 0,
        forecast24h: 0,
        forecast48h: 0,
        forecast72h: 0,
        maxProb: 0,
        peakHourly: 0,
        chartData: [],
      };
    }

    const items = fcData.forecast;
    let sum6 = 0;
    let sum24 = 0;
    let sum48 = 0;
    let sum72 = 0;
    let maxP = 0;
    let peak = 0;
    let cum = 0;

    const formatted = items.map((item, idx) => {
      const mm = Number(item.rainfall_mm || 0);
      const prob = Number(item.precipitation_probability || 0);
      if (idx < 6) sum6 += mm;
      if (idx < 24) sum24 += mm;
      if (idx < 48) sum48 += mm;
      if (idx < 72) sum72 += mm;
      if (prob > maxP) maxP = prob;
      if (mm > peak) peak = mm;
      cum += mm;

      // Extract hour label (e.g. "+1h", "+12h", "14:00")
      const timeStr = item.time ? item.time.split("T")[1]?.slice(0, 5) || `+${idx}h` : `+${idx}h`;
      return {
        idx: idx + 1,
        time: timeStr,
        fullTime: item.time,
        rainfall: Number(mm.toFixed(2)),
        cumulative: Number(cum.toFixed(2)),
        probability: prob,
        temperature: item.temperature_c,
      };
    });

    return {
      forecast6h: Number(sum6.toFixed(1)),
      forecast24h: Number(sum24.toFixed(1)),
      forecast48h: Number(sum48.toFixed(1)),
      forecast72h: Number(sum72.toFixed(1)),
      maxProb: Math.round(maxP),
      peakHourly: Number((fcData.max_hourly_rainfall_mm ?? peak).toFixed(1)),
      chartData: formatted,
    };
  }, [fcData]);

  // IMD Intensity Rating
  const imdRating = useMemo(() => {
    return getIMDClassification(peakHourly, forecast24h);
  }, [peakHourly, forecast24h]);

  const isLoading = rainfallFeaturesQuery.isLoading || rainfallForecastQuery.isLoading;
  const isError = rainfallFeaturesQuery.isError || rainfallForecastQuery.isError;

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------------------
          HEADER & DATA CONNECTION BADGE
      ------------------------------------------------------------- */}
      <PageHeader
        title="Rainfall Intelligence & NWP Forecast"
        description="Antecedent accumulation lags and multi-horizon Numerical Weather Prediction for the 8 North Eastern Region (NER) states."
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
            <CloudRain className="h-3 w-3 text-sky-400" />
            NWP Live
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
              <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
              Live Telemetry Connected
            </span>

            <button
              type="button"
              onClick={() => {
                rainfallFeaturesQuery.refetch();
                rainfallForecastQuery.refetch();
              }}
              disabled={isLoading}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
              Refresh
            </button>

            <Link
              to="/assessment"
              search={{ lat, lng }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
            >
              Use in Risk Assessment
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        }
      />

      {/* -------------------------------------------------------------
          NER STATE SELECTOR (8 STATES)
      ------------------------------------------------------------- */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5 text-sky-400" />
            Select North Eastern Region (NER) State
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">
            8 NER States Coverage
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {NER_STATES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => handleStateSelect(st)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                selectedState === st
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs ring-1 ring-primary"
                  : "border border-border bg-background/60 text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {st}
            </button>
          ))}
        </div>

        {/* State Presets & Coordinates Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-sky-400" />
              Watchpoints in {selectedState}:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {statePresets.map((wp) => (
                <button
                  key={wp.name}
                  type="button"
                  onClick={() => handleWatchpointSelect(wp)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    selectedWatchpoint.name === wp.name
                      ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                      : "bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {wp.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span>Coordinates:</span>
            <span className="font-semibold text-foreground bg-accent/50 px-2 py-0.5 rounded">
              {lat.toFixed(4)}°N, {lng.toFixed(4)}°E
            </span>
            <span className="text-[11px] text-sky-400">({selectedWatchpoint.terrainType})</span>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          TOP METEOROLOGICAL & IMD CLASSIFICATION BANNER
      ------------------------------------------------------------- */}
      <div className={cn("rounded-xl border p-4 sm:p-5 transition-all shadow-xs", imdRating.bg)}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className={cn("rounded px-2.5 py-0.5 text-xs font-bold uppercase", imdRating.badgeBg)}>
                IMD {imdRating.category}
              </span>
              <h3 className={cn("text-lg font-bold tracking-tight", imdRating.color)}>
                {imdRating.label}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {imdRating.description}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
              <span>
                Peak Hourly Intensity: <strong className="font-mono text-foreground">{peakHourly} mm/h</strong>
              </span>
              <span>•</span>
              <span>
                24h Forecast Total: <strong className="font-mono text-foreground">{forecast24h} mm</strong>
              </span>
              <span>•</span>
              <span>
                Max Precipitation Probability: <strong className="font-mono text-foreground">{maxProb}%</strong>
              </span>
            </div>
          </div>

          {/* Primary CTA Card */}
          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            <Link
              to="/assessment"
              search={{ lat, lng }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all hover:scale-[1.02]"
            >
              Run Landslide Assessment for this Site
              <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-[10px] text-muted-foreground">
              Passes ({lat.toFixed(3)}°N, {lng.toFixed(3)}°E) directly to ML Inference
            </span>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          ANTECEDENT RAINFALL ACCUMULATION CARDS (1d, 3d, 7d, 14d, 30d)
      ------------------------------------------------------------- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-sky-400" />
            Antecedent Rainfall Accumulation (Model Lags)
          </h3>
          <span className="text-[10px] text-muted-foreground">
            Source: {rfData?.data_source || "Open-Meteo Archive / Reanalysis"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {/* 1d */}
          <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground block">
              1-Day Rainfall
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-foreground">
                {isLoading ? "—" : (rfData?.rainfall_1d ?? 0).toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">mm</span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Immediate surface wetting
            </span>
          </div>

          {/* 3d */}
          <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground block">
              3-Day Rainfall
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-foreground">
                {isLoading ? "—" : (rfData?.rainfall_3d ?? 0).toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">mm</span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Soil mantle saturation
            </span>
          </div>

          {/* 7d */}
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase text-sky-400 block">
                7-Day Rainfall
              </span>
              <span className="rounded bg-sky-500/20 px-1 py-0.2 text-[9px] font-bold text-sky-300">
                PRIMARY LAG
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-sky-300">
                {isLoading ? "—" : (rfData?.rainfall_7d ?? 0).toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">mm</span>
            </div>
            <span className="text-[10px] text-sky-400/80 block mt-0.5">
              Key ML feature weight
            </span>
          </div>

          {/* 14d */}
          <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground block">
              14-Day Rainfall
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-foreground">
                {isLoading ? "—" : (rfData?.rainfall_14d ?? 0).toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">mm</span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Deep regolith seepage
            </span>
          </div>

          {/* 30d */}
          <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground block">
              30-Day Cumulative
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-foreground">
                {isLoading ? "—" : (rfData?.rainfall_30d ?? 0).toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">mm</span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Regional base groundwater
            </span>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          MULTI-HORIZON NWP FORECAST PROJECTIONS (6h, 24h, 48h, 72h)
      ------------------------------------------------------------- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-sky-400" />
            72-Hour Numerical Weather Prediction Horizons
          </h3>
          <span className="text-[10px] text-muted-foreground">
            Source: {fcData?.data_source || "Open-Meteo NWP Forecast"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground block">
              +6 Hour Forecast
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-foreground">
                {isLoading ? "—" : forecast6h}
              </span>
              <span className="text-xs text-muted-foreground">mm</span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Immediate threat window
            </span>
          </div>

          <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground block">
              +24 Hour Forecast
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-foreground">
                {isLoading ? "—" : forecast24h}
              </span>
              <span className="text-xs text-muted-foreground">mm</span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Daily operational cycle
            </span>
          </div>

          <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground block">
              +48 Hour Forecast
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-foreground">
                {isLoading ? "—" : forecast48h}
              </span>
              <span className="text-xs text-muted-foreground">mm</span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Medium-term advisory
            </span>
          </div>

          <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground block">
              +72 Hour Total
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-foreground">
                {isLoading ? "—" : forecast72h}
              </span>
              <span className="text-xs text-muted-foreground">mm</span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Extended horizon outlook
            </span>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          72-HOUR FORECAST CHART (HOURLY PRECIPITATION & CUMULATIVE)
      ------------------------------------------------------------- */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              72-Hour Precipitation & Probability Forecast
            </h3>
            <p className="text-xs text-muted-foreground">
              Hourly resolution Numerical Weather Prediction for {selectedWatchpoint.name}
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveChartTab("hourly")}
              className={cn(
                "rounded px-2.5 py-1 font-medium transition-colors",
                activeChartTab === "hourly"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Hourly Rain & Probability
            </button>
            <button
              type="button"
              onClick={() => setActiveChartTab("cumulative")}
              className={cn(
                "rounded px-2.5 py-1 font-medium transition-colors",
                activeChartTab === "cumulative"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Cumulative Accrual Curve
            </button>
          </div>
        </div>

        <div className="h-[320px] w-full">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Loading 72-hour forecast curve...
            </div>
          ) : isError ? (
            <div className="flex h-full items-center justify-center text-xs text-red-400">
              Failed to load meteorological forecast. Please check backend connection.
            </div>
          ) : activeChartTab === "hourly" ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="rainFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="probFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="time" {...axisStyle} interval={5} />
                <YAxis yAxisId="left" {...axisStyle} unit=" mm" />
                <YAxis yAxisId="right" orientation="right" {...axisStyle} domain={[0, 100]} unit="%" />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="rainfall"
                  name="Hourly Rain (mm)"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  fill="url(#rainFill)"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="probability"
                  name="Precipitation Probability (%)"
                  stroke="#a855f7"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="url(#probFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="time" {...axisStyle} interval={5} />
                <YAxis {...axisStyle} unit=" mm" />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  name="Cumulative Accrual (mm)"
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  fill="url(#cumFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------
          BOTTOM ACTION & NEXT STEP GUIDANCE
      ------------------------------------------------------------- */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 max-w-xl">
          <h4 className="text-sm font-semibold text-foreground">
            Pipeline Next Step: ML Hazard Assessment
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            These precipitation metrics (1d, 3d, 7d, 14d, 30d antecedent lags plus future forecast horizons)
            are directly fed into the GradientBoostingRegressor model combined with Copernicus 90m DEM terrain slope.
          </p>
        </div>

        <Link
          to="/assessment"
          search={{ lat, lng }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
        >
          Assess Landslide Risk at {selectedWatchpoint.name}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
