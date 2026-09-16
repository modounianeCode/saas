import { FormEvent, useState } from "react";
import { money, type SavingsGoal } from "@/lib/types";

type Props = {
  goal: SavingsGoal;
  onDeposit: (goal: SavingsGoal, amount: string) => Promise<string | null>;
  onWithdraw: (goal: SavingsGoal, amount: string) => Promise<string | null>;
  onRemove: (id: string) => void;
};

export default function SavingsGoalCard({ goal, onDeposit, onWithdraw, onRemove }: Props) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const progress = goal.target_amount > 0
    ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
    : 0;
  const done = goal.current_amount >= goal.target_amount;

  function submit(handler: (goal: SavingsGoal, amount: string) => Promise<string | null>) {
    return (event: FormEvent) => {
      event.preventDefault();
      void handler(goal, amount).then(message => {
        if (message) return setError(message);
        setError(null);
        setAmount("");
      });
    };
  }

  return (
    <article className={`goal${done ? " done" : ""}`}>
      <div className="goal-top">
        <div>
          <h3>{goal.name}</h3>
          <span className="goal-target">Objectif : {money.format(goal.target_amount)}</span>
        </div>
        <button
          className="link danger"
          onClick={() => { if (confirm(`Supprimer l'objectif « ${goal.name} » ?`)) onRemove(goal.id); }}
        >
          Supprimer
        </button>
      </div>

      <div className="progress">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="goal-meta">
        <span><b>{money.format(goal.current_amount)}</b> épargnés</span>
        <span>{progress}%{done && " · Atteint 🎉"}</span>
      </div>

      <form className="goal-actions" onSubmit={submit(onDeposit)} noValidate>
        <input
          aria-label="Montant"
          type="number"
          min="1"
          step="1"
          placeholder="Montant (FCFA)"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          required
        />
        <button className="small" type="submit">Déposer</button>
      </form>
      <form className="goal-actions" onSubmit={submit(onWithdraw)} noValidate>
        <input
          aria-label="Montant à retirer"
          type="number"
          min="1"
          step="1"
          placeholder="Montant à retirer (FCFA)"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          required
        />
        <button className="small withdraw" type="submit">Retirer</button>
      </form>
      {error && <p className="form-error">{error}</p>}
    </article>
  );
}