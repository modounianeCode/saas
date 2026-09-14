"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Transaction = { id: string; type: "income" | "expense"; amount: number; label: string; category: string; occurred_on: string };
const expenseCategories = ["Alimentation", "Transport", "Logement", "Santé", "Loisirs", "Autres"];
const incomeCategories = ["Salaire", "Vente", "Cadeau", "Autres"];
const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });

export default function Home() {
  const client = useMemo(supabase, []);
  const [userId, setUserId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ type: "expense" as "income" | "expense", amount: "", label: "", category: "Alimentation", occurred_on: new Date().toISOString().slice(0, 10) });

  async function load(id: string) {
    const [{ data: items }, { data: profile }] = await Promise.all([
      client.from("transactions").select("id,type,amount,label,category,occurred_on").order("occurred_on", { ascending: false }),
      client.from("profiles").select("opening_balance").single(),
    ]);
    setTransactions((items ?? []) as Transaction[]);
    setOpeningBalance(Number(profile?.opening_balance ?? 0));
  }

  useEffect(() => {
    client.auth.getUser().then(({ data }) => { if (data.user) { setUserId(data.user.id); load(data.user.id); } });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id ?? null; setUserId(id); if (id) load(id); else setTransactions([]);
    });
    return () => listener.subscription.unsubscribe();
  }, [client]);

  async function submitAuth(event: FormEvent) {
    event.preventDefault(); setNotice("");
    if (mode === "reset") {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/` });
      setNotice(error ? error.message : "Un lien de réinitialisation vient d’être envoyé."); return;
    }
    const action = mode === "login"
      ? client.auth.signInWithPassword({ email, password })
      : client.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/` } });
    const { error } = await action;
    setNotice(error ? error.message : mode === "signup" ? "Vérifiez votre e-mail pour confirmer votre compte." : "Connexion réussie.");
  }

  async function addTransaction(event: FormEvent) {
    event.preventDefault(); if (!userId || !form.amount || !form.label.trim()) return;
    const { error } = await client.from("transactions").insert({ user_id: userId, type: form.type, amount: Math.round(Number(form.amount)), label: form.label.trim(), category: form.category, occurred_on: form.occurred_on });
    if (error) return setNotice(error.message);
    setForm({ type: "expense", amount: "", label: "", category: "Alimentation", occurred_on: new Date().toISOString().slice(0, 10) }); load(userId);
  }

  async function removeTransaction(id: string) { if (userId && confirm("Supprimer cette transaction ?")) { await client.from("transactions").delete().eq("id", id); load(userId); } }
  async function saveOpeningBalance(value: string) { if (!userId) return; const next = Math.round(Number(value || 0)); await client.from("profiles").upsert({ id: userId, opening_balance: next }); setOpeningBalance(next); }

  if (!userId) return <main className="auth-shell"><section className="auth-card"><div className="brand"><span>✦</span> Argent Clair</div><h1>Votre argent,<br />simplement.</h1><p>Suivez chaque dépense. Gardez le contrôle.</p><form onSubmit={submitAuth} className="stack"><input aria-label="E-mail" type="email" placeholder="votre@email.com" value={email} onChange={e => setEmail(e.target.value)} required /><input aria-label="Mot de passe" type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} required={mode !== "reset"} minLength={8} /><button>{mode === "login" ? "Se connecter" : mode === "signup" ? "Créer mon compte" : "Envoyer le lien"}</button></form>{notice && <p className="notice">{notice}</p>}<div className="auth-links">{mode !== "login" && <button onClick={() => setMode("login")}>Se connecter</button>}{mode !== "signup" && <button onClick={() => setMode("signup")}>Créer un compte</button>}{mode !== "reset" && <button onClick={() => setMode("reset")}>Mot de passe oublié ?</button>}</div></section></main>;

  const startOfMonth = new Date(); startOfMonth.setDate(1); const currentMonth = startOfMonth.toISOString().slice(0, 7);
  const thisMonth = transactions.filter(t => t.occurred_on.startsWith(currentMonth));
  const income = thisMonth.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const expenses = thisMonth.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const balance = openingBalance + transactions.reduce((sum, t) => sum + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);
  const categories = form.type === "income" ? incomeCategories : expenseCategories;

  return <main className="app-shell"><header><div className="brand"><span>✦</span> Argent Clair</div><button className="logout" onClick={() => client.auth.signOut()}>Déconnexion</button></header><section className="welcome"><div><p>Bonjour 👋</p><h1>Voici votre situation.</h1></div><label className="opening">Solde initial<input type="number" defaultValue={openingBalance} onBlur={e => saveOpeningBalance(e.target.value)} /></label></section><section className="summary"><article className="balance"><small>SOLDE ACTUEL</small><strong>{money.format(balance)}</strong><span>Votre solde disponible</span></article><article className="income"><small>REVENUS CE MOIS</small><strong>+ {money.format(income)}</strong></article><article className="expense"><small>DÉPENSES CE MOIS</small><strong>− {money.format(expenses)}</strong></article></section><section className="content-grid"><article className="panel"><h2>Ajouter une transaction</h2><form className="transaction-form" onSubmit={addTransaction}><div className="type-switch"><button type="button" className={form.type === "expense" ? "active expense-btn" : ""} onClick={() => setForm({ ...form, type: "expense", category: "Alimentation" })}>Dépense</button><button type="button" className={form.type === "income" ? "active income-btn" : ""} onClick={() => setForm({ ...form, type: "income", category: "Salaire" })}>Revenu</button></div><input type="number" min="1" placeholder="Montant (FCFA)" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required /><input placeholder="Libellé (ex. Courses)" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} required maxLength={120} /><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{categories.map(c => <option key={c}>{c}</option>)}</select><input type="date" value={form.occurred_on} onChange={e => setForm({ ...form, occurred_on: e.target.value })} required /><button>Ajouter la transaction</button></form></article><article className="panel transactions"><h2>Dernières transactions</h2>{transactions.length === 0 ? <p className="empty">Aucune transaction pour le moment.</p> : transactions.slice(0, 8).map(t => <div className="transaction" key={t.id}><span className={`icon ${t.type}`}>{t.type === "income" ? "↗" : "↘"}</span><div><b>{t.label}</b><small>{t.category} · {new Date(`${t.occurred_on}T00:00:00`).toLocaleDateString("fr-FR")}</small></div><strong className={t.type}>{t.type === "income" ? "+" : "−"}{money.format(t.amount)}</strong><button aria-label="Supprimer" onClick={() => removeTransaction(t.id)}>×</button></div>)}</article></section></main>;
}
