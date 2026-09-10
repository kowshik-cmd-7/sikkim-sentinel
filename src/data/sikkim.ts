import {
  District,
  LandslideEvent,
  RainfallReading,
  RiskAlert,
  FieldReport,
  NER_STATES,
  type NERState,
} from "@/types";

export { NER_STATES, type NERState };

/**
 * DEMO DATA ONLY.
 * All values below are synthetic placeholders created for a prototype UI.
 * They are NOT sourced from ISRO, NASA, GSI, IMD or any government feed.
 */

export const SIKKIM_CENTER: [number, number] = [27.533, 88.512];

export const DISTRICTS: District[] = [
  { id: "gangtok", name: "Gangtok", state: "Sikkim", lat: 27.3389, lng: 88.6065, population: 100286, areaKm2: 954 },
  { id: "mangan", name: "Mangan (North)", state: "Sikkim", lat: 27.5074, lng: 88.5222, population: 43709, areaKm2: 4226 },
  { id: "pakyong", name: "Pakyong", state: "Sikkim", lat: 27.2333, lng: 88.5833, population: 74000, areaKm2: 402 },
  { id: "namchi", name: "Namchi (South)", state: "Sikkim", lat: 27.1667, lng: 88.35, population: 146742, areaKm2: 750 },
  { id: "gyalshing", name: "Gyalshing (West)", state: "Sikkim", lat: 27.2833, lng: 88.2667, population: 79000, areaKm2: 1166 },
  { id: "soreng", name: "Soreng", state: "Sikkim", lat: 27.1833, lng: 88.1833, population: 57000, areaKm2: 425 },
];

export interface WatchpointLocation {
  id: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
  description?: string;
}

export const SIKKIM_MONITORING_WATCHPOINTS: WatchpointLocation[] = [
  {
    id: "mgn-high",
    name: "Mangan (Alpine Steep Ridge)",
    district: "Mangan",
    lat: 27.8174,
    lng: 88.4778,
    description: "High-altitude steep alpine pass with elevated relief",
  },
  {
    id: "mgn-town",
    name: "Mangan District Center",
    district: "Mangan",
    lat: 27.505,
    lng: 88.532,
    description: "North Sikkim district administrative center and highway hub",
  },
  {
    id: "mgn-chungthang",
    name: "Chungthang Valley Corridor",
    district: "Mangan",
    lat: 27.6011,
    lng: 88.6446,
    description: "Critical confluence corridor with historical flood and landslide vulnerability",
  },
  {
    id: "mgn-dikchu",
    name: "Dikchu River Cut Slopes",
    district: "Mangan",
    lat: 27.4211,
    lng: 88.5122,
    description: "Hydropower approach road and river valley cut slopes",
  },
  {
    id: "gtk-capital",
    name: "Gangtok District Capital",
    district: "Gangtok",
    lat: 27.3389,
    lng: 88.6065,
    description: "High-density urban slope settlements in state capital",
  },
  {
    id: "gtk-ranipool",
    name: "Ranipool Corridor",
    district: "Gangtok",
    lat: 27.2531,
    lng: 88.5942,
    description: "NH-10 arterial cut slopes with frequent translational failures",
  },
  {
    id: "nmc-center",
    name: "Namchi District Center",
    district: "Namchi",
    lat: 27.1667,
    lng: 88.35,
    description: "South Sikkim district center and ridge communities",
  },
  {
    id: "nmc-melli",
    name: "Melli Riverbank Slopes",
    district: "Namchi",
    lat: 27.0925,
    lng: 88.4586,
    description: "Teesta riverbank undercutting and highway access point",
  },
  {
    id: "gyl-center",
    name: "Gyalshing District Center",
    district: "Gyalshing",
    lat: 27.2833,
    lng: 88.2667,
    description: "West Sikkim administrative center and tourist transit route",
  },
  {
    id: "pky-center",
    name: "Pakyong District Center",
    district: "Pakyong",
    lat: 27.2333,
    lng: 88.5833,
    description: "Airport ridge and transport corridor in East-South transition",
  },
  {
    id: "srn-center",
    name: "Soreng District Center",
    district: "Soreng",
    lat: 27.1833,
    lng: 88.1833,
    description: "Western border agricultural slopes and settlement belt",
  },
];

export const HISTORICAL_EVENTS: LandslideEvent[] = [
  { id: "ev-001", date: "2024-06-13", district: "Mangan (North)", location: "Chungthang", lat: 27.6011, lng: 88.6446, fatalities: 6, trigger: "rainfall", severity: "severe", notes: "Demo record: highway washout after multi-day monsoon burst." },
  { id: "ev-002", date: "2023-10-04", district: "Mangan (North)", location: "Lachen Valley", lat: 27.7167, lng: 88.5556, fatalities: 4, trigger: "rainfall", severity: "severe", notes: "Demo record: valley debris flow, downstream damage." },
  { id: "ev-003", date: "2023-08-21", district: "Gangtok", location: "Ranipool", lat: 27.2531, lng: 88.5942, fatalities: 1, trigger: "rainfall", severity: "high", notes: "Demo record: slope failure above arterial road." },
  { id: "ev-004", date: "2022-07-09", district: "Gangtok", location: "Sichey", lat: 27.3221, lng: 88.6021, fatalities: 0, trigger: "construction", severity: "moderate", notes: "Demo record: cut-slope failure at building site." },
  { id: "ev-005", date: "2022-06-24", district: "Namchi (South)", location: "Melli", lat: 27.0925, lng: 88.4586, fatalities: 2, trigger: "rainfall", severity: "high", notes: "Demo record: riverbank undercutting." },
  { id: "ev-006", date: "2021-09-16", district: "Gyalshing (West)", location: "Pelling Ridge", lat: 27.3014, lng: 88.2394, fatalities: 0, trigger: "rainfall", severity: "moderate", notes: "Demo record: shallow translational slide." },
  { id: "ev-007", date: "2021-05-30", district: "Pakyong", location: "Rongli Road", lat: 27.1783, lng: 88.6842, fatalities: 3, trigger: "rainfall", severity: "high", notes: "Demo record: road blocked 4 days." },
  { id: "ev-008", date: "2020-08-11", district: "Soreng", location: "Chakung", lat: 27.1614, lng: 88.1725, fatalities: 0, trigger: "unknown", severity: "low", notes: "Demo record: minor slump, no casualties." },
  { id: "ev-009", date: "2019-07-02", district: "Gangtok", location: "Tadong", lat: 27.3062, lng: 88.6009, fatalities: 1, trigger: "rainfall", severity: "moderate", notes: "Demo record: retaining wall collapse." },
  { id: "ev-010", date: "2018-09-28", district: "Mangan (North)", location: "Dikchu", lat: 27.4211, lng: 88.5122, fatalities: 2, trigger: "rainfall", severity: "high", notes: "Demo record: hydropower access road cut." },
  { id: "ev-011", date: "2017-06-19", district: "Namchi (South)", location: "Jorethang", lat: 27.1094, lng: 88.3247, fatalities: 0, trigger: "rainfall", severity: "moderate", notes: "Demo record: debris across market approach." },
  { id: "ev-012", date: "2016-07-14", district: "Gyalshing (West)", location: "Yuksom", lat: 27.3697, lng: 88.2214, fatalities: 1, trigger: "rainfall", severity: "moderate", notes: "Demo record: trekking route damaged." },
  { id: "ev-013", date: "2015-04-25", district: "Mangan (North)", location: "Lachung", lat: 27.6897, lng: 88.7431, fatalities: 5, trigger: "earthquake", severity: "severe", notes: "Demo record: co-seismic rockfall cluster." },
  { id: "ev-014", date: "2014-08-05", district: "Pakyong", location: "Rhenock", lat: 27.1697, lng: 88.6597, fatalities: 0, trigger: "construction", severity: "low", notes: "Demo record: quarry-adjacent slump." },
  { id: "ev-015", date: "2013-09-01", district: "Gangtok", location: "Deorali", lat: 27.3172, lng: 88.6142, fatalities: 2, trigger: "rainfall", severity: "high", notes: "Demo record: residential block evacuated." },
  { id: "ev-016", date: "2012-06-21", district: "Soreng", location: "Sombaria", lat: 27.2036, lng: 88.1489, fatalities: 0, trigger: "unknown", severity: "low", notes: "Demo record: farmland slope creep." },
];

function seeded(n: number) {
  const x = Math.sin(n * 9973.13) * 10000;
  return x - Math.floor(x);
}

export const RAINFALL_SERIES: RainfallReading[] = DISTRICTS.flatMap((d, di) =>
  Array.from({ length: 14 }, (_, i) => {
    const date = new Date(Date.UTC(2026, 8, 8) - (13 - i) * 86400000);
    const base = 8 + seeded(di * 31 + i) * 62;
    return {
      date: date.toISOString().slice(0, 10),
      district: d.name,
      rainfallMm: Math.round(base * 10) / 10,
      antecedent7dMm: Math.round(base * 4.2 * 10) / 10,
      soilMoisturePct: Math.round(35 + seeded(di * 17 + i) * 55),
    };
  }),
);

export const ALERTS: RiskAlert[] = [
  { id: "al-01", issuedAt: "2026-09-08T05:10:00Z", district: "Mangan (North)", level: "severe", headline: "Demo: severe slope-failure likelihood along NH-10 corridor", detail: "Prototype rule-based output using demo rainfall thresholds. Not an official warning.", acknowledged: false },
  { id: "al-02", issuedAt: "2026-09-08T04:40:00Z", district: "Gangtok", level: "high", headline: "Demo: high risk on cut slopes above Ranipool", detail: "Prototype output. 7-day antecedent rainfall in demo dataset exceeds threshold.", acknowledged: false },
  { id: "al-03", issuedAt: "2026-09-07T18:20:00Z", district: "Namchi (South)", level: "moderate", headline: "Demo: moderate risk near Melli riverbank", detail: "Prototype output based on synthetic soil-moisture values.", acknowledged: true },
  { id: "al-04", issuedAt: "2026-09-07T11:05:00Z", district: "Pakyong", level: "moderate", headline: "Demo: watch condition on Rongli approach road", detail: "Prototype output. Field verification required.", acknowledged: true },
  { id: "al-05", issuedAt: "2026-09-06T22:00:00Z", district: "Soreng", level: "low", headline: "Demo: routine monitoring, no action required", detail: "Prototype output.", acknowledged: true },
];

export const FIELD_REPORTS: FieldReport[] = [
  {
    id: "fr-01",
    latitude: 27.408,
    longitude: 88.528,
    timestamp: "2026-09-08T03:15:00Z",
    submittedAt: "2026-09-08T03:15:00Z",
    reporterName: "Ward Volunteer — Dikchu",
    reporter: "Ward Volunteer — Dikchu",
    district: "Mangan (North)",
    description: "Demo: fresh tension cracks above the link road, ~15 m long.",
    observation: "Demo: fresh tension cracks above the link road, ~15 m long.",
    category: "Slope Crack",
    severity: "High",
    status: "SUBMITTED",
  },
  {
    id: "fr-02",
    latitude: 27.3389,
    longitude: 88.6065,
    timestamp: "2026-09-07T14:02:00Z",
    submittedAt: "2026-09-07T14:02:00Z",
    reporterName: "PWD Field Unit",
    reporter: "PWD Field Unit",
    district: "Gangtok",
    description: "Demo: continuous seepage from retaining wall weep holes.",
    observation: "Demo: continuous seepage from retaining wall weep holes.",
    category: "Waterlogging",
    severity: "Moderate",
    status: "REVIEWED",
  },
  {
    id: "fr-03",
    latitude: 27.181,
    longitude: 88.462,
    timestamp: "2026-09-06T09:30:00Z",
    submittedAt: "2026-09-06T09:30:00Z",
    reporterName: "Panchayat Office — Melli",
    reporter: "Panchayat Office — Melli",
    district: "Namchi (South)",
    description: "Demo: minor debris on carriageway, cleared locally.",
    observation: "Demo: minor debris on carriageway, cleared locally.",
    category: "Road Blockage",
    severity: "Low",
    status: "RESOLVED",
  },
];
