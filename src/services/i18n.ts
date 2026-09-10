/**
 * DEMO multilingual template service.
 * Static templates only — no translation API is connected. A future FastAPI
 * backend can expose GET /api/v1/alerts/{id}/messages?lang=xx and replace this.
 */
import type { AlertLanguage, RenderedMessage, WarningAlert } from "@/types/alerts";
import type { RiskLevel } from "@/types";

type Dict = {
  severity: Record<RiskLevel, string>;
  title: string;
  body: string;
  sms: string;
  ui: Record<string, string>;
};

export const TEMPLATES: Record<AlertLanguage, Dict> = {
  en: {
    severity: {
      low: "Low",
      moderate: "Moderate",
      high: "High",
      "very-high": "Very High",
      severe: "Severe",
      "insufficient-data": "Insufficient Data",
    },
    title: "{severity} landslide alert — {district}",
    body: "{summary} Affected areas: {areas}. Valid until {expires}. Advice: {instructions}",
    sms: "[DEMO] {severity} landslide alert for {district}. {instructions} Valid till {expires}.",
    ui: { demo: "Demo message — not an official warning." },
  },
  hi: {
    severity: {
      low: "कम",
      moderate: "मध्यम",
      high: "उच्च",
      "very-high": "अत्यधिक उच्च",
      severe: "गंभीर",
      "insufficient-data": "अपर्याप्त डेटा",
    },
    title: "{severity} भूस्खलन चेतावनी — {district}",
    body: "{summary} प्रभावित क्षेत्र: {areas}. {expires} तक मान्य. सलाह: {instructions}",
    sms: "[डेमो] {district} के लिए {severity} भूस्खलन चेतावनी। {instructions} {expires} तक मान्य।",
    ui: { demo: "डेमो संदेश — यह आधिकारिक चेतावनी नहीं है।" },
  },
  ne: {
    severity: {
      low: "न्यून",
      moderate: "मध्यम",
      high: "उच्च",
      "very-high": "अत्यधिक उच्च",
      severe: "गम्भीर",
      "insufficient-data": "अपर्याप्त डेटा",
    },
    title: "{severity} पहिरो चेतावनी — {district}",
    body: "{summary} प्रभावित क्षेत्र: {areas}. {expires} सम्म मान्य. सल्लाह: {instructions}",
    sms: "[डेमो] {district} का लागि {severity} पहिरो चेतावनी। {instructions} {expires} सम्म मान्य।",
    ui: { demo: "डेमो सन्देश — यो आधिकारिक चेतावनी होइन।" },
  },
  te: {
    severity: {
      low: "తక్కువ",
      moderate: "మధ్యస్థం",
      high: "అధికం",
      "very-high": "చాలా ఎక్కువ",
      severe: "తీవ్రం",
      "insufficient-data": "సరిపోని డేటా",
    },
    title: "{severity} కొండచరియల హెచ్చరిక — {district}",
    body: "{summary} ప్రభావిత ప్రాంతాలు: {areas}. {expires} వరకు చెల్లుతుంది. సూచన: {instructions}",
    sms: "[డెమో] {district} కోసం {severity} కొండచరియల హెచ్చరిక. {instructions} {expires} వరకు.",
    ui: { demo: "డెమో సందేశం — ఇది అధికారిక హెచ్చరిక కాదు." },
  },
};

function fill(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}

export function renderAlertMessage(
  alert: WarningAlert,
  language: AlertLanguage,
): RenderedMessage {
  const dict = TEMPLATES[language];
  const districts = [...new Set(alert.affectedAreas.map((a) => a.district))].join(", ");
  const areas = alert.affectedAreas.map((a) => a.locality).join(", ");
  const vars = {
    severity: dict.severity[alert.severity],
    district: districts || "Sikkim",
    areas: areas || "—",
    summary: alert.summary,
    instructions: alert.instructions,
    expires: new Date(alert.expiresAt).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
  return {
    language,
    title: fill(dict.title, vars),
    body: fill(dict.body, vars),
    sms: fill(dict.sms, vars).slice(0, 300),
  };
}

export function demoDisclaimer(language: AlertLanguage) {
  return TEMPLATES[language].ui["demo"]!;
}
