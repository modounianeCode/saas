import { money, type Transaction } from "@/lib/types";

type Props = {
  transactions: Transaction[];
  onRemove: (id: string) => void;
};

export default function TransactionList({ transactions, onRemove }: Props) {
  if (transactions.length === 0) {
    return <p className="empty">Aucune transaction pour le moment.</p>;
  }

  return (
    <>
      {transactions.slice(0, 8).map(t => (
        <div className="transaction" key={t.id}>
          <span className={`icon ${t.type}`}>{t.type === "income" ? "↗" : "↘"}</span>
          <div>
            <b>{t.category}</b>
            <small>{new Date(`${t.occurred_on}T00:00:00`).toLocaleDateString("fr-FR")}</small>
          </div>
          <strong className={t.type}>{t.type === "income" ? "+" : "−"}{money.format(t.amount)}</strong>
          <button
            aria-label="Supprimer"
            onClick={() => { if (confirm("Supprimer cette transaction ?")) onRemove(t.id); }}
          >
            ×
          </button>
        </div>
      ))}
    </>
  );
}