import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BellRing, Settings2, Shield } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoNotice } from "@/components/common/DemoBadge";
import { AlertCard } from "@/components/notifications/AlertCard";
import { ConnectionStatus } from "@/components/notifications/ConnectionStatus";
import { useAlerts, useNotifications, usePreferences } from "@/hooks/useAlertNotifications";
import { LANGUAGES, type AlertLanguage } from "@/types/alerts";

export const Route = createFileRoute("/alerts/")({
  head: () => ({
    meta: [
      { title: "Alerts — NER Landslide Early Warning" },
      {
        name: "description",
        content:
          "Prototype landslide alert queue for Sikkim districts with multilingual demo messages and acknowledgement workflow.",
      },
      { property: "og:title", content: "Alerts — NER Landslide Early Warning" },
      {
        property: "og:description",
        content: "Prototype landslide alert queue for Sikkim. Demo data only.",
      },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const alerts = useAlerts();
  const prefs = usePreferences();
  const { acknowledge } = useNotifications();
  const [lang, setLang] = useState<AlertLanguage | null>(null);
  const language = lang ?? prefs.data?.language ?? "en";

  const list = (alerts.data ?? []).filter((a) => a.status !== "draft");
  const active = list.filter((a) => a.status === "published");
  const past = list.filter((a) => a.status === "expired");

  return (
    <>
      <PageHeader
        title="Alert Queue"
        description="Rule-based demo alerts with multilingual messaging and an acknowledgement workflow for district control rooms."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ConnectionStatus />
            <select
              value={language}
              onChange={(e) => setLang(e.target.value as AlertLanguage)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              aria-label="Message language"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native}
                </option>
              ))}
            </select>
            <Link
              to="/alerts/preferences"
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent"
            >
              <Settings2 className="h-3.5 w-3.5" /> Preferences
            </Link>
            <Link
              to="/admin/alerts"
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent"
            >
              <Shield className="h-3.5 w-3.5" /> Admin
            </Link>
          </div>
        }
      />
      <DemoNotice>
        These alerts are generated from static demo data with clearly labelled DEMO
        thresholds and must never be treated as official warnings. Official warnings come
        from SSDMA / IMD / GSI.
      </DemoNotice>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <BellRing className="h-4 w-4 text-red-300" /> Published ({active.length})
        </h2>
        {active.map((a) => (
          <AlertCard
            key={a.id}
            alert={a}
            language={language}
            onAcknowledge={(id) =>
              acknowledge.mutate(id, {
                onSuccess: () => toast.success("Alert acknowledged (demo)"),
              })
            }
          />
        ))}
        {active.length === 0 && (
          <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            No published alerts in the demo dataset.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Expired ({past.length})
        </h2>
        {past.map((a) => (
          <div key={a.id} className="opacity-70">
            <AlertCard alert={a} language={language} />
          </div>
        ))}
      </section>
    </>
  );
}
