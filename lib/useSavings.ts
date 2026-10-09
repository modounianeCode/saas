"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SavingsGoal } from "./types";
import { newClientId } from "./types";
import { validateAmount, validateName, validateWithdrawal } from "./validation";
import { cacheGet, cacheSet, enqueueOp } from "./offlineSync";

const goalsKey = (userId: string) => `goals:${userId}`;

export function useSavings(client: SupabaseClient, userId: string) {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await client
        .from("savings_goals")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const list = (data ?? []) as SavingsGoal[];
      setGoals(list);
      await cacheSet(goalsKey(userId), list);
    } catch {
      const cached = await cacheGet<SavingsGoal[]>(goalsKey(userId));
      if (cached) setGoals(cached);
    }
  }, [client, userId]);

  useEffect(() => {
    refresh();
    const onSyncDone = () => refresh();
    window.addEventListener("app:sync-done", onSyncDone);
    return () => window.removeEventListener("app:sync-done", onSyncDone);
  }, [refresh]);

  function updateLocal(next: (prev: SavingsGoal[]) => SavingsGoal[]) {
    setGoals(prev => {
      const updated = next(prev);
      void cacheSet(goalsKey(userId), updated);
      return updated;
    });
  }

  async function create(name: string, targetRaw: string): Promise<string | null> {
    const nameError = validateName(name);
    if (nameError) return nameError;
    const targetError = validateAmount(targetRaw);
    if (targetError) return targetError;
    const target = Math.round(Number(targetRaw));

    const clientId = newClientId();
    const goal: SavingsGoal = {
      id: clientId,
      client_id: clientId,
      name: name.trim(),
      target_amount: target,
      current_amount: 0,
      created_at: new Date().toISOString(),
    };
    updateLocal(prev => [...prev, goal]);

    const { error } = await client.from("savings_goals").insert({
      client_id: clientId,
      user_id: userId,
      name: goal.name,
      target_amount: target,
    });
    if (error) {
      await enqueueOp("insert_goal", { client_id: clientId, name: goal.name, target_amount: target });
      return null;
    }
    await refresh();
    return null;
  }

  function applyAdjustment(goal: SavingsGoal, nextAmount: number) {
    updateLocal(prev =>
      prev.map(g => (g.id === goal.id ? { ...g, current_amount: nextAmount } : g))
    );
  }

  async function adjustOfflineOrNetwork(goal: SavingsGoal, delta: number): Promise<string | null> {
    const next = goal.current_amount + delta;
    if (next < 0) return "Le retrait ne peut pas dépasser le montant épargné.";
    applyAdjustment(goal, Math.max(0, next));

    // Même op_id pour la tentative réseau et l'éventuel rejeu : la RPC
    // `adjust_goal` est idempotente, un double appel est inoffensif.
    const opId = newClientId();
    const { error } = await client.rpc("adjust_goal", {
      p_client_id: goal.client_id,
      p_delta: delta,
      p_op_id: opId,
    });
    if (error) {
      await enqueueOp("adjust_goal", { goal_client_id: goal.client_id, delta, op_id: opId });
      return null;
    }
    await refresh();
    return null;
  }

  async function deposit(goal: SavingsGoal, amountRaw: string): Promise<string | null> {
    const amountError = validateAmount(amountRaw);
    if (amountError) return amountError;
    const amount = Math.round(Number(amountRaw));
    return adjustOfflineOrNetwork(goal, amount);
  }

  async function withdraw(goal: SavingsGoal, amountRaw: string): Promise<string | null> {
    const amountError = validateAmount(amountRaw);
    if (amountError) return amountError;
    const amount = Math.round(Number(amountRaw));
    const check = validateWithdrawal(amount, goal.current_amount);
    if (check) return check;
    return adjustOfflineOrNetwork(goal, -amount);
  }

  async function remove(clientId: string) {
    updateLocal(prev => prev.filter(g => g.client_id !== clientId));
    const { error } = await client.from("savings_goals").delete().eq("client_id", clientId);
    if (error) {
      await enqueueOp("delete_goal", { client_id: clientId });
      return;
    }
    await refresh();
  }

  return { goals, create, deposit, withdraw, remove };
}