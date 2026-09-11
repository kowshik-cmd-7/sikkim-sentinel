import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MapPin,
  Crosshair,
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  ArrowRight,
  ShieldAlert,
  Filter,
  X,
  RefreshCw,
  Image as ImageIcon,
  Check,
  Search,
  ExternalLink,
} from "lucide-react";

import { PageHeader, LiveDataNotice } from "@/components/common/PageHeader";
import { MapPanel } from "@/components/map/MapPanel";
import { DISTRICTS, SIKKIM_CENTER } from "@/data/sikkim";
import { extractGpsFromImage, type GpsCoordinates } from "@/utils/exif";
import {
  getStoredFieldReports,
  saveFieldReport,
  updateFieldReportStatus,
  deleteFieldReport,
  compressImage,
} from "@/services/fieldReportService";
import type {
  FieldReport,
  FieldReportCategory,
  FieldReportSeverity,
  FieldReportStatus,
} from "@/types";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Bhurakshak — Field Reporting & Geo-Tagging" },
      {
        name: "description",
        content:
          "Bhurakshak field reporting: submit and track geo-tagged ground observations of tension cracks, slope movement, rockfall, and road blockage across North Eastern Region states.",
      },
    ],
  }),
  component: FieldReportingPage,
});

const CATEGORIES: FieldReportCategory[] = [
  "Landslide",
  "Road Blockage",
  "Rockfall",
  "Slope Crack",
  "Flash Flood",
  "Waterlogging",
  "Infrastructure Damage",
  "Other",
];

const SEVERITIES: { value: FieldReportSeverity; label: string; color: string; border: string; bg: string }[] = [
  { value: "Low", label: "Low (Monitoring)", color: "text-emerald-400", border: "border-emerald-500/40", bg: "bg-emerald-500/10" },
  { value: "Moderate", label: "Moderate (Advisory)", color: "text-amber-400", border: "border-amber-500/40", bg: "bg-amber-500/10" },
  { value: "High", label: "High (Action Req.)", color: "text-orange-400", border: "border-orange-500/40", bg: "bg-orange-500/10" },
  { value: "Critical", label: "Critical (Imminent Risk)", color: "text-red-400", border: "border-red-500/40", bg: "bg-red-500/10" },
];

function getSeverityBadge(severity: FieldReportSeverity) {
  switch (severity) {
    case "Critical":
      return "bg-red-950/80 text-red-300 border-red-700/60";
    case "High":
      return "bg-orange-950/80 text-orange-300 border-orange-700/60";
    case "Moderate":
      return "bg-amber-950/80 text-amber-300 border-amber-700/60";
    case "Low":
    default:
      return "bg-emerald-950/80 text-emerald-300 border-emerald-700/60";
  }
}

function getStatusBadge(status: FieldReportStatus) {
  switch (status) {
    case "RESOLVED":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "REVIEWED":
      return "bg-sky-500/20 text-sky-300 border-sky-500/30";
    case "SUBMITTED":
    default:
      return "bg-amber-500/20 text-amber-300 border-amber-500/30";
  }
}

function FieldReportingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: reports = [], refetch } = useQuery({
    queryKey: ["field-reports"],
    queryFn: () => getStoredFieldReports(),
    staleTime: 5000,
  });

  // Form State
  const [reporterName, setReporterName] = useState("");
  const [district, setDistrict] = useState("Mangan");
  const [category, setCategory] = useState<FieldReportCategory>("Slope Crack");
  const [severity, setSeverity] = useState<FieldReportSeverity>("High");
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState<number>(27.5074);
  const [lng, setLng] = useState<number>(88.5222);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);
  const [photoGps, setPhotoGps] = useState<GpsCoordinates | null>(null);

  // UI States
  const [isLocating, setIsLocating] = useState(false);
  const [locationSource, setLocationSource] = useState<"map" | "gps" | "exif" | "default">("default");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"form" | "reports">("form");
  const [statusFilter, setStatusFilter] = useState<"ALL" | FieldReportStatus>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState<FieldReport | null>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

  // Map Pick Handler
  const handleMapPick = (newLat: number, newLng: number) => {
    setLat(Number(newLat.toFixed(5)));
    setLng(Number(newLng.toFixed(5)));
    setLocationSource("map");
    setGpsAccuracy(null);
    toast.info(`Coordinate updated: ${newLat.toFixed(4)}°, ${newLng.toFixed(4)}°`);
  };

  // Explicit User Geolocation Trigger ("Use My Location")
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Browser Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = Number(pos.coords.latitude.toFixed(5));
        const userLng = Number(pos.coords.longitude.toFixed(5));
        const accuracy = Math.round(pos.coords.accuracy);

        setLat(userLat);
        setLng(userLng);
        setLocationSource("gps");
        setGpsAccuracy(accuracy);
        setIsLocating(false);

        toast.success(`Current location captured (${userLat}°, ${userLng}°) · ±${accuracy}m`);
      },
      (err) => {
        setIsLocating(false);
        let message = "Location permission denied.";
        if (err.code === err.POSITION_UNAVAILABLE) message = "Location information is unavailable.";
        else if (err.code === err.TIMEOUT) message = "Location request timed out.";
        toast.error(`${message} You can select coordinates directly on the map.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  // Photo Upload Handler with Compression and EXIF GPS Extraction
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPEG, PNG, WEBP).");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("Image file is too large (maximum 20MB).");
      return;
    }

    try {
      setPhotoFileName(file.name);

      // Check for EXIF GPS metadata
      const exif = await extractGpsFromImage(file);
      if (exif) {
        setPhotoGps(exif);
        toast.info(
          `Photo contains geotag metadata: ${exif.latitude.toFixed(4)}°, ${exif.longitude.toFixed(4)}°`,
        );
      } else {
        setPhotoGps(null);
      }

      // Compress image for storage
      const compressed = await compressImage(file, 850, 850, 0.78);
      setPhotoDataUrl(compressed);
      toast.success("Photo attached and prepared for submission");
    } catch (err) {
      console.error("Photo processing error:", err);
      toast.error("Failed to process image attachment.");
    }
  };

  const handleApplyExifGps = () => {
    if (photoGps) {
      setLat(photoGps.latitude);
      setLng(photoGps.longitude);
      setLocationSource("exif");
      setGpsAccuracy(null);
      toast.success(`Location set from photo metadata: ${photoGps.latitude}°, ${photoGps.longitude}°`);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoDataUrl(null);
    setPhotoFileName(null);
    setPhotoGps(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast.info("Photo removed");
  };

  // Submission Mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!description.trim() || description.trim().length < 5) {
        throw new Error("Please provide a detailed observation description (min 5 characters).");
      }
      return saveFieldReport({
        latitude: lat,
        longitude: lng,
        category,
        severity,
        description,
        photo: photoDataUrl,
        reporterName: reporterName || "Anonymous Field Officer",
        district,
        state: "Sikkim",
      });
    },
    onSuccess: (newReport) => {
      queryClient.invalidateQueries({ queryKey: ["field-reports"] });
      refetch();
      toast.success("Field observation report submitted successfully!");

      // Reset form fields
      setDescription("");
      setReporterName("");
      setPhotoDataUrl(null);
      setPhotoFileName(null);
      setPhotoGps(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Select newly created report
      setSelectedReport(newReport);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to submit field report.");
    },
  });

  // Status Update Mutation
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FieldReportStatus }) => {
      const updated = updateFieldReportStatus(id, status);
      if (!updated) throw new Error("Report not found");
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["field-reports"] });
      refetch();
      setSelectedReport(updated);
      toast.success(`Report status updated to ${updated.status}`);
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const ok = deleteFieldReport(id);
      if (!ok) throw new Error("Failed to delete");
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["field-reports"] });
      refetch();
      setSelectedReport(null);
      toast.success("Report deleted");
    },
  });

  // Navigate to Assessment page with pre-filled coordinates
  const handleAssessLocation = (reportLat: number, reportLng: number) => {
    navigate({
      to: "/assessment",
      search: {
        lat: reportLat,
        lng: reportLng,
      },
    });
  };

  // Filtered Reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (categoryFilter !== "ALL" && r.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchText =
          `${r.category} ${r.description} ${r.reporterName} ${r.district} ${r.status}`.toLowerCase();
        if (!matchText.includes(q)) return false;
      }
      return true;
    });
  }, [reports, statusFilter, categoryFilter, searchQuery]);

  // Summary counts
  const counts = useMemo(() => {
    return {
      total: reports.length,
      submitted: reports.filter((r) => r.status === "SUBMITTED").length,
      reviewed: reports.filter((r) => r.status === "REVIEWED").length,
      resolved: reports.filter((r) => r.status === "RESOLVED").length,
    };
  }, [reports]);

  return (
    <>
      <PageHeader
        title="Field Reporting & Geo-Tagging"
        description="Ground-truth observation logging for ward volunteers, road maintenance squads, and district emergency response teams across the NER territory."
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            <CheckCircle2 className="h-3 w-3" />
            Field Ops Active
          </span>
        }
      />

      <LiveDataNotice>
        Geo-tagged observations are plotted in real time. Each report can be inspected and cross-evaluated against Copernicus 90m DEM terrain slope and trained GradientBoostingRegressor hazard predictions.
      </LiveDataNotice>

      {/* Metrics Row */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Reports</span>
            <ShieldAlert className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-1 text-2xl font-bold text-foreground">{counts.total}</div>
          <div className="text-[11px] text-muted-foreground">Logged observations</div>
        </div>

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 shadow-sm">
          <div className="flex items-center justify-between text-xs text-amber-400">
            <span>Submitted</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-300">{counts.submitted}</div>
          <div className="text-[11px] text-amber-400/80">Awaiting engineering review</div>
        </div>

        <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 shadow-sm">
          <div className="flex items-center justify-between text-xs text-sky-400">
            <span>Reviewed</span>
            <AlertTriangle className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-1 text-2xl font-bold text-sky-300">{counts.reviewed}</div>
          <div className="text-[11px] text-sky-400/80">Assessed by field unit</div>
        </div>

        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 shadow-sm">
          <div className="flex items-center justify-between text-xs text-emerald-400">
            <span>Resolved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-300">{counts.resolved}</div>
          <div className="text-[11px] text-emerald-400/80">Mitigated or cleared</div>
        </div>
      </div>

      {/* Main Grid: Form / Map & Reports List */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left Column (7 cols): Map & Form */}
        <div className="space-y-4 lg:col-span-7">
          {/* Interactive Map with Coordinate Selection & Markers */}
          <div className="relative">
            <MapPanel
              height={440}
              marker={[lat, lng]}
              markerLabel={`Report Pin (${lat.toFixed(4)}°, ${lng.toFixed(4)}°)`}
              onPick={handleMapPick}
              fieldReports={reports}
              selectedReportId={selectedReport?.id}
              onSelectFieldReport={(r) => {
                setSelectedReport(r);
                setLat(r.latitude);
                setLng(r.longitude);
                toast.info(`Selected ${r.category} report at (${r.latitude}°, ${r.longitude}°)`);
              }}
            />

            {/* Float Coordinate helper banner */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/90 px-3 py-2 text-xs backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-sky-400" />
                <span>
                  Geo-Tag: <strong className="text-foreground">{lat.toFixed(5)}°N, {lng.toFixed(5)}°E</strong>
                </span>
                {locationSource === "gps" && gpsAccuracy && (
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400">
                    Device GPS (±{gpsAccuracy}m)
                  </span>
                )}
                {locationSource === "map" && (
                  <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-400">
                    Map Pin Selected
                  </span>
                )}
                {locationSource === "exif" && (
                  <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-400">
                    Photo EXIF GPS
                  </span>
                )}
              </div>

              {/* Explicit Use My Location Button */}
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={isLocating}
                className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-400 border border-sky-500/30 hover:bg-sky-500/20 disabled:opacity-50 transition-colors"
              >
                {isLocating ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Acquiring GPS…</span>
                  </>
                ) : (
                  <>
                    <Crosshair className="h-3.5 w-3.5" />
                    <span>Use My Location</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* New Field Report Form Card */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Camera className="h-4 w-4 text-sky-400" />
                Record New Ground Observation
              </h2>
              <span className="text-[11px] text-muted-foreground">
                Click map to reposition pin
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitMutation.mutate();
              }}
              className="space-y-3"
            >
              {/* Category & Severity Row */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Observation Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as FieldReportCategory)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Severity Level *
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as FieldReportSeverity)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reporter & District Row */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Reporter Name / Department Unit
                  </label>
                  <input
                    type="text"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    placeholder="e.g. Inspector Tashi — PWD Gangtok"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    District
                  </label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    {DISTRICTS.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Manual Lat/Lng Fine-tuning */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Latitude (°N)
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    value={lat}
                    onChange={(e) => {
                      setLat(Number(e.target.value));
                      setLocationSource("map");
                    }}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Longitude (°E)
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    value={lng}
                    onChange={(e) => {
                      setLng(Number(e.target.value));
                      setLocationSource("map");
                    }}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Observation Description *
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    {description.length} chars
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detail slope fissure widths, active soil displacement, rockfall trajectories, blocked culverts or retaining wall distress…"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                />
              </div>

              {/* Evidence / Photo Attachment Area */}
              <div className="rounded-md border border-dashed border-border p-3 bg-muted/20">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                {!photoDataUrl ? (
                  <div className="text-center py-2">
                    <Camera className="mx-auto h-7 w-7 text-muted-foreground" />
                    <div className="mt-1 text-xs text-foreground font-medium">
                      Attach Field Photograph
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Supports EXIF GPS geo-tag auto-detection from smartphone cameras
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1 text-xs text-foreground hover:bg-muted"
                    >
                      <Upload className="h-3 w-3" />
                      Browse Photo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                        <ImageIcon className="h-4 w-4 text-violet-400" />
                        <span className="truncate max-w-[220px]">{photoFileName || "Attached Photo"}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                      >
                        <X className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>

                    <div className="relative rounded overflow-hidden border border-border max-h-40 bg-black/40 flex justify-center">
                      <img
                        src={photoDataUrl}
                        alt="Preview"
                        className="max-h-40 w-auto object-contain cursor-pointer hover:opacity-95"
                        onClick={() => setExpandedPhoto(photoDataUrl)}
                      />
                    </div>

                    {/* Photo EXIF GPS detection badge */}
                    {photoGps && (
                      <div className="flex items-center justify-between rounded bg-purple-500/10 border border-purple-500/30 p-2 text-xs text-purple-300">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-purple-400" />
                          <span>EXIF Geotag: {photoGps.latitude}°, {photoGps.longitude}°</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleApplyExifGps}
                          className="rounded bg-purple-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-purple-500"
                        >
                          Use Photo Location
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitMutation.isPending || description.trim().length < 5}
                className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-opacity"
              >
                {submitMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Recording Observation…</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Submit Geo-Tagged Field Report</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (5 cols): Submitted Observations List & Inspector */}
        <div className="space-y-4 lg:col-span-5">
          {/* Selected Report Inspector / Detail Drawer Card */}
          {selectedReport ? (
            <div className="rounded-lg border border-sky-500/40 bg-card p-4 shadow-md">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold border ${getSeverityBadge(selectedReport.severity)}`}>
                    {selectedReport.severity}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${getStatusBadge(selectedReport.status)}`}>
                    {selectedReport.status}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                  title="Close Inspector"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 space-y-2.5 text-xs">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {selectedReport.category}
                  </h3>
                  <p className="text-muted-foreground mt-0.5">
                    {selectedReport.district ? `${selectedReport.district} · ` : ""}
                    {new Date(selectedReport.timestamp).toLocaleString()}
                  </p>
                </div>

                <div className="rounded bg-muted/40 p-2.5 text-foreground leading-relaxed">
                  {selectedReport.description}
                </div>

                {/* Photo in report */}
                {selectedReport.photo && (
                  <div className="mt-2">
                    <span className="text-[11px] font-medium text-muted-foreground mb-1 block">
                      Ground Evidence Photo:
                    </span>
                    <div className="overflow-hidden rounded border border-border bg-black/40">
                      <img
                        src={selectedReport.photo}
                        alt="Evidence"
                        className="max-h-48 w-full object-cover cursor-pointer hover:opacity-90"
                        onClick={() => setExpandedPhoto(selectedReport.photo || null)}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground border-t border-border pt-2">
                  <div>
                    <span className="block text-muted-foreground/70">Coordinates:</span>
                    <span className="font-mono text-foreground font-medium">
                      {selectedReport.latitude.toFixed(4)}°, {selectedReport.longitude.toFixed(4)}°
                    </span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground/70">Reporter:</span>
                    <span className="text-foreground font-medium truncate block">
                      {selectedReport.reporterName || "Anonymous"}
                    </span>
                  </div>
                </div>

                {/* Status Progression Workflow */}
                <div className="border-t border-border pt-2.5">
                  <span className="text-[11px] font-medium text-muted-foreground block mb-1.5">
                    Update Operational Status:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["SUBMITTED", "REVIEWED", "RESOLVED"] as FieldReportStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() =>
                          statusMutation.mutate({ id: selectedReport.id, status: st })
                        }
                        disabled={selectedReport.status === st || statusMutation.isPending}
                        className={`rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
                          selectedReport.status === st
                            ? "bg-primary/20 border-primary text-primary-foreground font-semibold"
                            : "border-border bg-muted/20 hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prominent Action: Assess Landslide Hazard */}
                <div className="border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      handleAssessLocation(selectedReport.latitude, selectedReport.longitude)
                    }
                    className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-sky-600 to-blue-600 px-3 py-2 text-xs font-semibold text-white shadow hover:from-sky-500 hover:to-blue-500 transition-all"
                  >
                    <span>Assess Landslide Risk at this Coordinate</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <p className="mt-1 text-[10px] text-muted-foreground text-center">
                    Deep-links to full ML pipeline: Copernicus 90m DEM + Open-Meteo rainfall
                  </p>
                </div>

                {/* Delete Report */}
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this field report?")) {
                        deleteMutation.mutate(selectedReport.id);
                      }
                    }}
                    className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete Report
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Observations Directory Card */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-sky-400" />
                Submitted Observations ({filteredReports.length})
              </h2>

              {/* Status Filter Chips */}
              <div className="flex items-center gap-1 text-[10px]">
                {(["ALL", "SUBMITTED", "REVIEWED", "RESOLVED"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`rounded px-2 py-0.5 font-medium transition-colors ${
                      statusFilter === st
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Search & Category Filter bar */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2 bg-muted/20">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter description, reporter, district…"
                  className="w-full rounded border border-border bg-background pl-7 pr-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* List */}
            <div className="divide-y divide-border max-h-[560px] overflow-y-auto">
              {filteredReports.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No observations match the current filter criteria.
                </div>
              ) : (
                filteredReports.map((report) => {
                  const isSelected = selectedReport?.id === report.id;
                  return (
                    <div
                      key={report.id}
                      onClick={() => {
                        setSelectedReport(report);
                        setLat(report.latitude);
                        setLng(report.longitude);
                      }}
                      className={`cursor-pointer p-3 transition-colors hover:bg-muted/30 ${
                        isSelected ? "bg-muted/50 border-l-2 border-sky-500" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${getSeverityBadge(
                              report.severity,
                            )}`}
                          >
                            {report.severity}
                          </span>
                          <span className="text-xs font-semibold text-foreground">
                            {report.category}
                          </span>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-medium border ${getStatusBadge(
                            report.status,
                          )}`}
                        >
                          {report.status}
                        </span>
                      </div>

                      <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {report.description}
                      </p>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground/70">
                        <span>
                          {report.district || "Sikkim"} · {report.latitude.toFixed(4)}°, {report.longitude.toFixed(4)}°
                        </span>
                        <span>
                          {new Date(report.timestamp).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Photo Modal */}
      {expandedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setExpandedPhoto(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-lg border border-border bg-card p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setExpandedPhoto(null)}
              className="absolute right-3 top-3 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/90"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={expandedPhoto}
              alt="Expanded Ground Evidence"
              className="max-h-[85vh] w-auto rounded object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
