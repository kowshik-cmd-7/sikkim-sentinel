import { useEffect, useState } from "react";
import { useIsFetching } from "@tanstack/react-query";
import type { ConnectionState } from "@/types/alerts";

/**
 * Reports browser connectivity plus in-flight fetch state.
 * Offline behaviour is honest: React Query keeps already-fetched alerts in
 * memory for this session, so offline shows the last loaded list only —
 * there is no persistent offline cache in this prototype.
 */
export function useConnection(): { state: ConnectionState; online: boolean } {
  const [online, setOnline] = useState(true);
  const fetching = useIsFetching();

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const state: ConnectionState = !online ? "offline" : fetching > 0 ? "syncing" : "online";
  return { state, online };
}
