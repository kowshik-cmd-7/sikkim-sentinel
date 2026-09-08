import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Check, CheckCheck } from "lucide-react";
import { useNotifications, usePreferences } from "@/hooks/useAlertNotifications";
import { RiskBadge } from "@/components/common/RiskBadge";
import { renderAlertMessage } from "@/services/i18n";
import { formatDateTime } from "@/utils/risk";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { items, unread, markRead, markAllRead, acknowledge } = useNotifications();
  const prefs = usePreferences();
  const language = prefs.data?.language ?? "en";

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications (${unread} unread)`}
        className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] overflow-hidden rounded-lg border border-border bg-card shadow-xl sm:w-96">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Notification centre</p>
              <p className="text-[10px] uppercase tracking-widest text-amber-400">
                Demo data · mock notifications
              </p>
            </div>
            <button
              onClick={() => markAllRead.mutate()}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-accent"
            >
              <CheckCheck className="h-3 w-3" /> Mark all read
            </button>
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {items.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">
                No notifications match your alert preferences.
              </p>
            )}
            {items.map(({ notification, alert }) => {
              const msg = renderAlertMessage(alert, language);
              return (
                <div
                  key={notification.id}
                  className={`border-b border-border px-3 py-2.5 text-sm ${notification.read ? "opacity-70" : "bg-accent/30"}`}
                >
                  <div className="flex items-center gap-2">
                    <RiskBadge level={alert.severity} />
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(notification.receivedAt)}
                    </span>
                    {!notification.read && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-sky-400" />
                    )}
                  </div>
                  <p className="mt-1.5 font-medium leading-snug">{msg.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {msg.body}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <Link
                      to="/alerts/$alertId"
                      params={{ alertId: alert.id }}
                      onClick={() => {
                        markRead.mutate(notification.id);
                        setOpen(false);
                      }}
                      className="rounded-md border border-border px-2 py-1 hover:bg-accent"
                    >
                      View detail
                    </Link>
                    {!notification.read && (
                      <button
                        onClick={() => markRead.mutate(notification.id)}
                        className="rounded-md border border-border px-2 py-1 hover:bg-accent"
                      >
                        Mark read
                      </button>
                    )}
                    {!notification.acknowledged && (
                      <button
                        onClick={() => acknowledge.mutate(alert.id)}
                        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-accent"
                      >
                        <Check className="h-3 w-3" /> Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Link
            to="/alerts"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-3 py-2 text-center text-xs text-sky-300 hover:bg-accent"
          >
            Open the alerts page
          </Link>
        </div>
      )}
    </div>
  );
}
