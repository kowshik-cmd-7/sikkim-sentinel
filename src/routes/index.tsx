import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import {
  AlertTriangle,
  Bell,
  CloudRain,
  Mountain,
  TrendingUp,
  Radio,
  Clock,
  ArrowRight,
  ShieldAlert,
  Compass,
  Layers,
  FileText,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  MapPin,
  Flame,
} from "lucide-react";
import {
  getRainfallFeatures,
  getRainfallForecast,
  getTerrainFeatures,
  predictAllForecastHorizons,
  type HorizonRiskAssessment,
} from "@/services/api";
import { getStoredAlerts } from "@/services/alertService";
import { getStoredFieldReports } from "@/services/fieldReportService";
import { PageHeader } from "@/components/common/PageHeader";
import { MapPanel } from "@/components/map/MapPanel";
import { StateSelectorBar } from "@/components/risk/StateSelectorBar";
import { StateRiskSummaryCards } from "@/components/risk/StateRiskSummaryCards";
import { useStateRiskGrid } from "@/hooks/useStateRiskGrid";
import { formatDateTime } from "@/utils/risk";
import { SIKKIM_CENTER } from "@/data/sikkim";
import { cn } from "@/lib/utils";
import type { CalculatedRiskPoint, DashboardAlert, FieldReport } from "@/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Command Dashboard — NER Landslide Early Warning" },
      {
        name: "description",
        content:
          "AI-powered landslide monitoring command dashboard for North Eastern Region states: dynamic risk heatmap, telemetry alerts, multi-horizon forecasts, and emergency response queue.",
      },
      { property: "og:title", content: "Command Dashboard — NER Landslide Early Warning" },
      {
        property: "og:description",
        content: "Dynamic NER landslide risk heatmap backed by live telemetry and trained ML models.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  /* -------------------------------------------------------
     1. State-Wide Risk Grid & Boundary Hook (NER States Only)
  ------------------------------------------------------- */
  const stateRisk = useStateRiskGrid({
    storageKey: "dashboard_selected_state",
    defaultState: "Sikkim",
  });

  const [selectedPoint, setSelectedPoint] = useState<CalculatedRiskPoint | null>(null);

  /* -------------------------------------------------------
     2. Local Storage Stores: Alerts & Field Reports
  ------------------------------------------------------- */
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [fieldReports, setFieldReports] = useState<FieldReport[]>([]);

  useEffect(() => {
    setAlerts(getStoredAlerts());
    setFieldReports(getStoredFieldReports());

    const handleFocus = () => {
      setAlerts(getStoredAlerts());
      setFieldReports(getStoredFieldReports());
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  /* -------------------------------------------------------
     3. Derived Hotspots & Representative Telemetry Coordinate
  ------------------------------------------------------- */
  const calculatedPoints = stateRisk.calculatedPoints;

  // Find the highest-risk calculated point in the currently selected state
  const highestRiskPoint = useMemo(() => {
    if (!calculatedPoints.length) return null;
    const sorted = [...calculatedPoints].sort(
      (a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0)
    );
    return sorted[0];
  }, [calculatedPoints]);

  const repLat = highestRiskPoint?.latitude ?? (stateRisk.selectedState === "Sikkim" ? SIKKIM_CENTER[0] : 26.2);
  const repLng = highestRiskPoint?.longitude ?? (stateRisk.selectedState === "Sikkim" ? SIKKIM_CENTER[1] : 92.9);
  const repLocationName = highestRiskPoint?.locationName || `${stateRisk.selectedState} High Watchpoint`;

  /* -------------------------------------------------------
     4. Live Weather, Forecast & Multi-Horizon Projections
  ------------------------------------------------------- */
  const rainfallQuery = useQuery({
    queryKey: ["dashboard-rainfall", repLat, repLng],
    queryFn: () => getRainfallFeatures(repLat, repLng),
    staleTime: 60 * 1000,
    retry: 1,
  });

  const forecastQuery = useQuery({
    queryKey: ["dashboard-forecast", repLat, repLng],
    queryFn: () => getRainfallForecast(repLat, repLng, 72),
    staleTime: 60 * 1000,
    retry: 1,
  });

  const terrainQuery = useQuery({
    queryKey: ["dashboard-terrain", repLat, repLng],
    queryFn: () => getTerrainFeatures(repLat, repLng),
    staleTime: 60 * 1000,
    retry: 1,
  });

  const futureRiskQuery = useQuery({
    queryKey: [
      "dashboard-future-risk",
      repLat,
      repLng,
      rainfallQuery.data?.rainfall_1d,
      rainfallQuery.data?.rainfall_3d,
      rainfallQuery.data?.rainfall_7d,
      rainfallQuery.data?.rainfall_14d,
      rainfallQuery.data?.rainfall_30d,
      forecastQuery.data?.forecast?.length,
      terrainQuery.data?.slope_degrees,
      terrainQuery.data?.terrain_susceptibility,
    ],
    queryFn: async (): Promise<HorizonRiskAssessment[]> => {
      if (!rainfallQuery.data || !forecastQuery.data?.forecast?.length) {
        return [];
      }
      return predictAllForecastHorizons(
        rainfallQuery.data,
        forecastQuery.data.forecast,
        terrainQuery.data ?? null
      );
    },
    enabled:
      Boolean(rainfallQuery.data) &&
      Boolean(forecastQuery.data?.forecast?.length) &&
      !Number.isNaN(repLat) &&
      !Number.isNaN(repLng),
    staleTime: 60 * 1000,
    retry: 1,
  });

  // Calculate forecast rainfall totals
  const next24hForecastMm = useMemo(() => {
    if (!forecastQuery.data?.forecast?.length) return null;
    return forecastQuery.data.forecast
      .slice(0, 24)
      .reduce((acc, item) => acc + (item.rainfall_mm || 0), 0);
  }, [forecastQuery.data]);

  const next72hForecastMm = useMemo(() => {
    if (!forecastQuery.data) return null;
    return forecastQuery.data.total_rainfall_mm;
  }, [forecastQuery.data]);

  /* -------------------------------------------------------
     5. Alerts Analytics & Categorization
  ------------------------------------------------------- */
  const activeAlerts = useMemo(
    () => alerts.filter((a) => a.status === "ACTIVE"),
    [alerts]
  );
  const veryHighAlerts = useMemo(
    () => activeAlerts.filter((a) => a.severity === "VERY_HIGH"),
    [activeAlerts]
  );
  const highAlerts = useMemo(
    () => activeAlerts.filter((a) => a.severity === "HIGH"),
    [activeAlerts]
  );
  const acknowledgedAlertsCount = useMemo(
    () => alerts.filter((a) => a.status === "ACKNOWLEDGED").length,
    [alerts]
  );
  const resolvedAlertsCount = useMemo(
    () => alerts.filter((a) => a.status === "RESOLVED").length,
    [alerts]
  );

  /* -------------------------------------------------------
     6. Emergency Response Priority Queue
  ------------------------------------------------------- */
  const emergencyPriorityList = useMemo(() => {
    if (!calculatedPoints.length) return [];
    return [...calculatedPoints]
      .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
      .slice(0, 5)
      .map((pt, idx) => {
        const score = pt.riskScore ?? 0;
        let priorityCategory: "CRITICAL" | "HIGH" | "NORMAL" = "NORMAL";
        let action = "Continue routine rainfall and satellite monitoring";
        let priorityBadgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";

        if (score >= 80) {
          priorityCategory = "CRITICAL";
          action = "Immediate warning dispatch, evacuation advisory & roadway closure inspection";
          priorityBadgeClass = "bg-red-500/10 text-red-400 border-red-500/30";
        } else if (score >= 60) {
          priorityCategory = "HIGH";
          action = "Deploy field verification team to inspect tension cracks & drainage culverts";
          priorityBadgeClass = "bg-orange-500/10 text-orange-400 border-orange-500/30";
        } else if (score >= 40) {
          action = "Active surveillance on drainage corridors; monitor antecedent rain accumulation";
          priorityBadgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/30";
        }

        return {
          rank: idx + 1,
          point: pt,
          priorityCategory,
          action,
          priorityBadgeClass,
        };
      });
  }, [calculatedPoints]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title="NER Landslide Command Dashboard"
        description="Real-time hazard monitoring across 8 North Eastern Region states · AI-Based Early Warning System · SIH 26001"
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        }
      />

      {/* SIH End-to-End Operational Pipeline Ribbon */}
      <div className="rounded-lg border border-border bg-card/50 px-4 py-2.5 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1 shrink-0 mr-2">
            <Layers className="h-3 w-3 text-sky-400" />
            Pipeline
          </span>
          <Link to="/rainfall" className="flex items-center gap-1 rounded px-2 py-1 bg-sky-500/10 text-sky-300 border border-sky-500/20 hover:bg-sky-500/20 transition-colors text-[11px] font-semibold whitespace-nowrap">
            1. MONITOR
          </Link>
          <span className="text-muted-foreground text-xs">→</span>
          <Link to="/assessment" className="flex items-center gap-1 rounded px-2 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20 transition-colors text-[11px] font-semibold whitespace-nowrap">
            2. ASSESS
          </Link>
          <span className="text-muted-foreground text-xs">→</span>
          <Link to="/assessment" className="flex items-center gap-1 rounded px-2 py-1 bg-purple-500/10 text-purple-300 border border-purple-500/20 hover:bg-purple-500/20 transition-colors text-[11px] font-semibold whitespace-nowrap">
            3. PREDICT
          </Link>
          <span className="text-muted-foreground text-xs">→</span>
          <Link to="/analytics" className="flex items-center gap-1 rounded px-2 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors text-[11px] font-semibold whitespace-nowrap">
            4. ANALYZE
          </Link>
          <span className="text-muted-foreground text-xs">→</span>
          <Link to="/alerts" className="flex items-center gap-1 rounded px-2 py-1 bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20 transition-colors text-[11px] font-semibold whitespace-nowrap">
            5. WARN
          </Link>
          <span className="text-muted-foreground text-xs">→</span>
          <Link to="/report" className="flex items-center gap-1 rounded px-2 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors text-[11px] font-semibold whitespace-nowrap">
            6. REPORT
          </Link>
          <span className="text-muted-foreground text-xs">→</span>
          <Link to="/historical" className="flex items-center gap-1 rounded px-2 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 transition-colors text-[11px] font-semibold whitespace-nowrap">
            7. HISTORY
          </Link>
        </div>
      </div>

      {/* NER State Selector Bar */}
      <StateSelectorBar
        selectedState={stateRisk.selectedState}
        states={stateRisk.statesQuery.data ?? []}
        onStateChange={stateRisk.handleStateChange}
        calcStatus={stateRisk.calcStatus}
        calcProgress={stateRisk.calcProgress}
        assessedCount={stateRisk.stateSummary.assessedCount}
        isBoundaryError={stateRisk.boundaryQuery.isError}
        onRefresh={stateRisk.handleRefresh}
      />

      {/* Real Calculated State Risk Summary Cards */}
      <StateRiskSummaryCards summary={stateRisk.stateSummary} />

      {/* Main Row: Map + Early Warning & Operations Queue */}
      <div className="grid gap-6 xl:grid-cols-12">
        {/* Interactive Dynamic Risk Heatmap */}
        <div className="space-y-3 xl:col-span-8">
          <MapPanel
            stateBoundary={stateRisk.boundaryQuery.data}
            selectedStateName={stateRisk.selectedState}
            calculatedRiskPoints={stateRisk.calculatedPoints}
            onSelectCalculatedPoint={(pt) => setSelectedPoint(pt)}
            fieldReports={fieldReports}
            height={530}
          />

          {/* Selected Calculated Point Drawer / Action Deck */}
          {selectedPoint && (
            <div className="rounded-lg border border-primary/40 bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-sm">
                      {selectedPoint.locationName || `${stateRisk.selectedState} Grid Node`}
                    </span>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-bold text-white uppercase",
                        (selectedPoint.riskScore ?? 0) >= 80
                          ? "bg-red-600"
                          : (selectedPoint.riskScore ?? 0) >= 60
                            ? "bg-orange-600"
                            : (selectedPoint.riskScore ?? 0) >= 40
                              ? "bg-amber-600"
                              : "bg-emerald-600"
                      )}
                    >
                      {selectedPoint.riskLevel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Coordinates: {selectedPoint.latitude.toFixed(4)}°N, {selectedPoint.longitude.toFixed(4)}°E ·{" "}
                    Elevation: {selectedPoint.elevation != null ? `${Math.round(selectedPoint.elevation)}m` : "N/A"} ·{" "}
                    Slope: {selectedPoint.slope != null ? `${selectedPoint.slope.toFixed(1)}°` : "N/A"} (
                    {selectedPoint.terrainSusceptibility || "Moderate"}) ·{" "}
                    7d Rain: {selectedPoint.rainfall7d != null ? `${selectedPoint.rainfall7d.toFixed(1)}mm` : "N/A"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to="/assessment"
                    search={{
                      lat: Number(selectedPoint.latitude.toFixed(4)),
                      lng: Number(selectedPoint.longitude.toFixed(4)),
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                  >
                    <TrendingUp className="h-3.5 w-3.5" /> Assess Location
                  </Link>
                  <Link
                    to="/alerts"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent text-foreground"
                  >
                    <Bell className="h-3.5 w-3.5 text-red-400" /> View Alerts
                  </Link>
                  <button
                    onClick={() => setSelectedPoint(null)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted text-xs"
                    title="Close point inspection"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Early Warning & Alerts + Emergency Priority Queue */}
        <div className="space-y-6 xl:col-span-4">
          {/* Live Alerts Status Card */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-400" />
                <h2 className="text-sm font-semibold text-foreground">Early Warning Alerts</h2>
              </div>
              <Link
                to="/alerts"
                className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"
              >
                Alerts Console <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Alert Status Pills */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border/70 bg-background/50 p-2.5">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Active Alerts
                </span>
                <p className="text-lg font-bold font-mono text-foreground mt-0.5">
                  {activeAlerts.length}
                </p>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  <span className="text-red-400 font-medium">{veryHighAlerts.length} Very High</span> ·{" "}
                  <span className="text-orange-400 font-medium">{highAlerts.length} High</span>
                </div>
              </div>

              <div className="rounded-md border border-border/70 bg-background/50 p-2.5">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Response Progress
                </span>
                <p className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                  {acknowledgedAlertsCount + resolvedAlertsCount}
                </p>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {acknowledgedAlertsCount} Ack · {resolvedAlertsCount} Resolved
                </div>
              </div>
            </div>

            {/* Alerts List */}
            {activeAlerts.length > 0 ? (
              <div className="space-y-2">
                <span className="text-[11px] font-medium text-muted-foreground">
                  High-Priority Active Alerts
                </span>
                <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                  {activeAlerts.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      className="rounded-md border border-red-500/20 bg-red-950/20 p-2.5 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {a.locationLabel || stateRisk.selectedState} Corridor
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.2 text-[9px] font-bold text-white uppercase",
                            a.severity === "VERY_HIGH" ? "bg-red-600" : "bg-orange-600"
                          )}
                        >
                          {a.severity.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {a.message}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 pt-1 border-t border-border/40">
                        <span>Horizon: {a.horizon}</span>
                        <span>Score: {(a.finalRiskScore ?? a.riskScore).toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-md border border-emerald-500/30 bg-emerald-950/15 p-3 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">No Active Landslide Alerts</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    All monitored stations in {stateRisk.selectedState} are currently within manageable thresholds.
                  </p>
                </div>
              </div>
            )}

            <Link
              to="/alerts"
              className="flex items-center justify-center gap-1.5 rounded-md bg-accent/60 py-2 text-xs font-medium text-foreground hover:bg-accent border border-border transition-colors"
            >
              <Bell className="h-3.5 w-3.5 text-red-400" />
              Dispatch & Lifecycle Console
            </Link>
          </div>

          {/* Emergency Priority Queue */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-orange-400" />
                <h2 className="text-sm font-semibold text-foreground">
                  Emergency Response Priority
                </h2>
              </div>
              <span className="text-[11px] text-muted-foreground">Top Hazard Hotspots</span>
            </div>

            {emergencyPriorityList.length > 0 ? (
              <div className="space-y-2.5">
                {emergencyPriorityList.map((item) => (
                  <div
                    key={`priority-${item.point.latitude}-${item.point.longitude}`}
                    className="rounded-md border border-border/80 bg-background/50 p-2.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
                          {item.rank}
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          {item.point.locationName || `${stateRisk.selectedState} Point`}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase border",
                          item.priorityBadgeClass
                        )}
                      >
                        {item.priorityCategory} ({item.point.riskScore?.toFixed(1) ?? "0"}%)
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">Next Action:</span> {item.action}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                      <span>
                        Slope: {item.point.slope != null ? `${item.point.slope.toFixed(1)}°` : "N/A"} · Rain:{" "}
                        {item.point.rainfall7d != null ? `${item.point.rainfall7d.toFixed(1)}mm` : "N/A"}
                      </span>
                      <Link
                        to="/assessment"
                        search={{
                          lat: Number(item.point.latitude.toFixed(4)),
                          lng: Number(item.point.longitude.toFixed(4)),
                        }}
                        className="text-sky-400 hover:underline flex items-center gap-0.5 font-medium"
                      >
                        Assess <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1 text-sky-400" />
                Calculating emergency priority queue for {stateRisk.selectedState}…
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Horizon Future Landslide Risk (6h / 24h / 48h / 72h) & Representative Weather Card */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Multi-Horizon Future Risk Cards */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-400" />
                <h2 className="text-sm font-semibold text-foreground">
                  Multi-Horizon Future Landslide Risk Projections
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Hybrid predictive projections combining forecast rainfall escalation with DEM terrain susceptibility for{" "}
                <strong className="text-foreground">{repLocationName}</strong>.
              </p>
            </div>
            <Link
              to="/assessment"
              search={{ lat: Number(repLat.toFixed(4)), lng: Number(repLng.toFixed(4)) }}
              className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"
            >
              Full Forecast Analysis <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {futureRiskQuery.isLoading ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-sky-400" />
              Evaluating 6h, 24h, 48h, and 72h hybrid risk horizons via trained ML model…
            </div>
          ) : futureRiskQuery.data && futureRiskQuery.data.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {futureRiskQuery.data.map((h) => {
                const score = h.finalRiskScore ?? h.riskScore ?? 0;
                const level = h.finalRiskLevel ?? h.riskLevel ?? "Low";
                return (
                  <div
                    key={h.key}
                    className="rounded-lg border border-border/80 bg-background/60 p-3.5 space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {h.label}
                      </span>
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>

                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold font-mono text-foreground">
                        {score.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground">/ 100</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-bold text-white uppercase",
                          score >= 80
                            ? "bg-red-600"
                            : score >= 60
                              ? "bg-orange-600"
                              : score >= 40
                                ? "bg-amber-600"
                                : "bg-emerald-600"
                        )}
                      >
                        {level}
                      </span>
                      <span className="text-[11px] text-sky-400 font-mono">
                        {h.forecastRainfallMm?.toFixed(1) ?? "0.0"} mm
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-border/80 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
              Awaiting telemetry from Open-Meteo forecast feeds for {repLocationName}.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground bg-muted/30 p-2.5 rounded-md">
            <span>
              Watchpoint: <strong>{repLat.toFixed(4)}°N, {repLng.toFixed(4)}°E</strong> (Elevation:{" "}
              {terrainQuery.data?.elevation_m != null ? `${Math.round(terrainQuery.data.elevation_m)}m` : "N/A"}, Slope:{" "}
              {terrainQuery.data?.slope_degrees != null ? `${terrainQuery.data.slope_degrees.toFixed(1)}°` : "N/A"})
            </span>
            <span>Trained GradientBoostingRegressor + Hybrid Topography</span>
          </div>
        </div>

        {/* Representative Weather & Precipitation Telemetry */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4 lg:col-span-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <CloudRain className="h-4 w-4 text-sky-400" />
              <h2 className="text-sm font-semibold text-foreground">Precipitation Telemetry</h2>
            </div>
            <span className="text-[11px] text-muted-foreground">Open-Meteo Archive</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between rounded-md bg-background/50 p-2.5 border border-border/70">
              <span className="text-muted-foreground">1-Day Antecedent Rain:</span>
              <span className="font-mono font-bold text-foreground">
                {rainfallQuery.data?.rainfall_1d !== undefined
                  ? `${rainfallQuery.data.rainfall_1d.toFixed(1)} mm`
                  : "Loading…"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-md bg-background/50 p-2.5 border border-border/70">
              <span className="text-muted-foreground">3-Day Cumulative Rain:</span>
              <span className="font-mono font-bold text-foreground">
                {rainfallQuery.data?.rainfall_3d !== undefined
                  ? `${rainfallQuery.data.rainfall_3d.toFixed(1)} mm`
                  : "Loading…"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-md bg-background/50 p-2.5 border border-border/70">
              <span className="text-muted-foreground">7-Day Cumulative Rain:</span>
              <span className="font-mono font-bold text-foreground">
                {rainfallQuery.data?.rainfall_7d !== undefined
                  ? `${rainfallQuery.data.rainfall_7d.toFixed(1)} mm`
                  : "Loading…"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-md bg-background/50 p-2.5 border border-border/70">
              <span className="text-muted-foreground">24h Forecast Total:</span>
              <span className="font-mono font-bold text-sky-400">
                {next24hForecastMm !== null ? `${next24hForecastMm.toFixed(1)} mm` : "Loading…"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-md bg-background/50 p-2.5 border border-border/70">
              <span className="text-muted-foreground">72h Forecast Total:</span>
              <span className="font-mono font-bold text-sky-400">
                {next72hForecastMm !== null ? `${next72hForecastMm.toFixed(1)} mm` : "Loading…"}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground border-t border-border/50 pt-2">
            Automated coordinate-level retrieval enables dynamic antecedent soil-saturation evaluation.
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Field Observations & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Recent Geo-Tagged Field Reports */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4 lg:col-span-8">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-foreground">
                Recent Geo-Tagged Field Observations
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Total: <strong>{fieldReports.length}</strong> reports
              </span>
              <Link
                to="/report"
                className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"
              >
                View / Submit <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {fieldReports.length > 0 ? (
            <div className="space-y-2.5">
              {fieldReports.slice(0, 3).map((r) => (
                <div
                  key={r.id}
                  className="rounded-md border border-border/80 bg-background/50 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground">
                        {r.category}
                      </span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                          r.severity === "Critical"
                            ? "bg-red-600 text-white"
                            : r.severity === "High"
                              ? "bg-orange-600 text-white"
                              : r.severity === "Moderate"
                                ? "bg-amber-600 text-white"
                                : "bg-emerald-600 text-white"
                        )}
                      >
                        {r.severity}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(r.timestamp)}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {r.description}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 pt-1 border-t border-border/40">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-sky-400" />
                      {r.district} District ({r.latitude.toFixed(3)}°N, {r.longitude.toFixed(3)}°E)
                    </span>
                    <span className="text-foreground/80">{r.reporterName}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No field observations submitted yet.
            </div>
          )}
        </div>

        {/* Quick System Navigation Actions */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4 lg:col-span-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Compass className="h-4 w-4 text-sky-400" />
              <h2 className="text-sm font-semibold text-foreground">Command Navigation</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Access specialized operational modules for detailed site assessment, emergency dispatches, and field reporting.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <Link
              to="/assessment"
              className="flex items-center justify-between rounded-md bg-primary p-2.5 text-xs font-medium text-primary-foreground hover:opacity-95 transition-opacity"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span>Location Assessment & ML Risk</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            <Link
              to="/rainfall"
              className="flex items-center justify-between rounded-md border border-border bg-background p-2.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-2">
                <CloudRain className="h-4 w-4 text-sky-400" />
                <span>Rainfall Intelligence & NWP Forecast</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>

            <Link
              to="/analytics"
              className="flex items-center justify-between rounded-md border border-border bg-background p-2.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-indigo-400" />
                <span>Regional Intelligence & Analytics</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>

            <Link
              to="/alerts"
              className="flex items-center justify-between rounded-md border border-border bg-background p-2.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-red-400" />
                <span>Early Warning & Alerts Dashboard</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>

            <Link
              to="/report"
              className="flex items-center justify-between rounded-md border border-border bg-background p-2.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-400" />
                <span>Field Reporting & Geo-Tagging</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>

            <Link
              to="/historical"
              className="flex items-center justify-between rounded-md border border-border bg-background p-2.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-amber-400" />
                <span>Historical Landslide Inventory</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          </div>

          <div className="text-[11px] text-muted-foreground text-center border-t border-border/50 pt-3 mt-2">
            Sikkim Sentinel · SIH Problem Statement 26001
          </div>
        </div>
      </div>
    </div>
  );
}
