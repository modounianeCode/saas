export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  occurred_on: string;
};

export type TransactionInput = {
  type: TransactionType;
  amount: string;
  category: string;
  occurred_on: string;
};

export const expenseCategories = ["Alimentation", "Transport", "Logement", "Santé", "Loisirs", "Autres"];
export const incomeCategories = ["Salaire", "Vente", "Cadeau", "Autres"];

export const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}