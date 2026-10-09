"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { kvGet, kvSet, outboxAdd, outboxAll, outboxCount, outboxRemove, type OutboxOp } from "./db";

export { outboxCount };

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  return kvGet<T>(key);
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  await kvSet(key, value);
}

export function notifyOutboxChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("app:outbox-changed"));
}

// Les appels Supabase ne lèvent jamais d'exception : les erreurs (réseau
// inclus) sont retournées dans `{ error }`. On les throw explicitement pour
// que `syncNow` sache qu'il faut conserver l'opération dans l'outbox.
async function replay(client: SupabaseClient, userId: string, op: OutboxOp): Promise<void> {
  switch (op.type) {
    case "insert_transaction": {
      const { error } = await client.from("transactions").insert({ user_id: userId, ...op.payload });
      if (error) throw error;
      return;
    }
    case "delete_transaction": {
      const { error } = await client.from("transactions").delete().eq("id", String(op.payload.id));
      if (error) throw error;
      return;
    }
    case "insert_goal": {
      const { error } = await client.from("savings_goals").insert({ user_id: userId, ...op.payload });
      if (error) throw error;
      return;
    }
    case "adjust_goal": {
      const { data, error: readError } = await client
        .from("savings_goals")
        .select("current_amount")
        .eq("id", String(op.payload.goal_id))
        .maybeSingle();
      if (readError) throw readError;
      const current = Math.max(0, Number(data?.current_amount ?? 0) + Number(op.payload.delta));
      const { error } = await client.from("savings_goals").update({ current_amount: current }).eq("id", String(op.payload.goal_id));
      if (error) throw error;
      return;
    }
    case "delete_goal": {
      const { error } = await client.from("savings_goals").delete().eq("id", String(op.payload.id));
      if (error) throw error;
      return;
    }
    case "update_profile": {
      const { error } = await client.from("profiles").upsert({ id: userId, opening_balance: Number(op.payload.opening_balance) });
      if (error) throw error;
      return;
    }
    default:
      throw new Error(`Opération hors ligne inconnue : ${op.type}`);
  }
}

export async function enqueueOp(type: string, payload: Record<string, unknown>): Promise<void> {
  await outboxAdd({ type, payload });
  notifyOutboxChanged();
}

export async function syncNow(client: SupabaseClient): Promise<{ synced: number; pending: number }> {
  const session = await cacheGet<{ id?: string }>("session_user");
  if (!session?.id) return { synced: 0, pending: await outboxCount() };

  const ops = await outboxAll();
  let synced = 0;
  for (const op of ops) {
    try {
      await replay(client, session.id, op);
      if (op.id) await outboxRemove(op.id);
      synced += 1;
    } catch {
      break;
    }
  }
  notifyOutboxChanged();
  return { synced, pending: await outboxCount() };
}