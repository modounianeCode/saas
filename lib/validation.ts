export function validateAmount(raw: string): string | null {
  if (!raw.trim()) return "Le montant est requis.";
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return "Le montant doit être un nombre positif.";
  if (!Number.isInteger(amount)) return "Le montant doit être un nombre entier (FCFA).";
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email.trim()) return "L’e-mail est requis.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Adresse e-mail invalide.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Le mot de passe est requis.";
  if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
  return null;
}

export function validateName(name: string): string | null {
  if (!name.trim()) return "Le nom est requis.";
  if (name.length > 120) return "Le nom ne peut pas dépasser 120 caractères.";
  return null;
}

export function validateWithdrawal(amount: number, current: number): string | null {
  if (amount > current) return "Le retrait ne peut pas dépasser le montant épargné.";
  return null;
}