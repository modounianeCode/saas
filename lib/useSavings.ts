"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SavingsGoal } from "./types";
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

    const goal: SavingsGoal = {
      id: `local-${Date.now()}`,
      name: name.trim(),
      target_amount: target,
      current_amount: 0,
      created_at: new Date().toISOString(),
    };
    updateLocal(prev => [...prev, goal]);

    const { error } = await client.from("savings_goals").insert({
      user_id: userId,
      name: goal.name,
      target_amount: target,
    });
    if (error) {
      await enqueueOp("insert_goal", { name: goal.name, target_amount: target });
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

  async function adjustOfflineOrNetwork(goal: SavingsGoal, delta: number) {
    const next = goal.current_amount + delta;
    if (next < 0) return "Le retrait ne peut pas dépasser le montant épargné.";
    applyAdjustment(goal, Math.max(0, next));
    const { error } = await client
      .from("savings_goals")
      .update({ current_amount: Math.max(0, next) })
      .eq("id", goal.id);
    if (error) {
      await enqueueOp("adjust_goal", { goal_id: goal.id, delta });
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

  async function remove(id: string) {
    updateLocal(prev => prev.filter(g => g.id !== id));
    const { error } = await client.from("savings_goals").delete().eq("id", id);
    if (error) {
      await enqueueOp("delete_goal", { id });
      return;
    }
    await refresh();
  }

  return { goals, create, deposit, withdraw, remove };
}