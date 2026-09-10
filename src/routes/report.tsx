import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MapPin, WifiOff, Camera } from "lucide-react";
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
      { name: "description", content: "Submit geo-tagged ground observations of cracks, seepage, slope movement and road blocks across Sikkim." },
    ],
  }),
  component: ReportPage,
});

const CATEGORIES: FieldReport["category"][] = ["crack", "slope-movement", "water-seepage", "road-block", "other"];

function ReportPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["reports"], queryFn: api.getFieldReports });
  const [reporter, setReporter] = useState("");
  const [district, setDistrict] = useState(DISTRICTS[0]!.name);
  const [category, setCategory] = useState<FieldReport["category"]>("crack");
  const [severity, setSeverity] = useState<RiskLevel>("moderate");
  const [observation, setObservation] = useState("");
  const [lat, setLat] = useState(27.5074);
  const [lng, setLng] = useState(88.5222);
  const [photoAttached, setPhotoAttached] = useState(false);
  const [queuedOffline, setQueuedOffline] = useState(false);

  const useLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not available in this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(5)));
        setLng(Number(pos.coords.longitude.toFixed(5)));
        toast.success("Location captured");
      },
      () => toast.error("Location permission was not granted"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const submit = useMutation({
    mutationFn: () => api.submitFieldReport({ reporter, district, category, severity, observation }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Field report recorded with geo-tag demo metadata");
      setObservation("");
      setReporter("");
      setPhotoAttached(false);
    },
  });

  const canSubmit = reporter.trim().length > 1 && observation.trim().length > 4;

  return (
    <>
      <PageHeader title="Field Reporting" description="Ground-truth channel for ward volunteers, PWD units and panchayat offices." />
      <DemoNotice>
        Prototype field channel: coordinates and attachment state are captured in the UI for the demo. Reports remain in browser memory; offline queue is simulated.
      </DemoNotice>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-sm font-medium"><MapPin className="h-4 w-4 text-sky-300" /> Geo-tag</div>
          <p className="mt-1 text-xs text-muted-foreground">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
          <button type="button" onClick={useLocation} className="mt-2 text-xs text-sky-300 hover:underline">Capture current location</button>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-sm font-medium"><Camera className="h-4 w-4 text-violet-300" /> Evidence</div>
          <p className="mt-1 text-xs text-muted-foreground">{photoAttached ? "Photo attached (demo)" : "No photo attached"}</p>
          <button type="button" onClick={() => setPhotoAttached((v) => !v)} className="mt-2 text-xs text-sky-300 hover:underline">{photoAttached ? "Remove attachment" : "Attach photo / video"}</button>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-sm font-medium"><WifiOff className="h-4 w-4 text-amber-300" /> Connectivity</div>
          <p className="mt-1 text-xs text-muted-foreground">{queuedOffline ? "Queued for sync" : "Online — ready to submit"}</p>
          <button type="button" onClick={() => setQueuedOffline((v) => !v)} className="mt-2 text-xs text-sky-300 hover:underline">{queuedOffline ? "Mark synced" : "Simulate offline queue"}</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form className="space-y-3 rounded-lg border border-border bg-card p-4" onSubmit={(e) => { e.preventDefault(); if (canSubmit && !queuedOffline) submit.mutate(); }}>
          <h2 className="text-sm font-medium">New observation</h2>
          <label className="block text-xs text-muted-foreground">Reporter name / unit<input value={reporter} onChange={(e) => setReporter(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="e.g. Ward Volunteer — Dikchu" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted-foreground">District<select value={district} onChange={(e) => setDistrict(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">{DISTRICTS.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}</select></label>
            <label className="block text-xs text-muted-foreground">Category<select value={category} onChange={(e) => setCategory(e.target.value as FieldReport["category"])} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm capitalize">{CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("-", " ")}</option>)}</select></label>
          </div>
          <label className="block text-xs text-muted-foreground">Severity<select value={severity} onChange={(e) => setSeverity(e.target.value as RiskLevel)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm capitalize">{(["low", "moderate", "high", "very-high"] as RiskLevel[]).map((l) => <option key={l} value={l}>{l}</option>)}</select></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted-foreground">Latitude<input type="number" step="0.00001" value={lat} onChange={(e) => setLat(Number(e.target.value))} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" /></label>
            <label className="block text-xs text-muted-foreground">Longitude<input type="number" step="0.00001" value={lng} onChange={(e) => setLng(Number(e.target.value))} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" /></label>
          </div>
          <label className="block text-xs text-muted-foreground">Observation<textarea value={observation} onChange={(e) => setObservation(e.target.value)} rows={4} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Describe cracks, bulging, seepage, debris, blocked road…" /></label>
          <button type="submit" disabled={!canSubmit || submit.isPending || queuedOffline} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">{queuedOffline ? "Queued — restore connectivity to submit" : submit.isPending ? "Submitting…" : "Submit geo-tagged report"}</button>
        </form>

        <div className="rounded-lg border border-border bg-card">
          <h2 className="border-b border-border px-4 py-3 text-sm font-medium">Recent reports</h2>
          <ul className="divide-y divide-border">{(data ?? []).map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2"><RiskBadge level={r.severity} /><span className="text-sm font-medium">{r.district}</span><span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">{r.category.replace("-", " ")}</span><span className="ml-auto text-[11px] text-muted-foreground">{formatDateTime(r.submittedAt)}</span></div>
              <p className="mt-1.5 text-sm text-muted-foreground">{r.observation}</p><p className="mt-1 text-[11px] text-muted-foreground/70">— {r.reporter}</p>
            </li>
          ))}</ul>
        </div>
      </div>
    </>
  );
}
