import type { RiskLevel } from "@/types";

/** Languages supported by the DEMO multilingual template service. */
export type AlertLanguage = "en" | "hi" | "ne" | "te";

export const LANGUAGES: { code: AlertLanguage; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "ne", label: "Nepali", native: "नेपाली" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
];

export type AlertType =
  | "landslide-risk"
  | "rainfall-threshold"
  | "road-closure"
  | "evacuation"
  | "field-observation";

export const ALERT_TYPES: { value: AlertType; label: string }[] = [
  { value: "landslide-risk", label: "Landslide risk" },
  { value: "rainfall-threshold", label: "Rainfall threshold" },
  { value: "road-closure", label: "Road closure" },
  { value: "evacuation", label: "Evacuation advisory" },
  { value: "field-observation", label: "Field observation" },
];

export type AlertStatus = "draft" | "published" | "expired";

export type DeliveryChannel = "in-app" | "push" | "sms";

export type DeliveryStatus = "queued" | "sent" | "delivered" | "failed";

export interface AffectedArea {
  id: string;
  district: string;
  locality: string;
  lat: number;
  lng: number;
  radiusKm: number;
  estimatedPopulation: number;
}

export interface DeliveryRecord {
  id: string;
  alertId: string;
  channel: DeliveryChannel;
  language: AlertLanguage;
  recipientGroup: string;
  recipients: number;
  status: DeliveryStatus;
  dispatchedAt: string;
  note: string;
}

/** Core alert-engine record. DEMO DATA — never an official warning. */
export interface WarningAlert {
  id: string;
  code: string;
  type: AlertType;
  severity: RiskLevel;
  status: AlertStatus;
  title: string;
  summary: string;
  instructions: string;
  source: string;
  triggerRule: string;
  confidencePct: number;
  issuedAt: string;
  expiresAt: string;
  updatedAt: string;
  affectedAreas: AffectedArea[];
  languages: AlertLanguage[];
  channels: DeliveryChannel[];
  acknowledgedBy: string[];
  isDemo: true;
}

export interface AlertNotification {
  id: string;
  alertId: string;
  receivedAt: string;
  read: boolean;
  acknowledged: boolean;
}

export interface AlertPreferences {
  districts: string[];
  language: AlertLanguage;
  types: AlertType[];
  minSeverity: RiskLevel;
  channels: DeliveryChannel[];
}

export interface RenderedMessage {
  language: AlertLanguage;
  title: string;
  body: string;
  sms: string;
}

export type ConnectionState = "online" | "offline" | "syncing";

export type {
  DashboardAlert,
  DashboardAlertSeverity,
  DashboardAlertStatus,
  DashboardNotificationStatus,
  DashboardAlertHorizon,
} from "@/types";
