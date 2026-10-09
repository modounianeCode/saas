export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  /** Clé d'idempotence générée côté client : seule référence utilisée
   *  pour les suppressions et le rejeu de l'outbox (les ids `local-*`
   *  n'existent pas côté serveur). */
  client_id: string;
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

export type SavingsGoal = {
  id: string;
  /** Voir Transaction.client_id. */
  client_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  created_at: string;
};

/** UUID v4 côté navigateur (ou fallback pour les vieux clients). */
export function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const expenseCategories = ["Alimentation", "Transport", "Logement", "Santé", "Loisirs", "Autres"];
export const incomeCategories = ["Salaire", "Vente", "Cadeau", "Autres"];

export const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}