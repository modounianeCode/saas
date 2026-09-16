import { money } from "@/lib/types";

type Props = {
  balance: number;
  income: number;
  expenses: number;
};

export default function Summary({ balance, income, expenses }: Props) {
  return (
    <section className="summary">
      <article className="balance">
        <small>SOLDE ACTUEL</small>
        <strong>{money.format(balance)}</strong>
        <span>Votre solde disponible</span>
      </article>
      <article className="income">
        <small>REVENUS CE MOIS</small>
        <strong>+ {money.format(income)}</strong>
      </article>
      <article className="expense">
        <small>DÉPENSES CE MOIS</small>
        <strong>− {money.format(expenses)}</strong>
      </article>
    </section>
  );
}