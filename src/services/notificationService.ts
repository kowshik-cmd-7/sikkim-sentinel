/**
 * MOCK delivery service.
 *
 * Simulates in-app, push and SMS dispatch. Nothing leaves the browser: every
 * result below is a MOCK NOTIFICATION result. Future integration points:
 *   POST /api/v1/notifications/dispatch
 *   GET  /api/v1/notifications/deliveries?alertId=...
 */
import type {
  AlertLanguage,
  DeliveryChannel,
  DeliveryRecord,
  DeliveryStatus,
  WarningAlert,
} from "@/types/alerts";
import { renderAlertMessage } from "@/services/i18n";

export interface DispatchRequest {
  alert: WarningAlert;
  channels: DeliveryChannel[];
  languages: AlertLanguage[];
}

const GROUPS: Record<DeliveryChannel, string> = {
  "in-app": "App users in affected districts (demo list)",
  push: "Push subscribers (demo list)",
  sms: "SMS recipients (demo list)",
};

function mockStatus(channel: DeliveryChannel, seed: number): DeliveryStatus {
  if (channel === "in-app") return "delivered";
  return seed % 7 === 0 ? "failed" : seed % 2 === 0 ? "delivered" : "sent";
}

/** Returns simulated delivery records — no message is actually transmitted. */
export function mockDispatch(req: DispatchRequest): DeliveryRecord[] {
  const population = req.alert.affectedAreas.reduce(
    (s, a) => s + a.estimatedPopulation,
    0,
  );
  const now = new Date().toISOString();
  const records: DeliveryRecord[] = [];
  req.channels.forEach((channel, ci) => {
    req.languages.forEach((language, li) => {
      const seed = ci * 13 + li * 7 + population;
      const share = channel === "sms" ? 0.6 : channel === "push" ? 0.35 : 0.25;
      records.push({
        id: `dl-${req.alert.id}-${channel}-${language}`,
        alertId: req.alert.id,
        channel,
        language,
        recipientGroup: GROUPS[channel],
        recipients: Math.max(
          25,
          Math.round((population * share) / req.languages.length),
        ),
        status: mockStatus(channel, seed),
        dispatchedAt: now,
        note: `MOCK NOTIFICATION — "${renderAlertMessage(req.alert, language).sms.slice(0, 80)}…" was not actually sent.`,
      });
    });
  });
  return records;
}
