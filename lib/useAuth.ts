"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { cacheGet, cacheSet } from "./offlineSync";

const SESSION_KEY = "session_user";

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
          return;
        }
      } catch {
        // Hors ligne : on retombe sur la session mise en cache.
      }
      const cached = await cacheGet<{ id?: string; full_name?: string | null }>(SESSION_KEY);
      if (!cancelled) {
        if (cached?.id) setUserId(cached.id);
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
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [client]);

  return { client, userId, fullName };
}