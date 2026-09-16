"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Transaction, TransactionInput } from "./types";
import { validateAmount } from "./validation";

export function useTransactions(client: SupabaseClient, userId: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);

  const load = useCallback(async () => {
    const [{ data: items }, { data: profile }] = await Promise.all([
      client
        .from("transactions")
        .select("id,type,amount,category,occurred_on")
        .order("occurred_on", { ascending: false }),
      client.from("profiles").select("opening_balance").eq("id", userId).maybeSingle(),
    ]);
    setTransactions((items ?? []) as Transaction[]);
    setOpeningBalance(Number(profile?.opening_balance ?? 0));
  }, [client, userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(input: TransactionInput): Promise<string | null> {
    const amountError = validateAmount(input.amount);
    if (amountError) return amountError;
    const { error } = await client.from("transactions").insert({
      user_id: userId,
      type: input.type,
      amount: Math.round(Number(input.amount)),
      category: input.category,
      occurred_on: input.occurred_on,
    });
    if (error) return error.message;
    await load();
    return null;
  }

  async function remove(id: string) {
    const { error } = await client.from("transactions").delete().eq("id", id);
    if (!error) await load();
  }

  async function saveOpeningBalance(value: string): Promise<void> {
    const next = Math.round(Number(value || 0));
    if (!Number.isFinite(next)) return;
    await client.from("profiles").upsert({ id: userId, opening_balance: next });
    setOpeningBalance(next);
  }

  return { transactions, openingBalance, add, remove, saveOpeningBalance };
}