"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Transaction, TransactionInput } from "./types";
import { newClientId } from "./types";
import { validateAmount } from "./validation";
import { cacheGet, cacheSet, enqueueOp } from "./offlineSync";

const txsKey = (userId: string) => `transactions:${userId}`;
const profileKey = (userId: string) => `profile:${userId}`;
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

export function useTransactions(client: SupabaseClient, userId: string | null) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      // PostgREST plafonne à `max-rows` (1000 par défaut) : sans pagination,
      // les totaux seraient silencieusement faux au-delà.
      const items: Transaction[] = [];
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const from = page * PAGE_SIZE;
        const { data, error } = await client
          .from("transactions")
          .select("id,client_id,type,amount,category,occurred_on,created_at")
          .order("occurred_on", { ascending: false })
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const rows = (data ?? []) as Transaction[];
        items.push(...rows);
        if (rows.length < PAGE_SIZE) break;
      }

      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("opening_balance")
        .eq("id", userId)
        .maybeSingle();
      if (profileError) throw profileError;

      const balance = Number(profile?.opening_balance ?? 0);
      setTransactions(items);
      setOpeningBalance(balance);
      await Promise.all([cacheSet(txsKey(userId), items), cacheSet(profileKey(userId), balance)]);
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
    if (!userId) return;
    setTransactions(prev => {
      const updated = next(prev);
      void cacheSet(txsKey(userId), updated);
      return updated;
    });
  }

  async function add(input: TransactionInput): Promise<string | null> {
    if (!userId) return "Vous devez être connecté.";
    const amountError = validateAmount(input.amount);
    if (amountError) return amountError;

    const clientId = newClientId();
    const transaction: Transaction = {
      id: clientId,
      client_id: clientId,
      type: input.type,
      amount: Math.round(Number(input.amount)),
      category: input.category,
      occurred_on: input.occurred_on,
    };
    updateLocal(prev => [transaction, ...prev]);

    const { error } = await client.from("transactions").insert({
      client_id: clientId,
      user_id: userId,
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      occurred_on: transaction.occurred_on,
    });
    if (error) {
      await enqueueOp(
        "insert_transaction",
        {
          client_id: clientId,
          type: transaction.type,
          amount: transaction.amount,
          category: transaction.category,
          occurred_on: transaction.occurred_on,
        },
        userId
      );
      return null;
    }
    await refresh();
    return null;
  }

  async function remove(clientId: string) {
    if (!userId) return;
    updateLocal(prev => prev.filter(t => t.client_id !== clientId));
    const { error } = await client.from("transactions").delete().eq("client_id", clientId);
    if (error) {
      await enqueueOp("delete_transaction", { client_id: clientId }, userId);
      return;
    }
    await refresh();
  }

  async function saveOpeningBalance(value: string): Promise<string | null> {
    if (!userId) return "Vous devez être connecté.";
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
      return "Le solde initial doit être un nombre entier positif ou nul.";
    }

    setOpeningBalance(parsed);
    void cacheSet(profileKey(userId), parsed);
    const { error } = await client.from("profiles").upsert({ id: userId, opening_balance: parsed });
    if (error) await enqueueOp("update_profile", { opening_balance: parsed }, userId);
    return null;
  }

  return { transactions, openingBalance, add, remove, saveOpeningBalance };
}
