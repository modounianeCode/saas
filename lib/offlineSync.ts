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
    // Les inserts sont rejoués en upsert ignoreDuplicates : si l'opération
    // réseau initiale avait en réalité réussi (réponse perdue), le double
    // rejeu est inoffensif grâce à l'unicité de client_id.
    case "insert_transaction": {
      const { error } = await client
        .from("transactions")
        .upsert({ user_id: userId, ...op.payload }, { onConflict: "client_id", ignoreDuplicates: true });
      if (error) throw error;
      return;
    }
    case "delete_transaction": {
      const { error } = await client.from("transactions").delete().eq("client_id", String(op.payload.client_id));
      if (error) throw error;
      return;
    }
    case "insert_goal": {
      const { error } = await client
        .from("savings_goals")
        .upsert({ user_id: userId, ...op.payload }, { onConflict: "client_id", ignoreDuplicates: true });
      if (error) throw error;
      return;
    }
    case "adjust_goal": {
      // RPC atomique et idempotente côté SQL (delta + op_id journalisé).
      const { error } = await client.rpc("adjust_goal", {
        p_client_id: String(op.payload.goal_client_id),
        p_delta: Number(op.payload.delta),
        p_op_id: String(op.payload.op_id),
      });
      if (error) throw error;
      return;
    }
    case "delete_goal": {
      const { error } = await client.from("savings_goals").delete().eq("client_id", String(op.payload.client_id));
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

// Verrou simple : empêche deux syncNow simultanés (montage + event
// `online`, ou deux onglets du même module) de rejouer l'outbox en parallèle.
let isSyncing = false;

export async function syncNow(client: SupabaseClient): Promise<{ synced: number; pending: number }> {
  if (isSyncing) return { synced: 0, pending: await outboxCount() };
  isSyncing = true;
  try {
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
  } finally {
    isSyncing = false;
  }
}