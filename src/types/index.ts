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

export interface LocationAssessment {
  lat: number;
  lng: number;
  district: string;
  score: number | null;
  level: RiskLevel;
  factors: AssessmentFactor[];
  recommendation: string;
  rainfallInputs?: RainfallModelInputs;
}

export interface FieldReport {
  id: string;
  submittedAt: string;
  reporter: string;
  district: string;
  observation: string;
  category: "crack" | "slope-movement" | "water-seepage" | "road-block" | "other";
  severity: RiskLevel;
}
