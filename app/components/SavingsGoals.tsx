"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useSavings } from "@/lib/useSavings";
import { money } from "@/lib/types";
import SavingsGoalForm from "./SavingsGoalForm";
import SavingsGoalCard from "./SavingsGoalCard";

type Props = {
  client: SupabaseClient;
  userId: string;
};

export default function SavingsGoals({ client, userId }: Props) {
  const { goals, create, deposit, withdraw, remove } = useSavings(client, userId);
  const totalSaved = goals.reduce((sum, goal) => sum + goal.current_amount, 0);

  return (
    <section className="savings-section">
      <div className="savings-header">
        <h2>Mes objectifs d'épargne</h2>
        <span className="savings-total">Total épargné : <b>{money.format(totalSaved)}</b></span>
      </div>

      <div className="panel">
        <h2>Nouvel objectif</h2>
        <SavingsGoalForm onCreate={create} />
      </div>

      {goals.length === 0 ? (
        <p className="empty">Créez votre premier objectif d'épargne pour commencer.</p>
      ) : (
        <div className="savings-grid">
          {goals.map(goal => (
            <SavingsGoalCard
              key={goal.id}
              goal={goal}
              onDeposit={deposit}
              onWithdraw={withdraw}
              onRemove={remove}
            />
          ))}
        </div>
      )}
    </section>
  );
}