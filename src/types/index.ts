export type RiskLevel =
  | "low"
  | "moderate"
  | "high"
  | "very-high"
  | "severe"
  | "insufficient-data";

export interface RainfallModelInputs {
  rainfall_1d: number | null;
  rainfall_3d: number | null;
  rainfall_7d: number | null;
  rainfall_14d: number | null;
  rainfall_30d: number | null;
}

export interface AssessmentFactor {
  label: string;
  value: number | null;
  weight: number;
  importancePct: number;
}

export interface District {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  population: number;
  areaKm2: number;
}

export interface LandslideEvent {
  id: string;
  date: string; // ISO date
  district: string;
  location: string;
  lat: number;
  lng: number;
  fatalities: number;
  trigger: "rainfall" | "earthquake" | "construction" | "unknown";
  severity: RiskLevel;
  notes: string;
}

export interface RiskCell {
  id: string;
  lat: number;
  lng: number;
  size: number; // degrees
  score: number; // 0-100
  level: RiskLevel;
}

export interface RainfallReading {
  date: string;
  district: string;
  rainfallMm: number;
  antecedent7dMm: number;
  soilMoisturePct: number;
}

export interface RiskAlert {
  id: string;
  issuedAt: string;
  district: string;
  level: RiskLevel;
  headline: string;
  detail: string;
  acknowledged: boolean;
}

export interface HybridRiskAssessment {
  rainfallRiskScore: number | null;
  rainfallRiskLevel: RiskLevel;
  terrainScore: number;
  terrainSusceptibility: TerrainSusceptibility;
  finalRiskScore: number | null;
  finalRiskLevel: RiskLevel;
  terrainContribution: number;
}

export interface LocationAssessment {
  lat: number;
  lng: number;
  district: string;
  score: number | null; // Final hybrid score for backwards compatibility
  level: RiskLevel; // Final hybrid level for backwards compatibility
  factors: AssessmentFactor[];
  recommendation: string;
  rainfallInputs?: RainfallModelInputs;
  rainfallSource?: string;
  // Explicit Hybrid Risk Layer breakdown
  rainfallRiskScore?: number | null;
  rainfallRiskLevel?: RiskLevel;
  terrainAssessment?: TerrainAssessment | null;
  terrainScore?: number;
  terrainContribution?: number;
  finalRiskScore?: number | null;
  finalRiskLevel?: RiskLevel;
}

export type FieldReportCategory =
  | "Landslide"
  | "Road Blockage"
  | "Rockfall"
  | "Slope Crack"
  | "Flash Flood"
  | "Waterlogging"
  | "Infrastructure Damage"
  | "Other";

export type FieldReportSeverity = "Low" | "Moderate" | "High" | "Critical";

export type FieldReportStatus = "SUBMITTED" | "REVIEWED" | "RESOLVED";

export interface FieldReport {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  category: FieldReportCategory;
  severity: FieldReportSeverity;
  description: string;
  photo?: string | null | undefined;
  reporterName?: string | null | undefined;
  status: FieldReportStatus;
  district?: string | null | undefined;
  state?: string | null | undefined;
  elevation?: number | null | undefined;
  slope?: number | null | undefined;
  reviewedAt?: string | null | undefined;
  resolvedAt?: string | null | undefined;
  // Legacy compatibility fields
  submittedAt?: string | null | undefined;
  reporter?: string | null | undefined;
  observation?: string | null | undefined;
}

export type SlopeCategory = "Flat" | "Moderate" | "Steep" | "Very Steep";
export type TerrainSusceptibility = "Low" | "Moderate" | "High" | "Very High";

export interface TerrainAssessment {
  latitude: number;
  longitude: number;
  elevation_m: number;
  slope_degrees: number;
  slope_category: SlopeCategory;
  terrain_susceptibility: TerrainSusceptibility;
  data_source: string;
}

export type FacilityType = "authority" | "school" | "hospital";

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  latitude: number;
  longitude: number;
  address: string;
  district: string;
  contact: string;
  distance_km?: number | undefined;
}

export type AlertSeverity = "WATCH" | "WARNING" | "CRITICAL";

export interface AlertRecipient {
  id: string;
  facilityId: string;
  name: string;
  type: FacilityType;
  category: "Authorities" | "Health" | "Education";
  priority: number; // 1: Authority, 2: Hospital, 3: School
  distanceKm: number;
  contact: string;
  status: "queued" | "notified";
}

export interface LandslideAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  generatedAt: string;
  affectedLatitude: number;
  affectedLongitude: number;
  affectedDistrict: string;
  currentRisk: number | null;
  currentRiskLevel: RiskLevel;
  forecastRisk: number | null;
  forecastRiskLevel: RiskLevel;
  forecastHorizon: string; // e.g. "24h" or "Current"
  forecastRainfall: number;
  peakRainfallMm?: number | undefined;
  terrainSusceptibility: TerrainSusceptibility;
  slope: number;
  elevation: number;
  rainfall: {
    r1d: number | null;
    r3d: number | null;
    r7d: number | null;
    r14d: number | null;
    r30d: number | null;
  };
  recipients: AlertRecipient[];
  recommendedActions: string[];
  acknowledged: boolean;
  acknowledgedAt?: string | undefined;
  acknowledgedBy?: string | undefined;
  isDemo: boolean;
}

export interface AlertEvaluation {
  shouldAlert: boolean;
  severity: AlertSeverity | null;
  alert: LandslideAlert | null;
  triggerReason: string;
  nearbyFacilities: Facility[];
}

export type DashboardAlertSeverity = "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
export type DashboardAlertStatus = "ACTIVE" | "SENT" | "ACKNOWLEDGED" | "RESOLVED" | "EXPIRED";
export type DashboardNotificationStatus = "NOT_SENT" | "SENT";
export type DashboardAlertHorizon = "CURRENT" | "6H" | "24H" | "48H" | "72H";

export interface DashboardAlert {
  id: string;
  severity: DashboardAlertSeverity;
  status: DashboardAlertStatus;
  notificationStatus: DashboardNotificationStatus;
  latitude: number;
  longitude: number;
  locationLabel: string;
  horizon: DashboardAlertHorizon;
  riskScore: number;
  riskLevel: string;
  rainfallRiskScore: number;
  terrainScore: number;
  terrainSusceptibility: string;
  terrainContribution: number;
  finalRiskScore: number;
  finalRiskLevel: string;
  rainfall: number;
  elevation?: number | undefined;
  slope?: number | undefined;
  slopeClassification?: string | undefined;
  radiusKm: number;
  message: string;
  createdAt: string;
  expiresAt: string;
  expiryDuration?: string | undefined;
  sentAt?: string | undefined;
  acknowledgedAt?: string | undefined;
  resolvedAt?: string | undefined;
  isDemo?: boolean | undefined;
}

export interface MonitoringRiskPoint {
  id: string;
  latitude: number;
  longitude: number;
  locationName: string;
  district: string;
  currentRisk: number | null;
  currentRiskLevel: string;
  risk6h: number | null;
  risk6hLevel: string;
  risk24h: number | null;
  risk24hLevel: string;
  risk48h: number | null;
  risk48hLevel: string;
  risk72h: number | null;
  risk72hLevel: string;
  rainfall1d: number | null;
  rainfall3d: number | null;
  rainfall7d: number | null;
  rainfall14d: number | null;
  rainfall30d: number | null;
  forecast6h: number | null;
  forecast24h: number | null;
  forecast48h: number | null;
  forecast72h: number | null;
  elevation: number | null;
  slope: number | null;
  terrainSusceptibility: string;
  status?: "success" | "insufficient_data" | "error" | undefined;
  updatedAt?: string | undefined;
}

export interface StateBoundaryFeature {
  type: "Feature";
  properties: {
    STNAME?: string;
    STCODE11?: string;
    STNAME_SH?: string;
    State_LGD?: number;
    [key: string]: any;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: any;
  };
  source?: string;
}

export interface CalculatedRiskPoint {
  latitude: number;
  longitude: number;
  locationName?: string;
  riskScore: number | null;
  riskLevel: "Low" | "Moderate" | "High" | "Very High" | "Insufficient Data";
  rainfallRiskScore?: number | null;
  terrainScore?: number | null;
  terrainSusceptibility?: string | null;
  elevation?: number | null;
  slope?: number | null;
  rainfall7d?: number | null;
  forecast72h?: number | null;
  status: "success" | "error" | "insufficient_data";
}

export interface StateRiskSummary {
  stateName: string;
  assessedCount: number;
  lowCount: number;
  moderateCount: number;
  highCount: number;
  veryHighCount: number;
  highestRisk: number;
}

/**
 * North Eastern Region (NER) States - SIH Problem Statement 26001 Scope
 * The system supports strictly these 8 states.
 */
export const NER_STATES = [
  "Arunachal Pradesh",
  "Assam",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Sikkim",
  "Tripura",
] as const;

export type NERState = (typeof NER_STATES)[number];




