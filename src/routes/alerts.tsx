import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { api } from "@/services/api";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoNotice } from "@/components/common/DemoBadge";
import { RiskBadge } from "@/components/common/RiskBadge";
import { formatDateTime } from "@/utils/risk";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts — NER Landslide Early Warning" },
      {
        name: "description",
        content:
          "Prototype landslide alert queue for Sikkim districts with acknowledgement workflow.",
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
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["alerts"], queryFn: api.getAlerts });

  const ack = useMutation({
    mutationFn: (id: string) => api.acknowledgeAlert(id),
    onSuccess: (alerts) => {
      qc.setQueryData(["alerts"], alerts);
      toast.success("Alert acknowledged (demo)");
    },
  });

  const active = (data ?? []).filter((a) => !a.acknowledged);
  const done = (data ?? []).filter((a) => a.acknowledged);

  return (
    <>
      <PageHeader
        title="Alert Queue"
        description="Rule-based demo alerts with an acknowledgement workflow for district control rooms."
      />
      <DemoNotice>
        These alerts are generated from static demo data and must never be treated as
        official warnings. Official warnings come from SSDMA / IMD / GSI.
      </DemoNotice>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <BellRing className="h-4 w-4 text-red-300" /> Active ({active.length})
        </h2>
        {active.map((a) => (
          <article
            key={a.id}
            className="rounded-lg border border-border bg-card p-4 sm:flex sm:items-start sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge level={a.level} />
                <span className="text-sm font-medium">{a.district}</span>
                <span className="text-[11px] text-muted-foreground">
                  {formatDateTime(a.issuedAt)}
                </span>
              </div>
              <p className="mt-2 text-sm">{a.headline}</p>
              <p className="mt-1 text-xs text-muted-foreground">{a.detail}</p>
            </div>
            <button
              onClick={() => ack.mutate(a.id)}
              className="mt-3 w-full rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent sm:mt-0 sm:w-auto"
            >
              Acknowledge
            </button>
          </article>
        ))}
        {active.length === 0 && (
          <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            No active alerts in the demo dataset.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Acknowledged ({done.length})
        </h2>
        {done.map((a) => (
          <article
            key={a.id}
            className="rounded-lg border border-border bg-card/60 p-4 opacity-75"
          >
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge level={a.level} />
              <span className="text-sm">{a.district}</span>
              <span className="text-[11px] text-muted-foreground">
                {formatDateTime(a.issuedAt)}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{a.headline}</p>
          </article>
        ))}
      </section>
    </>
  );
}
