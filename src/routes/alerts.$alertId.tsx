import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { alertsApi } from "@/services/alertsApi";
import { useNotifications, usePreferences } from "@/hooks/useAlertNotifications";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoNotice } from "@/components/common/DemoBadge";
import { RiskBadge } from "@/components/common/RiskBadge";
import { StatusPill } from "@/components/notifications/AlertCard";
import { MapPanel } from "@/components/map/MapPanel";
import { LANGUAGES } from "@/types/alerts";
import { renderAlertMessage } from "@/services/i18n";
import { formatDateTime } from "@/utils/risk";

export const Route = createFileRoute("/alerts/$alertId")({
  head: () => ({
    meta: [
      { title: "Alert detail — NER Landslide Early Warning" },
      {
        name: "description",
        content:
          "Full detail of a prototype Sikkim landslide alert: affected areas, map context, multilingual messages and mock delivery status.",
      },
      { property: "og:title", content: "Alert detail — NER Landslide Early Warning" },
      {
        property: "og:description",
        content: "Prototype landslide alert detail for Sikkim. Demo data only.",
      },
    ],
  }),
  component: AlertDetailPage,
});

function AlertDetailPage() {
  const { alertId } = Route.useParams();
  const prefs = usePreferences();
  const { acknowledge } = useNotifications();
  const alert = useQuery({
    queryKey: ["warning-alert", alertId],
    queryFn: () => alertsApi.getAlert(alertId),
  });
  const deliveries = useQuery({
    queryKey: ["alert-deliveries"],
    queryFn: alertsApi.listDeliveries,
  });

  const a = alert.data;
  if (!a) {
    return (
      <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        {alert.isLoading ? "Loading alert…" : "Alert not found in the demo dataset."}
      </p>
    );
  }

  const msg = renderAlertMessage(a, prefs.data?.language ?? "en");
  const rows = (deliveries.data ?? []).filter((d) => d.alertId === a.id);

  return (
    <>
      <Link
        to="/alerts"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to alerts
      </Link>
      <PageHeader
        title={msg.title}
        description={`${a.code} · ${a.type} · confidence ${a.confidencePct}% (demo)`}
        actions={
          <div className="flex items-center gap-2">
            <RiskBadge level={a.severity} />
            <StatusPill status={a.status} />
            <button
              onClick={() =>
                acknowledge.mutate(a.id, {
                  onSuccess: () => toast.success("Alert acknowledged (demo)"),
                })
              }
              className="rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent"
            >
              Acknowledge
            </button>
          </div>
        }
      />
      <DemoNotice>
        DEMO DATA. Trigger rule: {a.triggerRule}. Source: {a.source}. No message was
        actually delivered to anyone.
      </DemoNotice>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <MapPanel
            height={380}
            showGrid={false}
            showEvents={false}
            marker={[a.affectedAreas[0]!.lat, a.affectedAreas[0]!.lng]}
            zoom={10}
          />
          <div className="rounded-lg border border-border bg-card p-4 text-sm">
            <h2 className="text-sm font-medium">Summary</h2>
            <p className="mt-1 text-xs text-muted-foreground">{a.summary}</p>
            <h2 className="mt-3 text-sm font-medium">Instructions</h2>
            <p className="mt-1 text-xs text-muted-foreground">{a.instructions}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Issued</dt>
                <dd>{formatDateTime(a.issuedAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Expires</dt>
                <dd>{formatDateTime(a.expiresAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Updated</dt>
                <dd>{formatDateTime(a.updatedAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Channels</dt>
                <dd>{a.channels.join(", ")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Languages</dt>
                <dd>{a.languages.join(", ")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Acknowledged by</dt>
                <dd>{a.acknowledgedBy.join(", ") || "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-medium">
              Mock delivery status{" "}
              <span className="text-[10px] uppercase tracking-widest text-amber-400">
                mock notification
              </span>
            </h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1">Channel</th>
                    <th>Language</th>
                    <th>Recipients</th>
                    <th>Group</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => (
                    <tr key={d.id} className="border-t border-border">
                      <td className="py-1.5">{d.channel}</td>
                      <td>{d.language}</td>
                      <td>{d.recipients.toLocaleString("en-IN")}</td>
                      <td className="text-muted-foreground">{d.recipientGroup}</td>
                      <td>{d.status}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-2 text-muted-foreground">
                        No dispatch simulated for this alert yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-medium">Affected areas</h2>
            <ul className="mt-2 space-y-2 text-xs">
              {a.affectedAreas.map((ar) => (
                <li key={ar.id} className="rounded-md border border-border p-2">
                  <p className="font-medium">{ar.locality}</p>
                  <p className="text-muted-foreground">
                    {ar.district} · {ar.lat.toFixed(3)}, {ar.lng.toFixed(3)} ·{" "}
                    {ar.radiusKm} km radius
                  </p>
                  <p className="text-muted-foreground">
                    ~{ar.estimatedPopulation.toLocaleString("en-IN")} people (demo
                    estimate)
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-medium">Multilingual messages</h2>
            <div className="mt-2 space-y-3">
              {LANGUAGES.map((l) => {
                const m = renderAlertMessage(a, l.code);
                return (
                  <div key={l.code} className="rounded-md border border-border p-2 text-xs">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {l.label} · {l.native}
                    </p>
                    <p className="mt-1 font-medium">{m.title}</p>
                    <p className="mt-1 text-muted-foreground">{m.body}</p>
                    <p className="mt-1 text-muted-foreground">SMS: {m.sms}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
