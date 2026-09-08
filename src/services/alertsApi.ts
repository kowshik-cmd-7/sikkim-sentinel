/**
 * Mock alert & notification API boundary.
 * Swap each body for a fetch against the future FastAPI service:
 *   GET    /api/v1/alerts
 *   GET    /api/v1/alerts/{id}
 *   POST   /api/v1/alerts
 *   PATCH  /api/v1/alerts/{id}
 *   POST   /api/v1/alerts/{id}/publish
 *   POST   /api/v1/alerts/{id}/expire
 *   POST   /api/v1/alerts/{id}/acknowledge
 *   POST   /api/v1/alerts/evaluate
 *   GET    /api/v1/notifications
 *   POST   /api/v1/notifications/{id}/read
 *   GET    /api/v1/notifications/deliveries
 *   GET/PUT /api/v1/preferences
 */
import {
  DEFAULT_PREFERENCES,
  DEMO_ALERTS,
  DEMO_DELIVERIES,
  DEMO_NOTIFICATIONS,
} from "@/data/alerts-demo";
import type {
  AlertNotification,
  AlertPreferences,
  DeliveryRecord,
  WarningAlert,
} from "@/types/alerts";
import {
  draftFromEvaluation,
  evaluateDemoRules,
  type RuleEvaluation,
} from "@/services/alertEngine";
import { mockDispatch } from "@/services/notificationService";

export const ALERTS_API_BASE = "/api/v1";
const LATENCY = 180;
const PREF_KEY = "sikkim-sentinel.alert-preferences";

function delay<T>(value: T, ms = LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

let alerts: WarningAlert[] = DEMO_ALERTS.map((a) => ({ ...a }));
let deliveries: DeliveryRecord[] = [...DEMO_DELIVERIES];
let notifications: AlertNotification[] = [...DEMO_NOTIFICATIONS];

function touch(id: string, patch: Partial<WarningAlert>) {
  alerts = alerts.map((a) =>
    a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a,
  );
  return alerts.find((a) => a.id === id)!;
}

export type NewAlertInput = Omit<
  WarningAlert,
  "id" | "code" | "updatedAt" | "acknowledgedBy" | "isDemo"
>;

export const alertsApi = {
  listAlerts: (): Promise<WarningAlert[]> => delay(alerts),

  getAlert: (id: string): Promise<WarningAlert | undefined> =>
    delay(alerts.find((a) => a.id === id)),

  createAlert: (input: NewAlertInput): Promise<WarningAlert> => {
    const seq = String(alerts.length + 1).padStart(4, "0");
    const alert: WarningAlert = {
      ...input,
      id: `wa-2026-${seq}`,
      code: `SKM-NEW-${seq}`,
      updatedAt: new Date().toISOString(),
      acknowledgedBy: [],
      isDemo: true,
    };
    alerts = [alert, ...alerts];
    return delay(alert);
  },

  updateAlert: (id: string, patch: Partial<WarningAlert>): Promise<WarningAlert> =>
    delay(touch(id, patch)),

  publishAlert: (id: string): Promise<{ alert: WarningAlert; deliveries: DeliveryRecord[] }> => {
    const alert = touch(id, { status: "published", issuedAt: new Date().toISOString() });
    const fresh = mockDispatch({
      alert,
      channels: alert.channels,
      languages: alert.languages,
    });
    deliveries = [...fresh, ...deliveries.filter((d) => d.alertId !== id)];
    notifications = [
      {
        id: `nt-${alert.id}`,
        alertId: alert.id,
        receivedAt: new Date().toISOString(),
        read: false,
        acknowledged: false,
      },
      ...notifications.filter((n) => n.alertId !== alert.id),
    ];
    return delay({ alert, deliveries: fresh });
  },

  expireAlert: (id: string): Promise<WarningAlert> =>
    delay(touch(id, { status: "expired", expiresAt: new Date().toISOString() })),

  acknowledgeAlert: (id: string, by = "District Control Room"): Promise<WarningAlert> => {
    const current = alerts.find((a) => a.id === id)!;
    const alert = touch(id, {
      acknowledgedBy: current.acknowledgedBy.includes(by)
        ? current.acknowledgedBy
        : [...current.acknowledgedBy, by],
    });
    notifications = notifications.map((n) =>
      n.alertId === id ? { ...n, acknowledged: true, read: true } : n,
    );
    return delay(alert);
  },

  evaluateRules: (): Promise<RuleEvaluation[]> => delay(evaluateDemoRules()),

  createDraftsFromRules: (): Promise<WarningAlert[]> => {
    const drafts = evaluateDemoRules()
      .map(draftFromEvaluation)
      .filter((d): d is WarningAlert => Boolean(d))
      .filter((d) => !alerts.some((a) => a.triggerRule === d.triggerRule && a.status === "draft"));
    alerts = [...drafts, ...alerts];
    return delay(drafts);
  },

  listDeliveries: (): Promise<DeliveryRecord[]> => delay(deliveries),

  listNotifications: (): Promise<AlertNotification[]> => delay(notifications, 90),

  markRead: (id: string): Promise<AlertNotification[]> => {
    notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    return delay(notifications, 60);
  },

  markAllRead: (): Promise<AlertNotification[]> => {
    notifications = notifications.map((n) => ({ ...n, read: true }));
    return delay(notifications, 60);
  },

  getPreferences: (): Promise<AlertPreferences> => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(PREF_KEY);
      if (raw) {
        try {
          return delay({ ...DEFAULT_PREFERENCES, ...JSON.parse(raw) }, 60);
        } catch {
          /* ignore malformed cache */
        }
      }
    }
    return delay(DEFAULT_PREFERENCES, 60);
  },

  savePreferences: (prefs: AlertPreferences): Promise<AlertPreferences> => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    }
    return delay(prefs, 60);
  },
};
