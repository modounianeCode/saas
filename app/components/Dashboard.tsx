"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { useTransactions } from "@/lib/useTransactions";
import { currentMonth, type Transaction, type TransactionInput } from "@/lib/types";
import Summary from "./Summary";
import TransactionForm from "./TransactionForm";
import TransactionList from "./TransactionList";
import SavingsGoals from "./SavingsGoals";

const UNDO_DELAY_MS = 6000;

function periodLabel(period: string): string {
  if (period === "all") return "TOUS LES MOIS";
  if (period === currentMonth()) return "CE MOIS";
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" })
    .format(new Date(`${period}-01T00:00:00`));
  return label.toUpperCase();
}

export default function Dashboard() {
  const router = useRouter();
  const { client, userId, fullName, signOut } = useAuth();
  const { transactions, openingBalance, add, update, remove, restore, saveOpeningBalance } =
    useTransactions(client, userId);

  const [period, setPeriod] = useState(currentMonth());
  const [balanceDraft, setBalanceDraft] = useState("");
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [undo, setUndo] = useState<Transaction | null>(null);

  // Le champ est contrôlé : à l'arrivée des données serveur (ou du cache),
  // il reflète la vraie valeur au lieu de rester bloqué sur 0.
  useEffect(() => {
    setBalanceDraft(String(openingBalance));
  }, [openingBalance]);

  // La suppression est réversible pendant quelques secondes.
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_DELAY_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const periodTransactions = useMemo(
    () => (period === "all" ? transactions : transactions.filter(t => t.occurred_on.startsWith(period))),
    [transactions, period]
  );

  const income = periodTransactions.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const expenses = periodTransactions.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const balance = openingBalance + transactions.reduce((sum, t) => sum + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);
  const label = useMemo(() => periodLabel(period), [period]);

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

  async function handleAdd(input: TransactionInput): Promise<string | null> {
    const error = await add(input);
    // Si l'utilisateur consulte un autre mois, on bascule sur celui de la
    // transaction ajoutée pour qu'elle soit visible immédiatement.
    if (!error) setPeriod(input.occurred_on.slice(0, 7));
    return error;
  }

  function handleRemove(transaction: Transaction) {
    void remove(transaction.client_id);
    setUndo(transaction);
  }

  async function handleUndo() {
    if (!undo) return;
    const transaction = undo;
    setUndo(null);
    await restore(transaction);
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

      <Summary balance={balance} income={income} expenses={expenses} periodLabel={label} />

      <section className="content-grid">
        <article className="panel">
          <h2>Ajouter une transaction</h2>
          <TransactionForm onAdd={handleAdd} />
        </article>
        <article className="panel transactions">
          <TransactionList
            transactions={transactions}
            period={period}
            onPeriodChange={setPeriod}
            onRemove={handleRemove}
            onUpdate={update}
          />
        </article>
      </section>

      {userId && <SavingsGoals client={client} userId={userId} />}

      {undo && (
        <div className="undo-toast" role="status">
          Transaction supprimée.
          <button type="button" onClick={() => { void handleUndo(); }}>Annuler</button>
        </div>
      )}
    </main>
  );
}
