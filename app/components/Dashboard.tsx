"use client";

import { useMemo } from "react";
import { useAuth } from "@/lib/useAuth";
import { useTransactions } from "@/lib/useTransactions";
import type { TransactionInput } from "@/lib/types";
import Summary from "./Summary";
import TransactionForm from "./TransactionForm";
import TransactionList from "./TransactionList";

export default function Dashboard() {
  const { client, userId } = useAuth();
  const { transactions, openingBalance, add, remove, saveOpeningBalance } = useTransactions(client, userId ?? "");

  const month = useMemo(() => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const currentMonth = startOfMonth.toISOString().slice(0, 7);
    return currentMonth;
  }, []);

  const thisMonth = transactions.filter(t => t.occurred_on.startsWith(month));
  const income = thisMonth.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const expenses = thisMonth.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const balance = openingBalance + transactions.reduce((sum, t) => sum + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);

  if (!userId) return null;

  return (
    <main className="app-shell">
      <header>
        <div className="brand"><span>✦</span> Argent Clair</div>
        <button className="logout" onClick={() => client.auth.signOut()}>Déconnexion</button>
      </header>

      <section className="welcome">
        <div>
          <p>Bonjour 👋</p>
          <h1>Voici votre situation.</h1>
        </div>
        <label className="opening">
          Solde initial
          <input
            type="number"
            defaultValue={openingBalance}
            onBlur={e => saveOpeningBalance(e.target.value)}
          />
        </label>
      </section>

      <Summary balance={balance} income={income} expenses={expenses} />

      <section className="content-grid">
        <article className="panel">
          <h2>Ajouter une transaction</h2>
          <TransactionForm onAdd={(input: TransactionInput) => add(input)} />
        </article>
        <article className="panel transactions">
          <h2>Dernières transactions</h2>
          <TransactionList transactions={transactions} onRemove={id => remove(id)} />
        </article>
      </section>
    </main>
  );
}