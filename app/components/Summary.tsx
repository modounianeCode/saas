import { money } from "@/lib/types";

type Props = {
  balance: number;
  income: number;
  expenses: number;
  periodLabel: string;
};

export default function Summary({ balance, income, expenses, periodLabel }: Props) {
  return (
    <section className="summary">
      <article className="balance">
        <small>SOLDE ACTUEL</small>
        <strong>{money.format(balance)}</strong>
        <span>Votre solde disponible</span>
      </article>
      <article className="income">
        <small>REVENUS · {periodLabel}</small>
        <strong>+ {money.format(income)}</strong>
      </article>
      <article className="expense">
        <small>DÉPENSES · {periodLabel}</small>
        <strong>− {money.format(expenses)}</strong>
      </article>
    </section>
  );
}
