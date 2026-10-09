"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Transaction, TransactionInput } from "./types";
import { validateAmount } from "./validation";
import { cacheGet, cacheSet, enqueueOp } from "./offlineSync";

const txsKey = (userId: string) => `transactions:${userId}`;
const profileKey = (userId: string) => `profile:${userId}`;

export function useTransactions(client: SupabaseClient, userId: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [{ data: items, error: itemsError }, { data: profile, error: profileError }] = await Promise.all([
        client
          .from("transactions")
          .select("id,type,amount,category,occurred_on")
          .order("occurred_on", { ascending: false }),
        client.from("profiles").select("opening_balance").eq("id", userId).maybeSingle(),
      ]);
      if (itemsError || profileError) throw itemsError ?? profileError;
      const list = (items ?? []) as Transaction[];
      const balance = Number(profile?.opening_balance ?? 0);
      setTransactions(list);
      setOpeningBalance(balance);
      await Promise.all([cacheSet(txsKey(userId), list), cacheSet(profileKey(userId), balance)]);
    } catch {
      const cached = await cacheGet<Transaction[]>(txsKey(userId));
      if (cached) setTransactions(cached);
      const cachedBalance = await cacheGet<number>(profileKey(userId));
      if (typeof cachedBalance === "number") setOpeningBalance(cachedBalance);
    }
  }, [client, userId]);

  useEffect(() => {
    refresh();
    const onSyncDone = () => refresh();
    window.addEventListener("app:sync-done", onSyncDone);
    return () => window.removeEventListener("app:sync-done", onSyncDone);
  }, [refresh]);

  function updateLocal(next: (prev: Transaction[]) => Transaction[]) {
    setTransactions(prev => {
      const updated = next(prev);
      void cacheSet(txsKey(userId), updated);
      return updated;
    });
  }

  async function add(input: TransactionInput): Promise<string | null> {
    const amountError = validateAmount(input.amount);
    if (amountError) return amountError;

    const transaction: Transaction = {
      id: `local-${Date.now()}`,
      type: input.type,
      amount: Math.round(Number(input.amount)),
      category: input.category,
      occurred_on: input.occurred_on,
    };
    updateLocal(prev => [transaction, ...prev]);

    const { error } = await client.from("transactions").insert({
      user_id: userId,
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      occurred_on: transaction.occurred_on,
    });
    if (error) {
      await enqueueOp("insert_transaction", {
        type: transaction.type,
        amount: transaction.amount,
        category: transaction.category,
        occurred_on: transaction.occurred_on,
      });
      return null;
    }
    await refresh();
    return null;
  }

  async function remove(id: string) {
    updateLocal(prev => prev.filter(t => t.id !== id));
    const { error } = await client.from("transactions").delete().eq("id", id);
    if (error) {
      await enqueueOp("delete_transaction", { id });
      return;
    }
    await refresh();
  }

  async function saveOpeningBalance(value: string): Promise<void> {
    const next = Math.round(Number(value || 0));
    if (!Number.isFinite(next)) return;
    setOpeningBalance(next);
    void cacheSet(profileKey(userId), next);
    const { error } = await client.from("profiles").upsert({ id: userId, opening_balance: next });
    if (error) await enqueueOp("update_profile", { opening_balance: next });
  }

  return { transactions, openingBalance, add, remove, saveOpeningBalance };
}