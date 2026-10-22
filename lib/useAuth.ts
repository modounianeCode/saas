"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { cacheGet, cacheSet, purgeUserCache } from "./offlineSync";

const SESSION_KEY = "session_user";

/** Signale aux autres modules (OfflineProvider) que l'identité locale est
 *  disponible : ils peuvent alors rejouer la file d'attente. */
function notifySessionReady() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("app:session-ready"));
}

export function useAuth() {
  const client = supabase();
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { data } = await client.auth.getUser();
        if (cancelled) return;
        if (data.user) {
          setUserId(data.user.id);
          const name = data.user.user_metadata?.full_name ?? null;
          setFullName(name);
          await cacheSet(SESSION_KEY, { id: data.user.id, full_name: name });
          notifySessionReady();
          return;
        }
      } catch {
        // Hors ligne : on retombe sur la session mise en cache.
      }
      const cached = await cacheGet<{ id?: string; full_name?: string | null }>(SESSION_KEY);
      if (!cancelled) {
        if (cached?.id) {
          setUserId(cached.id);
          notifySessionReady();
        }
        setFullName(cached?.full_name ?? null);
      }
    }

    init();

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id ?? null;
      setUserId(id);
      const name = session?.user.user_metadata?.full_name ?? null;
      setFullName(name);
      void cacheSet(SESSION_KEY, id ? { id, full_name: name } : null);
      if (id) notifySessionReady();
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [client]);

  const signOut = useCallback(async () => {
    try {
      await client.auth.signOut();
    } catch {
      // Hors ligne : supabase-js efface quand même la session locale.
    }
    await cacheSet(SESSION_KEY, null);
    if (userId) await purgeUserCache(userId);
    setUserId(null);
    setFullName(null);
  }, [client, userId]);

  return { client, userId, fullName, signOut };
}
