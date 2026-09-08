import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoNotice } from "@/components/common/DemoBadge";
import { RiskBadge } from "@/components/common/RiskBadge";
import { StatusPill } from "@/components/notifications/AlertCard";
import { ConnectionStatus } from "@/components/notifications/ConnectionStatus";
import { alertsApi, type NewAlertInput } from "@/services/alertsApi";
import { DEMO_THRESHOLDS } from "@/services/alertEngine";
import { DISTRICTS } from "@/data/sikkim";
import { ALERT_TYPES, type AlertType } from "@/types/alerts";
import type { RiskLevel } from "@/types";
import { formatDateTime } from "@/utils/risk";

export const Route = createFileRoute("/admin/alerts")({
  head: () => ({
    meta: [
      { title: "Alert administration — NER Landslide Early Warning" },
      {
        name: "description",
        content:
          "Create, publish, acknowledge and expire prototype Sikkim landslide alerts and review mock delivery status.",
      },
      { property: "og:title", content: "Alert administration — NER Landslide Early Warning" },
      {
        property: "og:description",
        content: "Manage prototype Sikkim landslide alerts. Demo data only.",
      },
    ],
  }),
  component: AdminAlertsPage,
});

function AdminAlertsPage() {
  const qc = useQueryClient();
  const alerts = useQuery({ queryKey: ["warning-alerts"], queryFn: alertsApi.listAlerts });
  const deliveries = useQuery({
    queryKey: ["alert-deliveries"],
    queryFn: alertsApi.listDeliveries,
  });
  const evaluations = useQuery({
    queryKey: ["rule-evaluations"],
    queryFn: alertsApi.evaluateRules,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["warning-alerts"] });
    qc.invalidateQueries({ queryKey: ["alert-deliveries"] });
    qc.invalidateQueries({ queryKey: ["alert-notifications"] });
  };

  const publish = useMutation({
    mutationFn: (id: string) => alertsApi.publishAlert(id),
    onSuccess: (r) => {
      invalidate();
      toast.success(`Published (demo) — ${r.deliveries.length} mock dispatch records`);
    },
  });
  const expire = useMutation({
    mutationFn: (id: string) => alertsApi.expireAlert(id),
    onSuccess: () => {
      invalidate();
      toast.success("Alert expired (demo)");
    },
  });
  const ack = useMutation({
    mutationFn: (id: string) => alertsApi.acknowledgeAlert(id),
    onSuccess: () => {
      invalidate();
      toast.success("Alert acknowledged (demo)");
    },
  });
  const severityEdit = useMutation({
    mutationFn: ({ id, severity }: { id: string; severity: RiskLevel }) =>
      alertsApi.updateAlert(id, { severity }),
    onSuccess: () => invalidate(),
  });
  const autoDraft = useMutation({
    mutationFn: () => alertsApi.createDraftsFromRules(),
    onSuccess: (drafts) => {
      invalidate();
      toast.success(`${drafts.length} demo draft(s) generated from rule automation`);
    },
  });

  const [district, setDistrict] = useState(DISTRICTS[0]!.name);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AlertType>("landslide-risk");
  const [severity, setSeverity] = useState<RiskLevel>("high");

  const create = useMutation({
    mutationFn: (input: NewAlertInput) => alertsApi.createAlert(input),
    onSuccess: () => {
      invalidate();
      setTitle("");
      toast.success("Draft alert created (demo)");
    },
  });

  function submit() {
    const d = DISTRICTS.find((x) => x.name === district)!;
    const now = new Date();
    create.mutate({
      type,
      severity,
      status: "draft",
      title: title || `DEMO alert for ${d.name}`,
      summary: `DEMO: manually drafted ${severity} ${type} alert for ${d.name}.`,
      instructions: "DEMO guidance: verify with field units before publishing.",
      source: "Manual entry (demo console)",
      triggerRule: "DEMO: manual creation",
      confidencePct: 50,
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 3600_000).toISOString(),
      affectedAreas: [
        {
          id: `aa-manual-${d.id}-${now.getTime()}`,
          district: d.name,
          locality: `${d.name} district centre`,
          lat: d.lat,
          lng: d.lng,
          radiusKm: 5,
          estimatedPopulation: Math.round(d.population * 0.1),
        },
      ],
      languages: ["en", "hi", "ne", "te"],
      channels: ["in-app", "push", "sms"],
    });
  }

  return (
    <>
      <PageHeader
        title="Alert Administration"
        description="Create, edit, publish, acknowledge and expire demo alerts, and review mock recipient and delivery status."
        actions={<ConnectionStatus />}
      />
      <DemoNotice>
        Every action here affects the in-memory DEMO dataset only. Publishing produces
        MOCK NOTIFICATION delivery records — no SMS, push or email is transmitted.
      </DemoNotice>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Rule automation (DEMO thresholds)</h2>
          <button
            onClick={() => autoDraft.mutate()}
            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent"
          >
            <Wand2 className="h-3.5 w-3.5" /> Generate drafts from rules
          </button>
        </div>
        <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
          {DEMO_THRESHOLDS.map((t) => (
            <li key={t.id}>
              {t.label} → {t.severity}
            </li>
          ))}
        </ul>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1">District</th>
                <th>7-day rain (mm)</th>
                <th>Soil moisture</th>
                <th>Matched rule</th>
              </tr>
            </thead>
            <tbody>
              {(evaluations.data ?? []).map((e) => (
                <tr key={e.district} className="border-t border-border">
                  <td className="py-1.5">{e.district}</td>
                  <td>{e.antecedent7dMm}</td>
                  <td>{e.soilMoisturePct}%</td>
                  <td>{e.matchedThreshold?.severity ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Create alert</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Alert title"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            {DISTRICTS.map((d) => (
              <option key={d.id}>{d.name}</option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AlertType)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            {ALERT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as RiskLevel)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            {(["low", "moderate", "high", "severe"] as RiskLevel[]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={submit}
          className="mt-3 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create draft
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">All alerts ({(alerts.data ?? []).length})</h2>
        {(alerts.data ?? []).map((a) => {
          const rows = (deliveries.data ?? []).filter((d) => d.alertId === a.id);
          return (
            <article key={a.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge level={a.severity} />
                <StatusPill status={a.status} />
                <span className="font-mono text-xs text-muted-foreground">{a.code}</span>
                <span className="text-sm">{a.title}</span>
                <span className="text-[11px] text-muted-foreground">
                  updated {formatDateTime(a.updatedAt)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Languages: {a.languages.join(", ")} · Channels: {a.channels.join(", ")} ·
                Acknowledged: {a.acknowledgedBy.join(", ") || "—"}
              </p>
              {rows.length > 0 && (
                <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                  {rows.map((d) => (
                    <li key={d.id}>
                      MOCK — {d.channel}/{d.language}: {d.recipients.toLocaleString("en-IN")}{" "}
                      recipients ({d.recipientGroup}) · {d.status}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                <select
                  value={a.severity}
                  onChange={(e) =>
                    severityEdit.mutate({
                      id: a.id,
                      severity: e.target.value as RiskLevel,
                    })
                  }
                  className="rounded-md border border-border bg-background px-2 py-1"
                >
                  {(["low", "moderate", "high", "severe"] as RiskLevel[]).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {a.status !== "published" && (
                  <button
                    onClick={() => publish.mutate(a.id)}
                    className="rounded-md border border-border px-2 py-1 hover:bg-accent"
                  >
                    Publish
                  </button>
                )}
                <button
                  onClick={() => ack.mutate(a.id)}
                  className="rounded-md border border-border px-2 py-1 hover:bg-accent"
                >
                  Acknowledge
                </button>
                {a.status !== "expired" && (
                  <button
                    onClick={() => expire.mutate(a.id)}
                    className="rounded-md border border-border px-2 py-1 hover:bg-accent"
                  >
                    Expire
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
