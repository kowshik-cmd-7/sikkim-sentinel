import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { alertsApi } from "@/services/alertsApi";
import type { AlertPreferences, WarningAlert } from "@/types/alerts";
import type { RiskLevel } from "@/types";

const SEVERITY_ORDER: Record<RiskLevel, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  severe: 3,
};

export function matchesPreferences(alert: WarningAlert, prefs: AlertPreferences) {
  if (SEVERITY_ORDER[alert.severity] < SEVERITY_ORDER[prefs.minSeverity]) return false;
  if (prefs.types.length && !prefs.types.includes(alert.type)) return false;
  if (
    prefs.districts.length &&
    !alert.affectedAreas.some((a) => prefs.districts.includes(a.district))
  )
    return false;
  return true;
}

export function useAlerts() {
  return useQuery({ queryKey: ["warning-alerts"], queryFn: alertsApi.listAlerts });
}

export function usePreferences() {
  return useQuery({ queryKey: ["alert-preferences"], queryFn: alertsApi.getPreferences });
}

export function useNotifications() {
  const qc = useQueryClient();
  const alerts = useAlerts();
  const prefs = usePreferences();
  const list = useQuery({
    queryKey: ["alert-notifications"],
    queryFn: alertsApi.listNotifications,
  });

  const byId = new Map((alerts.data ?? []).map((a) => [a.id, a] as const));
  const items = (list.data ?? [])
    .map((n) => ({ notification: n, alert: byId.get(n.alertId) }))
    .filter(
      (x): x is { notification: (typeof list.data)[number]; alert: WarningAlert } =>
        Boolean(x.alert),
    )
    .filter((x) => (prefs.data ? matchesPreferences(x.alert, prefs.data) : true))
    .sort(
      (a, b) =>
        +new Date(b.notification.receivedAt) - +new Date(a.notification.receivedAt),
    );

  const markRead = useMutation({
    mutationFn: (id: string) => alertsApi.markRead(id),
    onSuccess: (data) => qc.setQueryData(["alert-notifications"], data),
  });

  const markAllRead = useMutation({
    mutationFn: () => alertsApi.markAllRead(),
    onSuccess: (data) => qc.setQueryData(["alert-notifications"], data),
  });

  const acknowledge = useMutation({
    mutationFn: (alertId: string) => alertsApi.acknowledgeAlert(alertId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warning-alerts"] });
      qc.invalidateQueries({ queryKey: ["alert-notifications"] });
    },
  });

  return {
    items,
    unread: items.filter((i) => !i.notification.read).length,
    isLoading: list.isLoading || alerts.isLoading,
    markRead,
    markAllRead,
    acknowledge,
  };
}
