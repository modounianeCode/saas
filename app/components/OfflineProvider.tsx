"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useOnline } from "@/lib/useOnline";
import { outboxCount, syncNow } from "@/lib/offlineSync";

export default function OfflineProvider({ children }: { children: React.ReactNode }) {
  const client = supabase();
  const online = useOnline();
  const [pending, setPending] = useState(0);

  const refreshPending = useCallback(async () => {
    setPending(await outboxCount());
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    refreshPending();
    window.addEventListener("app:outbox-changed", refreshPending);
    return () => window.removeEventListener("app:outbox-changed", refreshPending);
  }, [refreshPending]);

  useEffect(() => {
    if (!online) return;
    void (async () => {
      const result = await syncNow(client);
      await refreshPending();
      if (result.synced > 0) window.dispatchEvent(new Event("app:sync-done"));
    })();
  }, [online, client, refreshPending]);

  return (
    <>
      {!online && (
        <div className="offline-banner" role="status">
          Hors ligne — les modifications seront synchronisées au retour du réseau.
        </div>
      )}
      {online && pending > 0 && (
        <div className="sync-note" role="status">
          {pending} modification{pending > 1 ? "s" : ""} à synchroniser…
        </div>
      )}
      {children}
    </>
  );
}