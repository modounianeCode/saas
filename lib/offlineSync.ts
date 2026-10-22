"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  kvGet,
  kvSet,
  kvDelete,
  outboxAdd,
  outboxAll,
  outboxCount,
  outboxRemove,
  type OutboxOp,
} from "./db";

export { outboxCount };

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  return kvGet<T>(key);
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  await kvSet(key, value);
}

/** Efface les données locales d'un utilisateur (déconnexion sur appareil
 *  partagé). La file d'attente, elle, est conservée : elle est étiquetée par
 *  utilisateur et sera rejouée à sa prochaine connexion. */
export async function purgeUserCache(userId: string): Promise<void> {
  await Promise.all([
    kvDelete(`transactions:${userId}`),
    kvDelete(`goals:${userId}`),
    kvDelete(`profile:${userId}`),
  ]);

  // Les pages HTML mises en cache par le service worker contiennent des
  // données financières : on les efface aussi à la déconnexion.
  if (typeof caches !== "undefined") {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith("argent-clair-")).map(key => caches.delete(key)));
    } catch {
      // Cache Storage indisponible : rien à purger.
    }
  }
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
      throw new PermanentSyncError(`Opération hors ligne inconnue : ${op.type}`);
  }
}

type PostgrestLikeError = {
  status?: number;
  code?: string;
  message?: string;
  permanent?: boolean;
};

/** Erreur d'une opération qui ne pourra jamais aboutir (type inconnu, bug). */
export class PermanentSyncError extends Error {
  readonly permanent = true;
}

/** Une erreur est transitoire (réseau, 5xx, quota) si elle peut réussir plus
 *  tard. Les erreurs définitives (4xx de validation, violation de contrainte,
 *  RLS) ne réussiront jamais : les conserver bloquerait la file pour toujours. */
export function isTransientError(error: unknown): boolean {
  const err = (error ?? {}) as PostgrestLikeError;
  if (err.permanent) return false;
  if (typeof err.status === "number") {
    // 408 (timeout) et 429 (trop de requêtes) sont temporaires.
    if (err.status === 408 || err.status === 429) return true;
    if (err.status >= 400 && err.status < 500) return false;
    if (err.status >= 500) return true;
    // status 0 = échec réseau côté supabase-js.
    return true;
  }
  // Violation de contrainte / exception de données / droits : définitif.
  if (err.code && /^(22|23|42|28)/.test(err.code)) return false;
  // Pas de statut ni de code SQL : probablement un échec réseau.
  return true;
}

export async function enqueueOp(type: string, payload: Record<string, unknown>, userId: string): Promise<void> {
  await outboxAdd({ type, payload, userId });
  notifyOutboxChanged();
}

// Verrou simple en mémoire (protège les appels concurrents du même onglet).
// La sûreté inter-onglets est assurée par l'idempotence côté serveur
// (client_id unique + op_id journalisé), un double rejeu reste inoffensif.
let isSyncing = false;

export type SyncResult = { synced: number; pending: number };

export async function syncNow(client: SupabaseClient): Promise<SyncResult> {
  if (isSyncing) return { synced: 0, pending: await outboxCount((await currentUserId()) ?? null) };
  isSyncing = true;
  try {
    const userId = await currentUserId();
    if (!userId) return { synced: 0, pending: 0 };

    const ops = await outboxAll();
    let synced = 0;
    for (const op of ops) {
      // Opération d'un autre compte encore présent sur l'appareil : on ne la
      // rejoue surtout pas avec l'identité courante.
      if (op.userId && op.userId !== userId) continue;
      try {
        await replay(client, userId, op);
        if (op.id) await outboxRemove(op.id);
        synced += 1;
      } catch (error) {
        if (isTransientError(error)) break; // on retentera plus tard
        // Erreur définitive : l'opération ne réussira jamais, on la retire
        // pour ne pas bloquer les suivantes.
        console.warn(`[outbox] opération « ${op.type} » abandonnée`, error);
        if (op.id) await outboxRemove(op.id);
      }
    }
    notifyOutboxChanged();
    return { synced, pending: await outboxCount(userId) };
  } finally {
    isSyncing = false;
  }
}

async function currentUserId(): Promise<string | null> {
  const session = await cacheGet<{ id?: string }>("session_user");
  return session?.id ?? null;
}
