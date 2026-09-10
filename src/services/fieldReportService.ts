import type {
  FieldReport,
  FieldReportCategory,
  FieldReportSeverity,
  FieldReportStatus,
} from "@/types";

const STORAGE_KEY = "sikkim-sentinel-field-reports";

// Realistic seed observations in Sikkim for immediate SIH demo presentation
export const SEED_FIELD_REPORTS: FieldReport[] = [
  {
    id: "fr-sih-01",
    latitude: 27.6025,
    longitude: 88.6475,
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(), // 4h ago
    category: "Slope Crack",
    severity: "Critical",
    description:
      "Deep transverse fissure opening along upslope embankment near Chungthang. Progressive tension gap widening after heavy 48-hour rainfall. Imminent slope failure risk above highway.",
    photo: null,
    reporterName: "PWD Engineer - Sub-Division Chungthang",
    status: "REVIEWED",
    district: "Mangan",
    state: "Sikkim",
    elevation: 1780,
    slope: 38.5,
    reviewedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    submittedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    reporter: "PWD Engineer - Sub-Division Chungthang",
    observation:
      "Deep transverse fissure opening along upslope embankment near Chungthang. Progressive tension gap widening after heavy 48-hour rainfall. Imminent slope failure risk above highway.",
  },
  {
    id: "fr-sih-02",
    latitude: 27.408,
    longitude: 88.528,
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString(), // 12h ago
    category: "Road Blockage",
    severity: "High",
    description:
      "Debris slide blocking both lanes on Dikchu link road. Mud slurry and dislodged boulders covering 30 meters of carriageway. Heavy earth-moving equipment mobilized.",
    photo: null,
    reporterName: "Ward Disaster Management Volunteer - Dikchu",
    status: "SUBMITTED",
    district: "Mangan",
    state: "Sikkim",
    elevation: 820,
    slope: 31.2,
    submittedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    reporter: "Ward Disaster Management Volunteer - Dikchu",
    observation:
      "Debris slide blocking both lanes on Dikchu link road. Mud slurry and dislodged boulders covering 30 meters of carriageway. Heavy earth-moving equipment mobilized.",
  },
  {
    id: "fr-sih-03",
    latitude: 27.5074,
    longitude: 88.5222,
    timestamp: new Date(Date.now() - 3600000 * 26).toISOString(), // 1 day ago
    category: "Rockfall",
    severity: "Moderate",
    description:
      "Intermittent rock dislodgement from upper basalt face above bypass road. Protective wire mesh damaged in two sections. Light vehicles advised caution.",
    photo: null,
    reporterName: "BRO Field Patrol Unit",
    status: "SUBMITTED",
    district: "Mangan",
    state: "Sikkim",
    elevation: 1250,
    slope: 42.0,
    submittedAt: new Date(Date.now() - 3600000 * 26).toISOString(),
    reporter: "BRO Field Patrol Unit",
    observation:
      "Intermittent rock dislodgement from upper basalt face above bypass road. Protective wire mesh damaged in two sections. Light vehicles advised caution.",
  },
  {
    id: "fr-sih-04",
    latitude: 27.3389,
    longitude: 88.6065,
    timestamp: new Date(Date.now() - 3600000 * 50).toISOString(), // 2 days ago
    category: "Landslide",
    severity: "High",
    description:
      "Active rotational earth slip behind residential retaining structure in Gangtok Development Area. Surface drainage diverted and containment gabions deployed.",
    photo: null,
    reporterName: "Urban Development Inspection Team",
    status: "RESOLVED",
    district: "Gangtok",
    state: "Sikkim",
    elevation: 1650,
    slope: 28.5,
    reviewedAt: new Date(Date.now() - 3600000 * 36).toISOString(),
    resolvedAt: new Date(Date.now() - 3600000 * 10).toISOString(),
    submittedAt: new Date(Date.now() - 3600000 * 50).toISOString(),
    reporter: "Urban Development Inspection Team",
    observation:
      "Active rotational earth slip behind residential retaining structure in Gangtok Development Area. Surface drainage diverted and containment gabions deployed.",
  },
];

/**
 * Normalizes raw or legacy stored reports to ensure type safety.
 */
function normalizeReport(raw: any): FieldReport {
  const lat = typeof raw.latitude === "number" ? raw.latitude : 27.5074;
  const lng = typeof raw.longitude === "number" ? raw.longitude : 88.5222;
  const timestamp = raw.timestamp || raw.submittedAt || new Date().toISOString();
  const description = raw.description || raw.observation || "Field observation noted.";
  const reporterName = raw.reporterName || raw.reporter || "Anonymous Field Officer";

  // Map legacy categories if needed
  let category: FieldReportCategory = "Landslide";
  const cat = String(raw.category || "").toLowerCase();
  if (cat.includes("crack")) category = "Slope Crack";
  else if (cat.includes("block") || cat.includes("road")) category = "Road Blockage";
  else if (cat.includes("rock")) category = "Rockfall";
  else if (cat.includes("flood")) category = "Flash Flood";
  else if (cat.includes("water") || cat.includes("seep")) category = "Waterlogging";
  else if (cat.includes("damage") || cat.includes("infrastruct")) category = "Infrastructure Damage";
  else if (cat.includes("landslide") || cat.includes("slope")) category = "Landslide";
  else if (raw.category) category = raw.category as FieldReportCategory;

  // Map severity
  let severity: FieldReportSeverity = "Moderate";
  const sev = String(raw.severity || "").toLowerCase();
  if (sev === "critical" || sev === "very-high" || sev === "very high") severity = "Critical";
  else if (sev === "high") severity = "High";
  else if (sev === "moderate" || sev === "medium") severity = "Moderate";
  else if (sev === "low") severity = "Low";

  // Status
  let status: FieldReportStatus = "SUBMITTED";
  const st = String(raw.status || "").toUpperCase();
  if (st === "RESOLVED") status = "RESOLVED";
  else if (st === "REVIEWED") status = "REVIEWED";

  return {
    id: raw.id || `fr-${Math.random().toString(36).slice(2, 8)}`,
    latitude: lat,
    longitude: lng,
    timestamp,
    category,
    severity,
    description,
    photo: raw.photo || null,
    reporterName,
    status,
    district: raw.district || "Mangan",
    state: raw.state || "Sikkim",
    elevation: raw.elevation ?? null,
    slope: raw.slope ?? null,
    reviewedAt: raw.reviewedAt,
    resolvedAt: raw.resolvedAt,
    submittedAt: timestamp,
    reporter: reporterName,
    observation: description,
  };
}

/**
 * Retrieves all stored field reports from localStorage, seeding with realistic reports if empty.
 */
export function getStoredFieldReports(): FieldReport[] {
  if (typeof window === "undefined") {
    return SEED_FIELD_REPORTS;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_FIELD_REPORTS));
      return SEED_FIELD_REPORTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(normalizeReport);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_FIELD_REPORTS));
    return SEED_FIELD_REPORTS;
  } catch (e) {
    console.error("Failed to read field reports from localStorage:", e);
    return SEED_FIELD_REPORTS;
  }
}

/**
 * Saves a new field report to localStorage.
 */
export function saveFieldReport(
  input: Omit<FieldReport, "id" | "timestamp" | "status"> & Partial<Pick<FieldReport, "status">>,
): FieldReport {
  const reports = getStoredFieldReports();
  const timestamp = new Date().toISOString();
  const id = `fr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  const newReport: FieldReport = {
    id,
    latitude: Number(input.latitude.toFixed(5)),
    longitude: Number(input.longitude.toFixed(5)),
    timestamp,
    category: input.category,
    severity: input.severity,
    description: input.description.trim(),
    photo: input.photo || null,
    reporterName: input.reporterName?.trim() || "Anonymous Field Officer",
    status: input.status || "SUBMITTED",
    district: input.district || "Mangan",
    state: input.state || "Sikkim",
    elevation: input.elevation ?? null,
    slope: input.slope ?? null,
    submittedAt: timestamp,
    reporter: input.reporterName?.trim() || "Anonymous Field Officer",
    observation: input.description.trim(),
  };

  const updated = [newReport, ...reports];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save report to localStorage:", e);
  }

  return newReport;
}

/**
 * Updates the status of an existing field report.
 */
export function updateFieldReportStatus(
  id: string,
  newStatus: FieldReportStatus,
): FieldReport | null {
  const reports = getStoredFieldReports();
  let updatedReport: FieldReport | null = null;

  const now = new Date().toISOString();
  const updated = reports.map((r) => {
    if (r.id === id) {
      updatedReport = {
        ...r,
        status: newStatus,
        reviewedAt: newStatus === "REVIEWED" ? (r.reviewedAt || now) : r.reviewedAt,
        resolvedAt: newStatus === "RESOLVED" ? now : (newStatus === "SUBMITTED" ? undefined : r.resolvedAt),
      };
      return updatedReport;
    }
    return r;
  });

  if (updatedReport) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to update report in localStorage:", e);
    }
  }

  return updatedReport;
}

/**
 * Deletes a field report by ID.
 */
export function deleteFieldReport(id: string): boolean {
  const reports = getStoredFieldReports();
  const filtered = reports.filter((r) => r.id !== id);
  if (filtered.length !== reports.length) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      return true;
    } catch (e) {
      console.error("Failed to delete report from localStorage:", e);
    }
  }
  return false;
}

/**
 * Compresses an image file before storing it in localStorage to prevent quota exhaustion.
 * Constrains dimensions to maxWidth (default 800px) and quality 0.75 JPEG.
 */
export async function compressImage(
  file: File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.75,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Selected file is not an image."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image preview."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
