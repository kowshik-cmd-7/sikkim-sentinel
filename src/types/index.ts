export type RiskLevel = "low" | "moderate" | "high" | "severe";

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
  score: number;
  level: RiskLevel;
  factors: { label: string; value: number; weight: number }[];
  recommendation: string;
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
