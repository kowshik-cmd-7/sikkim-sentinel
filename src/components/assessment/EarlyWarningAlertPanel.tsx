import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  GraduationCap,
  Hospital,
  Info,
  MapPin,
  Mountain,
  Phone,
  Radio,
  Send,
  ShieldAlert,
} from "lucide-react";
import type { AlertEvaluation, AlertRecipient, AlertSeverity, Facility, LandslideAlert } from "@/types";
import { RiskBadge } from "@/components/common/RiskBadge";
import { cn } from "@/lib/utils";

interface EarlyWarningAlertPanelProps {
  evaluation: AlertEvaluation | null;
  isLoading?: boolean;
  radiusKm: number;
  onRadiusChange: (radiusKm: number) => void;
  onAcknowledge: (alertId: string) => void;
  history?: LandslideAlert[];
}

const RADIUS_OPTIONS = [5, 10, 15, 25];

export function EarlyWarningAlertPanel({
  evaluation,
  isLoading = false,
  radiusKm,
  onRadiusChange,
  onAcknowledge,
  history = [],
}: EarlyWarningAlertPanelProps) {
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<"all" | "authority" | "hospital" | "school">("all");
  const [showPayload, setShowPayload] = useState<boolean>(false);
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const alert = evaluation?.alert ?? null;
  const isAlertActive = Boolean(evaluation?.shouldAlert && alert);
  const severity: AlertSeverity | "NORMAL" = alert?.severity ?? "NORMAL";

  const handleCopyPayload = () => {
    if (!alert) return;
    navigator.clipboard.writeText(JSON.stringify(alert, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const filteredRecipients = (alert?.recipients || []).filter((r) => {
    if (activeCategoryFilter === "all") return true;
    return r.type === activeCategoryFilter;
  });

  const authCount = (alert?.recipients || []).filter((r) => r.type === "authority").length;
  const hospCount = (alert?.recipients || []).filter((r) => r.type === "hospital").length;
  const schoolCount = (alert?.recipients || []).filter((r) => r.type === "school").length;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm transition-all">
      {/* -------------------------------------------------------------
          HEADER & RADIUS CONTROLS
      ------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border",
              isAlertActive && severity === "CRITICAL"
                ? "border-red-500/50 bg-red-500/15 text-red-400"
                : isAlertActive && severity === "WARNING"
                  ? "border-orange-500/50 bg-orange-500/15 text-orange-400"
                  : isAlertActive && severity === "WATCH"
                    ? "border-yellow-500/50 bg-yellow-500/15 text-yellow-400"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
            )}
          >
            {isAlertActive ? (
              <ShieldAlert className="h-5 w-5 animate-pulse" />
            ) : (
              <Radio className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Early Warning & Emergency Alert System
              </h2>
              {isAlertActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-300 ring-1 ring-inset ring-red-500/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-ping" />
                  ACTIVE ALERT
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Automated multi-agency notification engine triggered by hybrid rainfall & terrain telemetry.
            </p>
          </div>
        </div>

        {/* Radius control */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Notification Radius:</span>
          <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-xs">
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRadiusChange(r)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  radiusKm === r
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* -------------------------------------------------------------
            CASE 1: NORMAL CONDITIONS (NO ALERT)
        ------------------------------------------------------------- */}
        {!isAlertActive ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-emerald-300">
                      Normal Conditions — All Clear
                    </span>
                    <RiskBadge level="low" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {evaluation?.triggerReason ||
                      "Current and projected rainfall risks remain below the alert threshold (score < 30)."}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                  Telemetric Status
                </span>
                <span className="font-mono text-xs text-emerald-400 font-medium">
                  Monitoring Active
                </span>
              </div>
            </div>

            {/* Nearby standby entities during normal operations */}
            {evaluation?.nearbyFacilities && evaluation.nearbyFacilities.length > 0 && (
              <div className="mt-4 border-t border-emerald-500/20 pt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>Standby response entities identified within {radiusKm} km:</span>
                  <span className="font-mono text-emerald-400/90">{evaluation.nearbyFacilities.length} facilities ready</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {evaluation.nearbyFacilities.slice(0, 3).map((f) => (
                    <div
                      key={f.id}
                      className="rounded-md border border-border/60 bg-background/50 p-2 text-xs"
                    >
                      <div className="flex items-center justify-between font-medium text-foreground">
                        <span className="truncate pr-1">{f.name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                          {f.distance_km} km
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {f.contact}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : alert ? (
          /* -------------------------------------------------------------
              CASE 2: ACTIVE ALERT (CRITICAL / WARNING / WATCH)
          ------------------------------------------------------------- */
          <div className="space-y-6">
            {/* Primary Severity Banner */}
            <div
              className={cn(
                "rounded-xl border p-4 sm:p-5 transition-all shadow-sm",
                severity === "CRITICAL"
                  ? "border-red-500/60 bg-red-950/20 ring-1 ring-red-500/30"
                  : severity === "WARNING"
                    ? "border-orange-500/60 bg-orange-950/20 ring-1 ring-orange-500/30"
                    : "border-yellow-500/60 bg-yellow-950/20 ring-1 ring-yellow-500/30",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider",
                        severity === "CRITICAL"
                          ? "bg-red-500 text-white shadow-sm"
                          : severity === "WARNING"
                            ? "bg-orange-500 text-white shadow-sm"
                            : "bg-yellow-500 text-neutral-900 font-bold shadow-sm",
                      )}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {severity} ALERT
                    </span>

                    {alert.forecastHorizon !== "Current" && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-300">
                        <Clock className="h-3 w-3" />
                        Horizon: {alert.forecastHorizon.toUpperCase()}
                      </span>
                    )}

                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(alert.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                    {alert.title}
                  </h3>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {alert.message}
                  </p>
                </div>

                {/* Operator Acknowledgement Button */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {alert.acknowledged ? (
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <div className="text-left">
                        <span className="block font-semibold">Acknowledged</span>
                        <span className="block text-[10px] text-emerald-300/80">
                          {alert.acknowledgedBy} · {new Date(alert.acknowledgedAt || "").toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAcknowledge(alert.id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-500 transition-colors active:scale-95"
                    >
                      <Check className="h-4 w-4" />
                      Acknowledge Alert (District Control Room)
                    </button>
                  )}
                  <span className="text-[10px] text-muted-foreground italic">
                    {alert.acknowledged
                      ? "Official record timestamped"
                      : "Action required by Emergency Officer"}
                  </span>
                </div>
              </div>

              {/* Telemetry trigger indicators */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-border/40 text-xs">
                <div className="rounded-md bg-background/50 p-2 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                    Current Risk Score
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-mono text-base font-bold text-foreground">
                      {alert.currentRisk !== null ? alert.currentRisk.toFixed(1) : "—"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">/ 100</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    Level: {alert.currentRiskLevel}
                  </span>
                </div>

                <div className="rounded-md bg-background/50 p-2 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                    Projected Peak Risk
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-mono text-base font-bold text-red-400">
                      {alert.forecastRisk !== null ? alert.forecastRisk.toFixed(1) : "—"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">/ 100</span>
                  </div>
                  <span className="text-[10px] text-sky-400 font-medium">
                    Horizon: {alert.forecastHorizon}
                  </span>
                </div>

                <div className="rounded-md bg-background/50 p-2 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                    Terrain Slope
                  </span>
                  <span className="font-mono text-base font-bold text-foreground block mt-0.5">
                    {alert.slope.toFixed(1)}°
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Susceptibility: {alert.terrainSusceptibility}
                  </span>
                </div>

                <div className="rounded-md bg-background/50 p-2 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                    7d Rainfall / Forecast
                  </span>
                  <span className="font-mono text-base font-bold text-sky-400 block mt-0.5">
                    {alert.rainfall.r7d !== null ? `${alert.rainfall.r7d.toFixed(1)} mm` : "—"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Forecast: +{alert.forecastRainfall.toFixed(1)} mm
                  </span>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------
                DEMO NOTIFICATION MODE BANNER (CRITICAL SAFETY NOTICE)
            ------------------------------------------------------------- */}
            <div className="flex items-start gap-3 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3.5 text-xs text-sky-200">
              <Info className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold text-sky-300">
                  Demo Notification Mode Active
                </span>
                <p className="text-[11px] text-sky-200/90 leading-relaxed">
                  All automated emergency dispatches have been generated, structured, and queued for this demonstration.
                  Real SMS gateway broadcasts, sirens, and ERSS CAD automated dispatches are suppressed in demo mode.
                  Official emergency contact numbers (112, 1070, 1077) are authentic government helplines.
                </p>
              </div>
            </div>

            {/* -------------------------------------------------------------
                ACTION DIRECTIVES & SOPS
            ------------------------------------------------------------- */}
            <div className="rounded-lg border border-border/70 bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="h-4 w-4 text-primary" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Immediate Standard Operating Procedures (SOPs)
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {alert.recommendedActions.map((action, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-md border border-border/40 bg-background/50 p-2.5 text-xs text-foreground"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                      {idx + 1}
                    </span>
                    <span className="leading-tight">{action}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* -------------------------------------------------------------
                TARGET NOTIFICATION RECIPIENTS (PRIORITIZED)
            ------------------------------------------------------------- */}
            <div className="rounded-lg border border-border/70 bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-sky-400" />
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      Target Notification Recipients ({alert.recipients.length})
                    </h4>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Prioritized response entities within {radiusKm} km radius of ({alert.affectedLatitude.toFixed(4)}°N, {alert.affectedLongitude.toFixed(4)}°E).
                  </p>
                </div>

                {/* Filter buttons */}
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveCategoryFilter("all")}
                    className={cn(
                      "rounded px-2 py-1 font-medium transition-colors",
                      activeCategoryFilter === "all"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    All ({alert.recipients.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCategoryFilter("authority")}
                    className={cn(
                      "rounded px-2 py-1 font-medium transition-colors",
                      activeCategoryFilter === "authority"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    Authorities ({authCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCategoryFilter("hospital")}
                    className={cn(
                      "rounded px-2 py-1 font-medium transition-colors",
                      activeCategoryFilter === "hospital"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    Health ({hospCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCategoryFilter("school")}
                    className={cn(
                      "rounded px-2 py-1 font-medium transition-colors",
                      activeCategoryFilter === "school"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    Education ({schoolCount})
                  </button>
                </div>
              </div>

              {/* Recipients list */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredRecipients.map((recipient: AlertRecipient) => {
                  return (
                    <div
                      key={recipient.id}
                      className={cn(
                        "flex flex-col justify-between rounded-lg border p-3 text-xs transition-all shadow-xs",
                        recipient.type === "authority"
                          ? "border-red-500/30 bg-red-500/5"
                          : recipient.type === "hospital"
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-sky-500/30 bg-sky-500/5",
                      )}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-center gap-1.5">
                            {recipient.type === "authority" ? (
                              <Building2 className="h-4 w-4 text-red-400 shrink-0" />
                            ) : recipient.type === "hospital" ? (
                              <Hospital className="h-4 w-4 text-emerald-400 shrink-0" />
                            ) : (
                              <GraduationCap className="h-4 w-4 text-sky-400 shrink-0" />
                            )}
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                                recipient.priority === 1
                                  ? "bg-red-500/20 text-red-300"
                                  : recipient.priority === 2
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : "bg-sky-500/20 text-sky-300",
                              )}
                            >
                              Priority {recipient.priority} · {recipient.category}
                            </span>
                          </div>

                          <span className="font-mono text-[10px] text-muted-foreground">
                            {recipient.distanceKm.toFixed(1)} km
                          </span>
                        </div>

                        <h5 className="font-semibold text-foreground text-xs mt-2 line-clamp-1">
                          {recipient.name}
                        </h5>

                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">{recipient.contact}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[10px]">
                        <span className="text-muted-foreground">Channel: SMS / Radio CAD</span>
                        <span className="inline-flex items-center gap-1 rounded bg-sky-500/20 px-1.5 py-0.5 font-medium text-sky-300">
                          <Radio className="h-2.5 w-2.5 animate-pulse" />
                          Queued for Demo
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* -------------------------------------------------------------
                COLLAPSIBLE MACHINE DISPATCH PAYLOAD (FOR SIH EVALUATION)
            ------------------------------------------------------------- */}
            <div className="rounded-lg border border-border/70 bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPayload(!showPayload)}
                className="flex w-full items-center justify-between p-3.5 text-xs font-semibold text-foreground hover:bg-accent/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-sky-400" />
                  View Prepared Emergency Dispatch Payload (JSON)
                </span>
                {showPayload ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {showPayload && (
                <div className="border-t border-border/60 bg-background/80 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      Structured M2M payload ready for transmission to State & District Emergency Operation Centres:
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPayload}
                      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent"
                    >
                      {copiedPayload ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy JSON
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="overflow-x-auto rounded-md bg-neutral-950 p-3 font-mono text-[11px] text-sky-300 max-h-72 border border-border/40">
                    {JSON.stringify(alert, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* -------------------------------------------------------------
                SESSION ALERT HISTORY
            ------------------------------------------------------------- */}
            {history.length > 0 && (
              <div className="rounded-lg border border-border/70 bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex w-full items-center justify-between p-3.5 text-xs font-semibold text-foreground hover:bg-accent/50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Session Alert Log ({history.length} events logged)
                  </span>
                  {showHistory ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {showHistory && (
                  <div className="border-t border-border/60 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/40 text-[10px] uppercase font-semibold text-muted-foreground">
                        <tr>
                          <th className="p-2.5">Time</th>
                          <th className="p-2.5">District / Coords</th>
                          <th className="p-2.5">Severity</th>
                          <th className="p-2.5">Trigger Horizon</th>
                          <th className="p-2.5">Risk Score</th>
                          <th className="p-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {history.map((h, i) => (
                          <tr key={i} className="hover:bg-accent/30">
                            <td className="p-2.5 font-mono text-[11px]">
                              {new Date(h.generatedAt).toLocaleTimeString()}
                            </td>
                            <td className="p-2.5">
                              {h.affectedDistrict} ({h.affectedLatitude.toFixed(2)}, {h.affectedLongitude.toFixed(2)})
                            </td>
                            <td className="p-2.5">
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-bold",
                                  h.severity === "CRITICAL"
                                    ? "bg-red-500/20 text-red-300"
                                    : h.severity === "WARNING"
                                      ? "bg-orange-500/20 text-orange-300"
                                      : "bg-yellow-500/20 text-yellow-300",
                                )}
                              >
                                {h.severity}
                              </span>
                            </td>
                            <td className="p-2.5">{h.forecastHorizon}</td>
                            <td className="p-2.5 font-mono">
                              {h.forecastRisk !== null ? h.forecastRisk.toFixed(1) : "—"}
                            </td>
                            <td className="p-2.5">
                              {h.acknowledged ? (
                                <span className="text-emerald-400 font-medium text-[10px]">
                                  ✓ Acknowledged
                                </span>
                              ) : (
                                <span className="text-yellow-400 text-[10px]">
                                  Pending
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
