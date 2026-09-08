import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/services/api";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoNotice } from "@/components/common/DemoBadge";
import { RiskBadge } from "@/components/common/RiskBadge";
import { DISTRICTS } from "@/data/sikkim";
import { formatDateTime } from "@/utils/risk";
import type { FieldReport, RiskLevel } from "@/types";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Field Reporting — NER Landslide Early Warning" },
      {
        name: "description",
        content:
          "Submit and review ground observations of cracks, seepage and slope movement across Sikkim.",
      },
      { property: "og:title", content: "Field Reporting — NER Landslide Early Warning" },
      {
        property: "og:description",
        content: "Ground observation reporting for the Sikkim landslide prototype.",
      },
    ],
  }),
  component: ReportPage,
});

const CATEGORIES: FieldReport["category"][] = [
  "crack",
  "slope-movement",
  "water-seepage",
  "road-block",
  "other",
];

function ReportPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["reports"], queryFn: api.getFieldReports });

  const [reporter, setReporter] = useState("");
  const [district, setDistrict] = useState(DISTRICTS[0].name);
  const [category, setCategory] = useState<FieldReport["category"]>("crack");
  const [severity, setSeverity] = useState<RiskLevel>("moderate");
  const [observation, setObservation] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      api.submitFieldReport({ reporter, district, category, severity, observation }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Field report recorded (stored in demo memory only)");
      setObservation("");
      setReporter("");
    },
  });

  const canSubmit = reporter.trim().length > 1 && observation.trim().length > 4;

  return (
    <>
      <PageHeader
        title="Field Reporting"
        description="Ground-truth channel for ward volunteers, PWD units and panchayat offices."
      />
      <DemoNotice>
        Submissions are kept in browser-session memory by the mock service. Nothing is sent
        to a server or any authority.
      </DemoNotice>

      <div className="grid gap-4 lg:grid-cols-2">
        <form
          className="space-y-3 rounded-lg border border-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) submit.mutate();
          }}
        >
          <h2 className="text-sm font-medium">New observation</h2>

          <label className="block text-xs text-muted-foreground">
            Reporter name / unit
            <input
              value={reporter}
              onChange={(e) => setReporter(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="e.g. Ward Volunteer — Dikchu"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted-foreground">
              District
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {DISTRICTS.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FieldReport["category"])}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm capitalize"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace("-", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs text-muted-foreground">
            Severity
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as RiskLevel)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm capitalize"
            >
              {(["low", "moderate", "high", "severe"] as RiskLevel[]).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-muted-foreground">
            Observation
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Describe what you can see: cracks, bulging, seepage, debris…"
            />
          </label>

          <button
            type="submit"
            disabled={!canSubmit || submit.isPending}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submit.isPending ? "Submitting…" : "Submit report"}
          </button>
        </form>

        <div className="rounded-lg border border-border bg-card">
          <h2 className="border-b border-border px-4 py-3 text-sm font-medium">
            Recent reports
          </h2>
          <ul className="divide-y divide-border">
            {(data ?? []).map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <RiskBadge level={r.severity} />
                  <span className="text-sm font-medium">{r.district}</span>
                  <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">
                    {r.category.replace("-", " ")}
                  </span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {formatDateTime(r.submittedAt)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{r.observation}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/70">— {r.reporter}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
