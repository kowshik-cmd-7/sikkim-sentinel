import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DISTRICTS } from "@/data/sikkim";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoNotice } from "@/components/common/DemoBadge";
import { usePreferences } from "@/hooks/useAlertNotifications";
import { alertsApi } from "@/services/alertsApi";
import {
  ALERT_TYPES,
  LANGUAGES,
  type AlertLanguage,
  type AlertPreferences,
  type AlertType,
  type DeliveryChannel,
} from "@/types/alerts";
import type { RiskLevel } from "@/types";
import { DEFAULT_PREFERENCES } from "@/data/alerts-demo";

export const Route = createFileRoute("/alerts/preferences")({
  head: () => ({
    meta: [
      { title: "Bhurakshak — Alert Preferences" },
      {
        name: "description",
        content:
          "Configure geographic regions, languages, alert hazard types, severity thresholds, and notification delivery channels.",
      },
      { property: "og:title", content: "Bhurakshak — Alert Preferences" },
      {
        property: "og:description",
        content: "Notification channel and geographic alert routing preferences.",
      },
    ],
  }),
  component: PreferencesPage,
});

const SEVERITIES: RiskLevel[] = ["low", "moderate", "high", "severe"];
const CHANNELS: DeliveryChannel[] = ["in-app", "push", "sms"];

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function PreferencesPage() {
  const qc = useQueryClient();
  const stored = usePreferences();
  const [prefs, setPrefs] = useState<AlertPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    if (stored.data) setPrefs(stored.data);
  }, [stored.data]);

  const save = useMutation({
    mutationFn: (p: AlertPreferences) => alertsApi.savePreferences(p),
    onSuccess: (p) => {
      qc.setQueryData(["alert-preferences"], p);
      toast.success("Alert preferences saved successfully");
    },
  });

  return (
    <>
      <PageHeader
        title="Alert Preferences"
        description="Configure target districts, delivery languages, and notification channels for automated risk alerts."
      />
      <DemoNotice>
        Alert preferences are securely saved to your local device profile for targeted hazard routing and dispatch simulation.
      </DemoNotice>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Districts / locations</h2>
          <div className="mt-2 grid gap-1.5">
            {DISTRICTS.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs.districts.includes(d.name)}
                  onChange={() =>
                    setPrefs((p) => ({ ...p, districts: toggle(p.districts, d.name) }))
                  }
                />
                {d.name}
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-medium">Language</h2>
            <select
              value={prefs.language}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, language: e.target.value as AlertLanguage }))
              }
              className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label} — {l.native}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-medium">Minimum severity</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {SEVERITIES.map((s) => (
                <button
                  key={s}
                  onClick={() => setPrefs((p) => ({ ...p, minSeverity: s }))}
                  className={`rounded-md border px-2.5 py-1 text-xs capitalize ${prefs.minSeverity === s ? "border-sky-500/60 bg-sky-500/10 text-sky-300" : "border-border hover:bg-accent"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-medium">Channels (mock)</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {CHANNELS.map((c) => (
                <button
                  key={c}
                  onClick={() => setPrefs((p) => ({ ...p, channels: toggle(p.channels, c) }))}
                  className={`rounded-md border px-2.5 py-1 text-xs ${prefs.channels.includes(c) ? "border-sky-500/60 bg-sky-500/10 text-sky-300" : "border-border hover:bg-accent"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 md:col-span-2">
          <h2 className="text-sm font-medium">Alert types</h2>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {ALERT_TYPES.map((t) => (
              <label key={t.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs.types.includes(t.value)}
                  onChange={() =>
                    setPrefs((p) => ({
                      ...p,
                      types: toggle<AlertType>(p.types, t.value),
                    }))
                  }
                />
                {t.label}
              </label>
            ))}
          </div>
        </section>
      </div>

      <button
        onClick={() => save.mutate(prefs)}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Save preferences
      </button>
    </>
  );
}
