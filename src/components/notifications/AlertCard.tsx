import { Link } from "@tanstack/react-router";
import { MapPin, Clock } from "lucide-react";
import type { AlertLanguage, WarningAlert } from "@/types/alerts";
import { RiskBadge } from "@/components/common/RiskBadge";
import { renderAlertMessage } from "@/services/i18n";
import { formatDateTime } from "@/utils/risk";

const STATUS_STYLE: Record<WarningAlert["status"], string> = {
  draft: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  published: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  expired: "border-muted bg-muted/30 text-muted-foreground",
};

export function StatusPill({ status }: { status: WarningAlert["status"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[status]}`}
    >
      {status}
    </span>
  );
}

export function AlertCard({
  alert,
  language,
  onAcknowledge,
}: {
  alert: WarningAlert;
  language: AlertLanguage;
  onAcknowledge?: (id: string) => void;
}) {
  const msg = renderAlertMessage(alert, language);
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <RiskBadge level={alert.severity} />
        <StatusPill status={alert.status} />
        <span className="text-xs font-mono text-muted-foreground">{alert.code}</span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" /> {formatDateTime(alert.issuedAt)} → {formatDateTime(alert.expiresAt)}
        </span>
      </div>
      <h3 className="mt-2 text-sm font-medium">{msg.title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{msg.body}</p>
      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <MapPin className="h-3 w-3" />
        {alert.affectedAreas
          .map((a) => `${a.locality} (${a.district}, ${a.radiusKm} km)`)
          .join(" · ")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <Link
          to="/alerts/$alertId"
          params={{ alertId: alert.id }}
          className="rounded-md border border-border px-2 py-1 hover:bg-accent"
        >
          Alert detail
        </Link>
        {onAcknowledge && alert.acknowledgedBy.length === 0 && (
          <button
            onClick={() => onAcknowledge(alert.id)}
            className="rounded-md border border-border px-2 py-1 hover:bg-accent"
          >
            Acknowledge
          </button>
        )}
        {alert.acknowledgedBy.length > 0 && (
          <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-300">
            Acknowledged by {alert.acknowledgedBy.join(", ")}
          </span>
        )}
      </div>
    </article>
  );
}
