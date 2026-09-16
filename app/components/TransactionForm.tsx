import { FormEvent, useState } from "react";
import { expenseCategories, incomeCategories, today, type TransactionInput } from "@/lib/types";

type Props = {
  onAdd: (input: TransactionInput) => Promise<string | null>;
};

export default function TransactionForm({ onAdd }: Props) {
  const [form, setForm] = useState<TransactionInput>({
    type: "expense",
    amount: "",
    category: expenseCategories[0],
    occurred_on: today(),
  });
  const [error, setError] = useState<string | null>(null);

  const categories = form.type === "income" ? incomeCategories : expenseCategories;

  function switchType(type: "income" | "expense") {
    setForm({ ...form, type, category: type === "income" ? incomeCategories[0] : expenseCategories[0] });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = await onAdd(form);
    if (message) return setError(message);
    setError(null);
    setForm({ type: "expense", amount: "", category: expenseCategories[0], occurred_on: today() });
  }

  return (
    <form className="transaction-form" onSubmit={submit} noValidate>
      <div className="type-switch">
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
        type="number"
        min="1"
        step="1"
        placeholder="Montant (FCFA)"
        value={form.amount}
        onChange={e => setForm({ ...form, amount: e.target.value })}
        required
      />
      <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
        {categories.map(c => <option key={c}>{c}</option>)}
      </select>
      <input
        type="date"
        value={form.occurred_on}
        onChange={e => setForm({ ...form, occurred_on: e.target.value })}
        required
      />
      <button>Ajouter la transaction</button>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}