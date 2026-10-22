import { FormEvent, useState } from "react";
import {
  expenseCategories,
  incomeCategories,
  today,
  type Transaction,
  type TransactionInput,
} from "@/lib/types";

type Props = {
  transaction: Transaction;
  onSave: (input: TransactionInput) => Promise<string | null>;
  onCancel: () => void;
};

export default function TransactionEditor({ transaction, onSave, onCancel }: Props) {
  const [form, setForm] = useState<TransactionInput>({
    type: transaction.type,
    amount: String(transaction.amount),
    category: transaction.category,
    occurred_on: transaction.occurred_on || today(),
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const categories = form.type === "income" ? incomeCategories : expenseCategories;
  const knownCategories = categories.includes(form.category)
    ? categories
    : [form.category, ...categories];

  function switchType(type: "income" | "expense") {
    setForm({ ...form, type, category: type === "income" ? incomeCategories[0] : expenseCategories[0] });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const message = await onSave(form);
    setBusy(false);
    if (message) return setError(message);
    onCancel();
  }

  return (
    <form className="edit-form" onSubmit={submit} noValidate>
      <div className="type-switch edit-type">
        <button
          type="button"
          className={form.type === "expense" ? "active expense-btn" : ""}
          onClick={() => switchType("expense")}
        >
          Dépense
        </button>
        <button
          type="button"
          className={form.type === "income" ? "active income-btn" : ""}
          onClick={() => switchType("income")}
        >
          Revenu
        </button>
      </div>
      <input
        aria-label="Montant"
        type="number"
        min="1"
        step="1"
        value={form.amount}
        onChange={e => setForm({ ...form, amount: e.target.value })}
        required
      />
      <select
        aria-label="Catégorie"
        value={form.category}
        onChange={e => setForm({ ...form, category: e.target.value })}
      >
        {knownCategories.map(c => <option key={c}>{c}</option>)}
      </select>
      <input
        aria-label="Date"
        type="date"
        value={form.occurred_on}
        onChange={e => setForm({ ...form, occurred_on: e.target.value })}
        required
      />
      <div className="edit-actions">
        <button type="button" className="ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" disabled={busy}>{busy ? "…" : "Enregistrer"}</button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
