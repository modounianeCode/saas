"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SavingsGoal } from "./types";
import { validateAmount, validateName, validateWithdrawal } from "./validation";

export function useSavings(client: SupabaseClient, userId: string) {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);

  const load = useCallback(async () => {
    const { data } = await client
      .from("savings_goals")
      .select("*")
      .order("created_at", { ascending: true });
    setGoals((data ?? []) as SavingsGoal[]);
  }, [client]);

  useEffect(() => {
    load();
  }, [load]);

  async function create(name: string, targetRaw: string): Promise<string | null> {
    const nameError = validateName(name);
    if (nameError) return nameError;
    const targetError = validateAmount(targetRaw);
    if (targetError) return targetError;
    const { error } = await client.from("savings_goals").insert({
      user_id: userId,
      name: name.trim(),
      target_amount: Math.round(Number(targetRaw)),
    });
    if (error) return error.message;
    await load();
    return null;
  }

  async function adjust(goal: SavingsGoal, delta: number): Promise<string | null> {
    const next = goal.current_amount + delta;
    if (next < 0) return "Le retrait ne peut pas dépasser le montant épargné.";
    const { error } = await client
      .from("savings_goals")
      .update({ current_amount: next })
      .eq("id", goal.id);
    if (error) return error.message;
    await load();
    return null;
  }

  async function deposit(goal: SavingsGoal, amountRaw: string): Promise<string | null> {
    const amountError = validateAmount(amountRaw);
    if (amountError) return amountError;
    return adjust(goal, Math.round(Number(amountRaw)));
  }

  async function withdraw(goal: SavingsGoal, amountRaw: string): Promise<string | null> {
    const amountError = validateAmount(amountRaw);
    if (amountError) return amountError;
    const amount = Math.round(Number(amountRaw));
    const check = validateWithdrawal(amount, goal.current_amount);
    if (check) return check;
    return adjust(goal, -amount);
  }

  async function remove(id: string) {
    const { error } = await client.from("savings_goals").delete().eq("id", id);
    if (!error) await load();
  }

  return { goals, create, deposit, withdraw, remove };
}