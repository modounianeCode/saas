"use client";

import { useEffect, useMemo, useState } from "react";
import { currentMonth, money, type Transaction, type TransactionInput } from "@/lib/types";
import TransactionEditor from "./TransactionEditor";

const PAGE = 20;

function formatMonth(value: string): string {
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" })
    .format(new Date(`${value}-01T00:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

type Props = {
  transactions: Transaction[];
  period: string;
  onPeriodChange: (period: string) => void;
  onRemove: (transaction: Transaction) => void;
  onUpdate: (clientId: string, input: TransactionInput) => Promise<string | null>;
};

export default function TransactionList({
  transactions,
  period,
  onPeriodChange,
  onRemove,
  onUpdate,
}: Props) {
  const [type, setType] = useState<"all" | "income" | "expense">("all");
  const [category, setCategory] = useState("all");
  const [visible, setVisible] = useState(PAGE);
  const [editing, setEditing] = useState<string | null>(null);

  const months = useMemo(() => {
    const set = new Set(transactions.map(t => t.occurred_on.slice(0, 7)));
    set.add(currentMonth());
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const categories = useMemo(
    () => Array.from(new Set(transactions.map(t => t.category)))
      .sort((a, b) => a.localeCompare(b, "fr")),
    [transactions]
  );

  // La catégorie sélectionnée reste proposée même si les filtres courants la
  // font disparaître de la liste.
  const categoryOptions = category === "all" || categories.includes(category)
    ? categories
    : [category, ...categories];

  // Idem pour le mois : une période peut ne plus contenir de transaction.
  const monthOptions = period === "all" || months.includes(period)
    ? months
    : [period, ...months].sort().reverse();

  const filtered = useMemo(
    () => transactions.filter(t =>
      (period === "all" || t.occurred_on.startsWith(period)) &&
      (type === "all" || t.type === type) &&
      (category === "all" || t.category === category)
    ),
    [transactions, period, type, category]
  );

  useEffect(() => {
    setVisible(PAGE);
  }, [period, type, category]);

  return (
    <>
      <div className="history-head">
        <h2>Historique</h2>
        <span className="history-count">
          {filtered.length} opération{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="filters">
        <select
          aria-label="Mois"
          value={period}
          onChange={e => onPeriodChange(e.target.value)}
        >
          <option value="all">Tous les mois</option>
          {monthOptions.map(month => (
            <option key={month} value={month}>{formatMonth(month)}</option>
          ))}
        </select>
        <select
          aria-label="Type"
          value={type}
          onChange={e => setType(e.target.value as "all" | "income" | "expense")}
        >
          <option value="all">Tous les types</option>
          <option value="income">Revenus</option>
          <option value="expense">Dépenses</option>
        </select>
        <select
          aria-label="Catégorie"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          <option value="all">Toutes les catégories</option>
          {categoryOptions.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="empty">Aucune transaction pour ces filtres.</p>
      ) : (
        <>
          {filtered.slice(0, visible).map(transaction =>
            editing === transaction.client_id ? (
              <TransactionEditor
                key={transaction.client_id}
                transaction={transaction}
                onSave={input => onUpdate(transaction.client_id, input)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="transaction" key={transaction.client_id}>
                <span className={`icon ${transaction.type}`}>{transaction.type === "income" ? "↗" : "↘"}</span>
                <div>
                  <b>{transaction.category}</b>
                  <small>{new Date(`${transaction.occurred_on}T00:00:00`).toLocaleDateString("fr-FR")}</small>
                </div>
                <strong className={transaction.type}>
                  {transaction.type === "income" ? "+" : "−"}{money.format(transaction.amount)}
                </strong>
                <div className="row-actions">
                  <button
                    type="button"
                    className="link"
                    onClick={() => setEditing(transaction.client_id)}
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="link danger"
                    aria-label="Supprimer"
                    onClick={() => onRemove(transaction)}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            )
          )}

          {filtered.length > visible && (
            <button
              type="button"
              className="load-more"
              onClick={() => setVisible(count => count + PAGE)}
            >
              Afficher plus ({filtered.length - visible} restantes)
            </button>
          )}
        </>
      )}
    </>
  );
}
