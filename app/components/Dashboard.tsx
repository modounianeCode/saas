"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { useTransactions } from "@/lib/useTransactions";
import { currentMonth, type TransactionInput } from "@/lib/types";
import Summary from "./Summary";
import TransactionForm from "./TransactionForm";
import TransactionList from "./TransactionList";
import SavingsGoals from "./SavingsGoals";

export default function Dashboard() {
  const router = useRouter();
  const { client, userId, fullName, signOut } = useAuth();
  const { transactions, openingBalance, add, remove, saveOpeningBalance } = useTransactions(client, userId);

  const month = useMemo(() => currentMonth(), []);
  const [balanceDraft, setBalanceDraft] = useState("");
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Le champ est contrôlé : à l'arrivée des données serveur (ou du cache),
  // il reflète la vraie valeur au lieu de rester bloqué sur 0.
  useEffect(() => {
    setBalanceDraft(String(openingBalance));
  }, [openingBalance]);

  const thisMonth = transactions.filter(t => t.occurred_on.startsWith(month));
  const income = thisMonth.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const expenses = thisMonth.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const balance = openingBalance + transactions.reduce((sum, t) => sum + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);

  if (!userId) {
    return (
      <main className="app-shell state-screen">
        <p>Chargement de votre espace…</p>
      </main>
    );
  }

  async function commitOpeningBalance() {
    const error = await saveOpeningBalance(balanceDraft);
    if (error) {
      setBalanceError(error);
      setBalanceDraft(String(openingBalance));
      return;
    }
    setBalanceError(null);
  }

  return (
    <main className="app-shell">
      <header>
        <div className="brand"><span>✦</span> Argent Clair</div>
        <button
          className="logout"
          onClick={() => { void signOut().then(() => router.push("/login")); }}
        >
          Déconnexion
        </button>
      </header>

      <section className="welcome">
        <div>
          <p>Assalaamu alaykum{fullName ? `, ${fullName}` : ""} 👋</p>
          <h1>Voici votre situation.</h1>
        </div>
        <label className="opening">
          Solde initial
          <input
            type="number"
            min="0"
            step="1"
            value={balanceDraft}
            onChange={e => setBalanceDraft(e.target.value)}
            onBlur={() => { void commitOpeningBalance(); }}
            onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
          />
          {balanceError && <span className="form-error">{balanceError}</span>}
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

      {userId && <SavingsGoals client={client} userId={userId} />}
    </main>
  );
}
