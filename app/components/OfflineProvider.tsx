"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useOnline } from "@/lib/useOnline";
import { cacheGet, outboxCount, syncNow } from "@/lib/offlineSync";

const RETRY_INTERVAL_MS = 30_000;

export default function OfflineProvider({ children }: { children: React.ReactNode }) {
  const client = supabase();
  const online = useOnline();
  const [pending, setPending] = useState(0);

  const refreshPending = useCallback(async () => {
    const session = await cacheGet<{ id?: string }>("session_user");
    setPending(session?.id ? await outboxCount(session.id) : 0);
  }, []);

  const runSync = useCallback(async () => {
    const result = await syncNow(client);
    await refreshPending();
    if (result.synced > 0) window.dispatchEvent(new Event("app:sync-done"));
  }, [client, refreshPending]);

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
    void runSync();
  }, [online, runSync]);

  // `useAuth` publie l'identité locale (serveur ou cache) dès qu'elle est
  // connue : c'est le bon moment pour rejouer une file laissée en attente.
  useEffect(() => {
    const onSessionReady = () => { void runSync(); };
    window.addEventListener("app:session-ready", onSessionReady);
    return () => window.removeEventListener("app:session-ready", onSessionReady);
  }, [runSync]);

  // Filet de sécurité : une opération qui a échoué pour une raison
  // transitoire (réseau instable, 5xx) est retentée régulièrement, sans
  // attendre un rechargement de la page.
  useEffect(() => {
    if (!online) return;
    const timer = setInterval(() => { void runSync(); }, RETRY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [online, runSync]);

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
          <button type="button" onClick={() => { void runSync(); }}>Réessayer</button>
        </div>
      )}
      {children}
    </>
  );
}
