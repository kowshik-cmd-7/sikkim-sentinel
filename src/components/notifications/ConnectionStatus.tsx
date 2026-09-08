import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useConnection } from "@/hooks/useConnection";

export function ConnectionStatus({ compact = false }: { compact?: boolean }) {
  const { state } = useConnection();

  const map = {
    online: {
      icon: Cloud,
      label: "ONLINE",
      className: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
      hint: "Connected to the mock alert service.",
    },
    syncing: {
      icon: RefreshCw,
      label: "SYNCING",
      className: "text-sky-300 border-sky-500/40 bg-sky-500/10",
      hint: "Fetching the latest demo alerts.",
    },
    offline: {
      icon: CloudOff,
      label: "OFFLINE",
      className: "text-amber-300 border-amber-500/40 bg-amber-500/10",
      hint: "No network. Only alerts already loaded in this session are shown; nothing new can be fetched and no offline cache is stored.",
    },
  }[state];

  const Icon = map.icon;

  return (
    <span
      title={map.hint}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-widest ${map.className}`}
    >
      <Icon className={`h-3 w-3 ${state === "syncing" ? "animate-spin" : ""}`} />
      {compact ? null : map.label}
    </span>
  );
}
