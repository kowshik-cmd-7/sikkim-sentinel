import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Hospital,
  Info,
  Layers,
  MapPin,
  Mountain,
  Phone,
  Radio,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  Sparkles,
  Trash2,
  FileText,
  Wand2,
} from "lucide-react";

import {
  api,
  getRainfallFeatures,
  getRainfallForecast,
  getTerrainFeatures,
  predictAllForecastHorizons,
  type HorizonRiskAssessment,
} from "@/services/api";

import { PageHeader, LiveDataNotice } from "@/components/common/PageHeader";
import { RiskBadge } from "@/components/common/RiskBadge";
import { MapPanel } from "@/components/map/MapPanel";

import { DISTRICTS, SIKKIM_CENTER } from "@/data/sikkim";
import { cn } from "@/lib/utils";
import { generateStateGrid, isPointInGeometry } from "@/utils/geoGrid";

import { useStateRiskGrid } from "@/hooks/useStateRiskGrid";
import { StateSelectorBar } from "@/components/risk/StateSelectorBar";
import { StateRiskSummaryCards } from "@/components/risk/StateRiskSummaryCards";
import { CalculatedPointDrawer } from "@/components/risk/CalculatedPointDrawer";

import type {
  CalculatedRiskPoint,
  DashboardAlert,
  DashboardAlertSeverity,
  DashboardAlertStatus,
  LocationAssessment,
  StateBoundaryFeature,
  StateRiskSummary,
  TerrainAssessment,
} from "@/types";

import {
  DEFAULT_ALERT_RADIUS_KM,
  generateAlertsFromRiskResults,
  getRecommendedContacts,
  getStoredAlerts,
  saveStoredAlerts,
  mergeGeneratedAlerts,
  updateStoredAlertStatus,
  createDemoSimulatedAlert,
  deleteStoredAlert,
  formatExpiresIn,
  checkAndExpireAlerts,
  ALERT_EXPIRY_OPTIONS,
  type AlertExpiryOption,
  DEFAULT_ALERT_EXPIRY_HOURS,
} from "@/services/alertService";

export const Route = createFileRoute("/alerts/")({
  head: () => ({
    meta: [
      { title: "Early Warning & Alerts — NER Landslide Early Warning" },
      {
        name: "description",
        content:
          "AI-powered landslide risk notifications and early warning dispatch dashboard for vulnerable Sikkim locations.",
      },
      { property: "og:title", content: "Early Warning & Alerts — NER Landslide Early Warning" },
      {
        property: "og:description",
        content: "Automated landslide risk alert generation and multi-horizon early warnings for Sikkim.",
      },
    ],
  }),
  component: AlertsDashboardPage,
});

/* ---------------------------------------------------------
   Pre-configured Monitored Watchpoints
--------------------------------------------------------- */
export interface MonitoredWatchpoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

const DEFAULT_WATCHPOINT: MonitoredWatchpoint = {
  id: "mgn-high",
  name: "Mangan (Alpine Steep Ridge)",
  lat: 27.8174,
  lng: 88.4778,
};

const MONITORED_LOCATIONS: MonitoredWatchpoint[] = [
  DEFAULT_WATCHPOINT,
  { id: "mgn-town", name: "Mangan District Center", lat: 27.505, lng: 88.532 },
  { id: "gtk", name: "Gangtok District", lat: 27.3314, lng: 88.6138 },
  { id: "nmc", name: "Namchi District", lat: 27.1667, lng: 88.3667 },
  { id: "gyl", name: "Gyalshing District", lat: 27.2833, lng: 88.25 },
  { id: "pky", name: "Pakyong District", lat: 27.2333, lng: 88.5833 },
  { id: "srn", name: "Soreng District", lat: 27.1833, lng: 88.1833 },
];

function AlertsDashboardPage() {
  /* -------------------------------------------------------
     1. Selected Location State (Interactive)
  ------------------------------------------------------- */
  const [selectedLocation, setSelectedLocation] = useState<MonitoredWatchpoint>(DEFAULT_WATCHPOINT);
  const [lat, setLat] = useState<number>(DEFAULT_WATCHPOINT.lat);
  const [lng, setLng] = useState<number>(DEFAULT_WATCHPOINT.lng);

  /* -------------------------------------------------------
     2. Reusable State Risk Grid & Boundary Engine
  ------------------------------------------------------- */
  const stateRisk = useStateRiskGrid({
    storageKey: "alerts_selected_state",
    defaultState: "Sikkim",
    onStateChangeCoordinate: (firstLat, firstLng) => {
      setLat(Number(firstLat.toFixed(4)));
      setLng(Number(firstLng.toFixed(4)));
    },
  });

  const {
    selectedState,
    statesQuery,
    boundaryQuery,
    calculatedPoints,
    calcStatus,
    calcProgress,
    selectedCalculatedPoint,
    setSelectedCalculatedPoint,
    stateSummary,
    handleStateChange,
    handleRefresh,
    calculateStateRisk,
  } = stateRisk;

  /* -------------------------------------------------------
     4. Stored Alerts State (localStorage persistent)
  ------------------------------------------------------- */
  const [alerts, setAlerts] = useState<DashboardAlert[]>(() => getStoredAlerts());
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | DashboardAlertStatus>("ALL");
  const [selectedExpiryDuration, setSelectedExpiryDuration] = useState<number>(DEFAULT_ALERT_EXPIRY_HOURS);
  const [alertToDelete, setAlertToDelete] = useState<DashboardAlert | null>(null);

  // Keep localStorage synchronized & periodically check for expired alerts
  useEffect(() => {
    saveStoredAlerts(alerts);
  }, [alerts]);

  useEffect(() => {
    const checkExpiry = () => {
      setAlerts((prev) => {
        const { updated, hasChanges } = checkAndExpireAlerts(prev);
        return hasChanges ? updated : prev;
      });
    };

    const interval = setInterval(checkExpiry, 15000); // Check every 15s
    window.addEventListener("focus", checkExpiry);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", checkExpiry);
    };
  }, []);

  /* -------------------------------------------------------
     5. Live Telemetry Queries (Auto-refreshes when coords change)
  ------------------------------------------------------- */
  const cells = useQuery({
    queryKey: ["grid"],
    queryFn: api.getRiskGrid,
  });

  const rainfallQuery = useQuery({
    queryKey: ["weather-rainfall", lat, lng],
    queryFn: () => getRainfallFeatures(lat, lng),
    staleTime: 30 * 1000,
    retry: 1,
  });

  const forecastQuery = useQuery({
    queryKey: ["weather-forecast", lat, lng],
    queryFn: () => getRainfallForecast(lat, lng, 72),
    staleTime: 60 * 1000,
    retry: 1,
  });

  const terrainQuery = useQuery({
    queryKey: ["terrain", lat, lng],
    queryFn: () => getTerrainFeatures(lat, lng),
    staleTime: 60 * 1000,
    retry: 1,
  });

  const currentRiskQuery = useQuery({
    queryKey: [
      "current-risk",
      lat,
      lng,
      rainfallQuery.data?.rainfall_7d,
      terrainQuery.data?.slope_degrees,
    ],
    queryFn: async (): Promise<LocationAssessment | null> => {
      if (!rainfallQuery.data) return null;
      return api.assessLocation(lat, lng, rainfallQuery.data, terrainQuery.data ?? null);
    },
    enabled: Boolean(rainfallQuery.data),
    staleTime: 30 * 1000,
    retry: 1,
  });

  const futureRiskQuery = useQuery({
    queryKey: [
      "future-risk",
      lat,
      lng,
      rainfallQuery.data?.rainfall_7d,
      forecastQuery.data?.forecast?.length,
      terrainQuery.data?.slope_degrees,
    ],
    queryFn: async (): Promise<HorizonRiskAssessment[]> => {
      if (!rainfallQuery.data || !forecastQuery.data?.forecast?.length) {
        return [];
      }
      return predictAllForecastHorizons(
        rainfallQuery.data,
        forecastQuery.data.forecast,
        terrainQuery.data ?? null,
      );
    },
    enabled: Boolean(rainfallQuery.data) && Boolean(forecastQuery.data?.forecast?.length),
    staleTime: 60 * 1000,
    retry: 1,
  });

  /* -------------------------------------------------------
     6. Automatic Alert Generation Layer
  ------------------------------------------------------- */
  useEffect(() => {
    if (!currentRiskQuery.data && !futureRiskQuery.data?.length) return;

    const newAlerts = generateAlertsFromRiskResults({
      locationLabel: selectedLocation.name,
      lat,
      lng,
      currentAssessment: currentRiskQuery.data,
      forecastHorizons: futureRiskQuery.data,
      terrain: terrainQuery.data ?? currentRiskQuery.data?.terrainAssessment ?? null,
      radiusKm: DEFAULT_ALERT_RADIUS_KM,
      expiryDurationHours: selectedExpiryDuration,
    });

    if (newAlerts.length > 0) {
      setAlerts((prev) => {
        const merged = mergeGeneratedAlerts(prev, newAlerts);
        return merged;
      });
    }
  }, [
    currentRiskQuery.data,
    futureRiskQuery.data,
    terrainQuery.data,
    lat,
    lng,
    selectedLocation.name,
  ]);

  /* -------------------------------------------------------
     7. Handle Location Changes
  ------------------------------------------------------- */
  const handleLocationSelect = (loc: MonitoredWatchpoint) => {
    setSelectedLocation(loc);
    setLat(loc.lat);
    setLng(loc.lng);
  };

  const handleMapPick = (newLat: number, newLng: number) => {
    const custom = {
      id: `loc-${newLat.toFixed(3)}-${newLng.toFixed(3)}`,
      name: `Custom Point (${newLat.toFixed(3)}°N, ${newLng.toFixed(3)}°E)`,
      lat: newLat,
      lng: newLng,
    };
    setSelectedLocation(custom);
    setLat(newLat);
    setLng(newLng);
  };

  /* -------------------------------------------------------
     8. Selected Alert & Workflow Actions
  ------------------------------------------------------- */
  const filteredAlerts = useMemo(() => {
    let list = alerts;
    if (boundaryQuery.data && boundaryQuery.data.geometry) {
      list = list.filter((a) =>
        isPointInGeometry([a.longitude, a.latitude], boundaryQuery.data.geometry),
      );
    }
    if (statusFilter === "ALL") return list;
    return list.filter((a) => a.status === statusFilter);
  }, [alerts, statusFilter, boundaryQuery.data]);

  // Auto-select first active alert if nothing selected
  const activeSelectedAlert = useMemo(() => {
    if (selectedAlertId) {
      return alerts.find((a) => a.id === selectedAlertId) || null;
    }
    return filteredAlerts[0] || alerts[0] || null;
  }, [alerts, selectedAlertId, filteredAlerts]);

  // Action: Send Alert (Demo)
  const handleSendAlert = (alertId: string) => {
    const res = updateStoredAlertStatus(alertId, "SENT", alerts);
    if (res.success) {
      setAlerts(res.updatedList);
      toast.success("Demo alert notification sent successfully.", {
        description: "Notification marked as SENT across simulated channels (Dashboard, Browser, SMS, Email).",
      });
    } else {
      toast.error(res.message || "Failed to send alert.");
    }
  };

  // Action: Mark as Acknowledged
  const handleAcknowledgeAlert = (alertId: string) => {
    const res = updateStoredAlertStatus(alertId, "ACKNOWLEDGED", alerts);
    if (res.success) {
      setAlerts(res.updatedList);
      toast.success("Alert marked as Acknowledged by District Control Room.");
    } else {
      toast.error(res.message || "Failed to acknowledge alert.");
    }
  };

  // Action: Resolve Alert
  const handleResolveAlert = (alertId: string) => {
    const res = updateStoredAlertStatus(alertId, "RESOLVED", alerts);
    if (res.success) {
      setAlerts(res.updatedList);
      toast.success("Alert status marked as Resolved.");
    } else {
      toast.error(res.message || "Failed to resolve alert.");
    }
  };

  // Action: Permanently Delete Alert (Task 5)
  const handleDeleteAlert = (alertId: string) => {
    const updated = deleteStoredAlert(alertId, alerts);
    setAlerts(updated);
    if (selectedAlertId === alertId) {
      setSelectedAlertId(null);
    }
    setAlertToDelete(null);
    toast.success("Alert permanently deleted.");
  };

  // Demo Mode: Generate Simulated Alert
  const handleSimulateDemoAlert = (sev: "HIGH" | "VERY_HIGH") => {
    const sim = createDemoSimulatedAlert(
      selectedLocation.name,
      lat,
      lng,
      sev,
      selectedExpiryDuration,
    );
    setAlerts((prev) => [sim, ...prev]);
    setSelectedAlertId(sim.id);
    toast.info(`Generated simulated ${sev === "VERY_HIGH" ? "Very High" : "High"} alert (DEMO).`, {
      description: `Expiry set to ${selectedExpiryDuration}h (${new Date(sim.expiresAt).toLocaleTimeString()}).`,
    });
  };

  /* -------------------------------------------------------
     7. Summary Statistics Cards (Task 8: Active, Sent, Acknowledged, Resolved, Expired)
  ------------------------------------------------------- */
  const activeCount = alerts.filter((a) => a.status === "ACTIVE").length;
  const sentCount = alerts.filter((a) => a.status === "SENT").length;
  const acknowledgedCount = alerts.filter((a) => a.status === "ACKNOWLEDGED").length;
  const resolvedCount = alerts.filter((a) => a.status === "RESOLVED").length;
  const expiredCount = alerts.filter((a) => a.status === "EXPIRED").length;

  const currentSummaryScore = currentRiskQuery.data?.finalRiskScore ?? currentRiskQuery.data?.score ?? null;
  const currentSummaryLevel = currentRiskQuery.data?.finalRiskLevel ?? currentRiskQuery.data?.level ?? "Low";

  // Contacts for the active selected alert or current coordinates
  const contacts = useMemo(() => {
    const targetLat = activeSelectedAlert?.latitude ?? lat;
    const targetLng = activeSelectedAlert?.longitude ?? lng;
    const targetDistrict = currentRiskQuery.data?.district ?? "Sikkim";
    return getRecommendedContacts(targetLat, targetLng, targetDistrict);
  }, [activeSelectedAlert, lat, lng, currentRiskQuery.data]);

  return (
    <>
      {/* -------------------------------------------------------------
          HEADER & STATUS INDICATOR
      ------------------------------------------------------------- */}
      <PageHeader
        title="Early Warning & Alerts"
        description="AI-powered landslide risk dispatch and emergency lifecycle management for NER locations"
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            Emergency Ops
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Monitoring
            </span>
            <Link
              to="/report"
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <FileText className="h-3.5 w-3.5 text-emerald-400" /> Field Reports
            </Link>
            <Link
              to="/admin/alerts"
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Shield className="h-3.5 w-3.5" /> Rule Admin
            </Link>
          </div>
        }
      />

      <LiveDataNotice>
        Alerts auto-trigger when hybrid risk ≥ <strong>HIGH (60)</strong> or <strong>VERY HIGH (80)</strong>. Emergency notifications are generated for SIH prototype demonstration and decision-support.
      </LiveDataNotice>

      {/* -------------------------------------------------------------
          MONITORING STATE SELECTOR & STATUS BAR
      ------------------------------------------------------------- */}
      <StateSelectorBar
        selectedState={selectedState}
        states={statesQuery.data ?? []}
        onStateChange={handleStateChange}
        calcStatus={calcStatus}
        calcProgress={calcProgress}
        assessedCount={calculatedPoints.length}
        isBoundaryError={boundaryQuery.isError}
        onRefresh={handleRefresh}
      />

      {/* -------------------------------------------------------------
          STATE RISK SUMMARY STATISTICS CARDS (ROW OF 6)
      ------------------------------------------------------------- */}
      <StateRiskSummaryCards summary={stateSummary} />

      {/* -------------------------------------------------------------
          MONITORED LOCATIONS & ALERT EXPIRY DURATION CONTROLS
      ------------------------------------------------------------- */}
      <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs space-y-3">
        {selectedState === "Sikkim" && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-sky-400" />
              <span>Sikkim Monitored Watchpoints:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {MONITORED_LOCATIONS.map((loc) => {
                const isSelected =
                  Math.abs(loc.lat - lat) < 0.001 && Math.abs(loc.lng - lng) < 0.001;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => handleLocationSelect(loc)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-border/70 bg-background hover:bg-accent text-foreground",
                    )}
                  >
                    {loc.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Expiry Selector & Simulation Controls (Task 7) */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-sky-400" />
              Alert Expiry Duration:
            </span>
            <div className="flex items-center gap-1">
              {ALERT_EXPIRY_OPTIONS.map((hours) => (
                <button
                  key={hours}
                  type="button"
                  onClick={() => setSelectedExpiryDuration(hours)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    selectedExpiryDuration === hours
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "border border-border bg-background/60 text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {hours} hours
                </button>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              Will expire at: {new Date(Date.now() + selectedExpiryDuration * 3600 * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSimulateDemoAlert("VERY_HIGH")}
              className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/20 transition-colors shadow-xs"
            >
              <Sparkles className="h-3 w-3 text-red-400" />
              Simulate Very High (DEMO)
            </button>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          SUMMARY METRICS CARDS (ROW OF 5 ALERTS METRICS: Task 8)
      ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* 1. Active */}
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Active Alerts
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={cn("text-2xl font-bold font-mono", activeCount > 0 ? "text-red-400" : "text-foreground")}>
              {activeCount}
            </span>
            <span className="text-[10px] text-muted-foreground">in {selectedState}</span>
          </div>
        </div>

        {/* 2. Sent */}
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Sent
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-sky-400">
              {sentCount}
            </span>
            <span className="text-[10px] text-muted-foreground">dispatched</span>
          </div>
        </div>

        {/* 3. Acknowledged */}
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Acknowledged
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-yellow-400">
              {acknowledgedCount}
            </span>
            <span className="text-[10px] text-muted-foreground">by control room</span>
          </div>
        </div>

        {/* 4. Resolved */}
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Resolved
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {resolvedCount}
            </span>
            <span className="text-[10px] text-muted-foreground">closed incidents</span>
          </div>
        </div>

        {/* 5. Expired */}
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Expired
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-neutral-400">
              {expiredCount}
            </span>
            <span className="text-[10px] text-muted-foreground">time exceeded</span>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          MAIN SPLIT LAYOUT (MAP & ALERTS LIST vs DETAIL PANEL)
      ------------------------------------------------------------- */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* =========================================================
            LEFT COLUMN (7 COLS): MAP + ACTIVE ALERTS + HISTORY
        ========================================================= */}
        <div className="space-y-5 lg:col-span-7">
          {/* Interactive Map */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold uppercase tracking-wider text-foreground">
                Monitoring Map & Affected Zone Overlay
              </span>
              <span>Radius: {DEFAULT_ALERT_RADIUS_KM} km</span>
            </div>

            <MapPanel
              cells={cells.data ?? []}
              showEvents={false}
              height={400}
              marker={[lat, lng]}
              onPick={handleMapPick}
              stateBoundary={boundaryQuery.data}
              selectedStateName={selectedState}
              calculatedRiskPoints={calculatedPoints}
              onSelectCalculatedPoint={(p) => {
                setSelectedCalculatedPoint(p);
                setLat(p.latitude);
                setLng(p.longitude);
              }}
              alertCircle={
                activeSelectedAlert
                  ? {
                      center: [activeSelectedAlert.latitude, activeSelectedAlert.longitude],
                      radiusKm: activeSelectedAlert.radiusKm || DEFAULT_ALERT_RADIUS_KM,
                      severity: activeSelectedAlert.severity,
                      label: `Potentially Affected Zone (${activeSelectedAlert.radiusKm || DEFAULT_ALERT_RADIUS_KM} km) — ${activeSelectedAlert.severity} RISK`,
                    }
                  : null
              }
            />

            {/* Selected Calculated Point Inspection Drawer */}
            <CalculatedPointDrawer
              point={selectedCalculatedPoint}
              selectedState={selectedState}
              onClose={() => setSelectedCalculatedPoint(null)}
              className="mt-2"
            />
          </div>

          {/* Active Alerts List */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-400" />
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  Landslide Risk Alerts ({filteredAlerts.length})
                </h3>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 text-[11px]">
                {(["ALL", "ACTIVE", "SENT", "ACKNOWLEDGED", "RESOLVED", "EXPIRED"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      "rounded px-2 py-0.5 font-medium transition-colors",
                      statusFilter === st
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Alert Cards */}
            {filteredAlerts.length === 0 ? (
              /* EMPTY STATE */
              <div className="rounded-lg border border-border/50 bg-background/50 p-6 text-center space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">
                  No alerts found
                </h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                  No alerts currently match the "{statusFilter}" status filter in {selectedState}.
                </p>
                {currentSummaryScore !== null && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-accent/40 px-3 py-1.5 text-xs text-muted-foreground font-medium">
                    <span>Current Monitored Location Score:</span>
                    <span className="font-mono font-bold text-foreground">
                      {currentSummaryScore.toFixed(1)} / 100
                    </span>
                    <span>({currentSummaryLevel})</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredAlerts.map((alert) => {
                  const isSelected = activeSelectedAlert?.id === alert.id;
                  const isVeryHigh = alert.severity === "VERY_HIGH";

                  return (
                    <div
                      key={alert.id}
                      onClick={() => {
                        setSelectedAlertId(alert.id);
                        setLat(alert.latitude);
                        setLng(alert.longitude);
                      }}
                      className={cn(
                        "cursor-pointer rounded-lg border p-3.5 transition-all text-xs",
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/40 shadow-xs"
                          : "border-border/70 bg-card hover:bg-accent/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                              isVeryHigh
                                ? "bg-red-500 text-white"
                                : "bg-orange-500 text-white",
                            )}
                          >
                            {alert.severity === "VERY_HIGH" ? "VERY HIGH" : "HIGH"}
                          </span>

                          <span className="font-mono text-sm font-bold text-foreground">
                            Risk {alert.riskScore}%
                          </span>

                          {alert.isDemo && (
                            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold text-sky-300">
                              DEMO
                            </span>
                          )}
                        </div>

                        {/* Status Pill */}
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                            alert.status === "ACTIVE"
                              ? "bg-red-500/15 text-red-300 ring-1 ring-red-500/30"
                              : alert.status === "SENT"
                                ? "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30"
                                : alert.status === "ACKNOWLEDGED"
                                  ? "bg-yellow-500/15 text-yellow-300 ring-1 ring-yellow-500/30"
                                  : alert.status === "RESOLVED"
                                    ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
                                    : "bg-neutral-500/15 text-neutral-300 ring-1 ring-neutral-500/30",
                          )}
                        >
                          {alert.status.toLowerCase()}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {alert.locationLabel}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-sky-400">
                          <Clock className="h-3 w-3" />
                          {alert.horizon === "CURRENT" ? "Current Risk" : `Next ${alert.horizon.replace("H", "")} Hours`}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-3 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                        <span>
                          Terrain: <strong>{alert.slopeClassification || "Steep"}</strong>
                          {alert.slope !== undefined ? ` (${alert.slope}°)` : ""}
                        </span>
                        <span>
                          Rainfall: <strong>{alert.rainfall} mm</strong>
                        </span>
                        <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px]">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {alert.status === "EXPIRED" ? (
                            <span className="text-neutral-400 font-semibold">Expired</span>
                          ) : alert.status === "RESOLVED" ? (
                            <span className="text-emerald-400 font-semibold">Resolved</span>
                          ) : (
                            <span className="text-amber-400 font-semibold">
                              {formatExpiresIn(alert.expiresAt)}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAlertToDelete(alert);
                          }}
                          className="rounded p-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete alert permanently"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Alert History Section */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Alert Incident Log & History
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-[10px] uppercase font-semibold text-muted-foreground">
                  <tr>
                    <th className="p-2.5">Alert ID</th>
                    <th className="p-2.5">Location</th>
                    <th className="p-2.5">Severity</th>
                    <th className="p-2.5">Horizon</th>
                    <th className="p-2.5">Risk Score</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Expiration</th>
                    <th className="p-2.5 text-right">Workflow Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {alerts.map((a) => (
                    <tr key={a.id} className="hover:bg-accent/30 transition-colors">
                      <td className="p-2.5 font-mono text-[11px] font-medium text-foreground truncate max-w-[120px]">
                        {a.id}
                      </td>
                      <td className="p-2.5 truncate max-w-[140px]">{a.locationLabel}</td>
                      <td className="p-2.5">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[9px] font-bold",
                            a.severity === "VERY_HIGH"
                              ? "bg-red-500/20 text-red-300"
                              : "bg-orange-500/20 text-orange-300",
                          )}
                        >
                          {a.severity}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-[11px]">{a.horizon}</td>
                      <td className="p-2.5 font-mono font-bold">{a.riskScore}%</td>
                      <td className="p-2.5">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                            a.status === "ACTIVE"
                              ? "bg-red-500/15 text-red-300"
                              : a.status === "SENT"
                                ? "bg-sky-500/15 text-sky-300"
                                : a.status === "ACKNOWLEDGED"
                                  ? "bg-yellow-500/15 text-yellow-300"
                                  : a.status === "RESOLVED"
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-neutral-500/15 text-neutral-300",
                          )}
                        >
                          {a.status.toLowerCase()}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-[11px]">
                        {a.status === "EXPIRED" ? (
                          <span className="text-neutral-400 font-semibold">Expired</span>
                        ) : a.status === "RESOLVED" ? (
                          <span className="text-emerald-400 font-semibold">Resolved</span>
                        ) : (
                          <span className="text-amber-400 font-semibold">
                            {formatExpiresIn(a.expiresAt)}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-1">
                          ({a.expiryDuration || "24h"})
                        </span>
                      </td>
                      <td className="p-2.5 text-right space-x-1">
                        {a.status === "ACTIVE" && (
                          <button
                            type="button"
                            onClick={() => handleSendAlert(a.id)}
                            className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/30"
                          >
                            Send
                          </button>
                        )}
                        {(a.status === "ACTIVE" || a.status === "SENT") && (
                          <button
                            type="button"
                            onClick={() => handleAcknowledgeAlert(a.id)}
                            className="rounded bg-yellow-500/20 px-2 py-0.5 text-[10px] font-semibold text-yellow-300 hover:bg-yellow-500/30"
                          >
                            Ack
                          </button>
                        )}
                        {a.status === "ACKNOWLEDGED" && (
                          <button
                            type="button"
                            onClick={() => handleResolveAlert(a.id)}
                            className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/30"
                          >
                            Resolve
                          </button>
                        )}
                        {a.status === "RESOLVED" && (
                          <span className="text-[10px] text-emerald-400 font-medium">✓ Closed</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setAlertToDelete(a)}
                          className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-400 hover:bg-red-500/20"
                          title="Delete alert permanently"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* =========================================================
            RIGHT COLUMN (5 COLS): ALERT DETAIL PANEL
        ========================================================= */}
        <div className="space-y-4 lg:col-span-5">
          {activeSelectedAlert ? (
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-5">
              {/* Detail Header */}
              <div className="border-b border-border/60 pb-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[11px] font-bold uppercase",
                        activeSelectedAlert.severity === "VERY_HIGH"
                          ? "bg-red-500 text-white"
                          : "bg-orange-500 text-white",
                      )}
                    >
                      {activeSelectedAlert.severity === "VERY_HIGH" ? "VERY HIGH ALERT" : "HIGH ALERT"}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {activeSelectedAlert.id}
                    </span>
                  </div>

                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
                    Status: {activeSelectedAlert.status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-foreground">
                  {activeSelectedAlert.locationLabel}
                </h3>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {activeSelectedAlert.message}
                </p>
              </div>

              {/* Risk Assessment Breakdown */}
              <div className="rounded-lg border border-border/60 bg-background/50 p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-border/40 pb-1.5 font-semibold text-foreground">
                  <span>Hybrid Risk Assessment</span>
                  <span className="font-mono text-sm text-red-400 font-bold">
                    {activeSelectedAlert.finalRiskScore}%
                  </span>
                </div>

                <div className="space-y-1.5 text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Rainfall ML Risk:</span>
                    <span className="font-mono font-medium text-foreground">
                      {activeSelectedAlert.rainfallRiskScore}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Terrain Susceptibility:</span>
                    <span className="font-medium text-foreground">
                      {activeSelectedAlert.terrainSusceptibility} ({activeSelectedAlert.terrainScore} pts)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Terrain Contribution:</span>
                    <span className="font-mono text-sky-400 font-medium">
                      +{activeSelectedAlert.terrainContribution} pts
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border/30 font-semibold text-foreground">
                    <span>Final Hybrid Risk:</span>
                    <span className="font-mono text-red-400 font-bold">
                      {activeSelectedAlert.finalRiskScore}% ({activeSelectedAlert.finalRiskLevel})
                    </span>
                  </div>
                </div>
              </div>

              {/* Multi-Horizon Forecast Trigger */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Projected Horizons (Trigger: {activeSelectedAlert.horizon})
                </span>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {(["6H", "24H", "48H", "72H"] as const).map((hz) => {
                    const isTrigger = activeSelectedAlert.horizon === hz;
                    return (
                      <div
                        key={hz}
                        className={cn(
                          "rounded-md border p-2",
                          isTrigger
                            ? "border-red-500/60 bg-red-500/10 ring-1 ring-red-500/40"
                            : "border-border bg-background/50",
                        )}
                      >
                        <span className="text-[10px] text-muted-foreground font-semibold block">
                          +{hz.replace("H", "")}h
                        </span>
                        <span className="font-mono text-xs font-bold text-foreground block mt-0.5">
                          {isTrigger ? `${activeSelectedAlert.riskScore}%` : "—"}
                        </span>
                        {isTrigger && (
                          <span className="text-[9px] font-bold text-red-400 block uppercase">
                            Trigger
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Terrain Topography & Location */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-border/60 bg-background/40 p-2.5">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase block">
                    Terrain Slope
                  </span>
                  <span className="font-mono text-sm font-bold text-foreground">
                    {activeSelectedAlert.slope !== undefined ? `${activeSelectedAlert.slope}°` : "N/A"}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    {activeSelectedAlert.slopeClassification || "Steep"}
                  </span>
                </div>

                <div className="rounded-md border border-border/60 bg-background/40 p-2.5">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase block">
                    Elevation (Copernicus DEM)
                  </span>
                  <span className="font-mono text-sm font-bold text-foreground">
                    {activeSelectedAlert.elevation !== undefined ? `${activeSelectedAlert.elevation} m` : "N/A"}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    GLO-90 topography
                  </span>
                </div>
              </div>

              {/* Potentially Affected Zone */}
              <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 text-xs space-y-1">
                <div className="flex items-center justify-between text-sky-300 font-semibold">
                  <span>Potentially Affected Zone</span>
                  <span className="font-mono">{activeSelectedAlert.radiusKm} km radius</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Model-defined monitoring radius around ({activeSelectedAlert.latitude.toFixed(4)}°N, {activeSelectedAlert.longitude.toFixed(4)}°E).
                  This constitutes an AI monitoring perimeter, not an official evacuation boundary.
                </p>
              </div>

              {/* Recommended Action */}
              <div className="rounded-lg border border-border/60 bg-background/60 p-3.5 space-y-1.5 text-xs">
                <span className="font-semibold text-foreground uppercase tracking-wider text-[11px] block">
                  Recommended System Action
                </span>
                <p className="text-foreground leading-relaxed">
                  {activeSelectedAlert.severity === "VERY_HIGH"
                    ? "Immediate field verification and precautionary response recommended."
                    : "Increase monitoring and inspect vulnerable slopes and road corridors."}
                </p>
                <p className="text-[10px] text-muted-foreground italic">
                  * System recommendations based on AI hazard modeling; not official government orders.
                </p>
              </div>

              {/* Demo Send Alert Action */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Send className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">
                      Demo Notification Dispatch
                    </span>
                  </div>

                  <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                    SIMULATED FOR SIH
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Simulate emergency notification transmission across prototype communication channels.
                </p>

                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
                  <div className="rounded bg-background/60 p-1.5 text-center">Dashboard (Active)</div>
                  <div className="rounded bg-background/60 p-1.5 text-center">Browser Push (Demo)</div>
                  <div className="rounded bg-background/60 p-1.5 text-center">SMS — Demo (Simulated)</div>
                  <div className="rounded bg-background/60 p-1.5 text-center">Email — Demo (Simulated)</div>
                </div>

                {activeSelectedAlert.status === "EXPIRED" ? (
                  <div className="rounded-lg border border-neutral-600/40 bg-neutral-900/40 p-3 text-xs text-neutral-300 flex items-start gap-2.5">
                    <Clock className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block text-neutral-200">Alert Expired</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        This alert reached its expiration time at {new Date(activeSelectedAlert.expiresAt).toLocaleString()}. Active dispatch and acknowledgement are closed, but it remains in the incident log for auditing.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-1">
                    {activeSelectedAlert.status === "ACTIVE" ? (
                      <button
                        type="button"
                        onClick={() => handleSendAlert(activeSelectedAlert.id)}
                        className="flex-1 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
                      >
                        Send Alert (Demo)
                      </button>
                    ) : (
                      <div className="flex-1 text-center text-xs font-semibold text-emerald-400 py-1.5 bg-emerald-500/10 rounded-md border border-emerald-500/20">
                        ✓ Notification Sent ({new Date(activeSelectedAlert.sentAt || "").toLocaleTimeString()})
                      </div>
                    )}

                    {activeSelectedAlert.status !== "ACKNOWLEDGED" && activeSelectedAlert.status !== "RESOLVED" && (
                      <button
                        type="button"
                        onClick={() => handleAcknowledgeAlert(activeSelectedAlert.id)}
                        className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs font-semibold text-yellow-300 hover:bg-yellow-500/20 transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}

                    {activeSelectedAlert.status === "ACKNOWLEDGED" && (
                      <button
                        type="button"
                        onClick={() => handleResolveAlert(activeSelectedAlert.id)}
                        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                )}

                {/* Delete button in detail panel */}
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setAlertToDelete(activeSelectedAlert)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Alert Permanently
                  </button>
                </div>
              </div>

              {/* Recommended Response Contacts */}
              <div className="rounded-lg border border-border/60 bg-card p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Building2 className="h-3.5 w-3.5 text-sky-400" />
                  <span>Recommended Response Contacts</span>
                </div>

                <div className="space-y-2">
                  {contacts.map((c, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 border-b border-border/30 pb-1.5 last:border-0 last:pb-0">
                      <div>
                        <span className="font-semibold text-foreground text-[11px] block">{c.role}</span>
                        <span className="text-[10px] text-muted-foreground truncate block">{c.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono text-[10px] text-sky-400 block">{c.contact}</span>
                        {c.isOfficialHelpline ? (
                          <span className="text-[9px] text-emerald-400 font-medium">Official Helpline</span>
                        ) : (
                          <span className="text-[9px] text-muted-foreground italic">Configured Contact</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SACHET / Government Integration Callout */}
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground space-y-1">
                <div className="flex items-center gap-1 text-foreground font-semibold">
                  <ExternalLink className="h-3.5 w-3.5 text-sky-400" />
                  <span>Future Integration: CAP / SACHET Gateway</span>
                </div>
                <p className="leading-relaxed">
                  Future Integration: CAP/SACHET-compatible dissemination through authorized disaster-management agencies.
                  SACHET (<a href="https://sachet.ndma.gov.in/" target="_blank" rel="noreferrer" className="text-sky-400 underline">sachet.ndma.gov.in</a>)
                  is India's National Disaster Alert Portal for geo-targeted public alerts. Sikkim Sentinel serves as the upstream AI risk-generation and decision-support layer.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
              Select an alert from the list to review detailed telemetry, topography and dispatch actions.
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal (Task 5) */}
      {alertToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-lg space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Delete this alert permanently?</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Alert <span className="font-mono font-medium text-foreground">{alertToDelete.id}</span> ({alertToDelete.locationLabel}) will be permanently removed from stored records.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => setAlertToDelete(null)}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteAlert(alertToDelete.id)}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-700 transition-colors"
              >
                Delete Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
