"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export function useAuth() {
  const client = supabase();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    client.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, [client]);

  return { client, userId };
}