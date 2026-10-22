"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { validateEmail, validateName, validatePassword } from "@/lib/validation";

type Mode = "login" | "signup" | "reset";

export default function AuthForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const client = useMemo(supabase, []);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "error" | "success"; text: string } | null>(
    initialError ? { type: "error", text: initialError } : null
  );

  // Les liens e-mail passent par /auth/callback (flux PKCE) : sans cet échange
  // de code, la session n'est jamais créée.
  const callbackUrl = (next: string) =>
    `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setNotice(null);

    const emailError = validateEmail(email);
    if (emailError) return setNotice({ type: "error", text: emailError });
    if (mode !== "reset") {
      const passwordError = validatePassword(password);
      if (passwordError) return setNotice({ type: "error", text: passwordError });
    }
    if (mode === "signup") {
      const nameError = validateName(fullName);
      if (nameError) return setNotice({ type: "error", text: nameError });
    }

    setBusy(true);
    try {
      if (mode === "reset") {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: callbackUrl("/reset-password"),
        });
        setNotice(error
          ? { type: "error", text: error.message }
          : { type: "success", text: "Un lien de réinitialisation vient d’être envoyé." });
        return;
      }

      if (mode === "signup") {
        const { error } = await client.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName }, emailRedirectTo: callbackUrl("/dashboard") },
        });
        setNotice(error
          ? { type: "error", text: error.message }
          : { type: "success", text: "Vérifiez votre e-mail pour confirmer votre compte." });
        return;
      }

      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) return setNotice({ type: "error", text: error.message });
      router.push("/dashboard");
      router.refresh();
    } catch {
      setNotice({ type: "error", text: "Connexion impossible. Vérifiez votre réseau puis réessayez." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand"><span>✦</span> Argent Clair</div>
        <h1>Votre argent,<br />simplement.</h1>
        <p>Suivez chaque dépense. Gardez le contrôle.</p>
        <form onSubmit={submitAuth} className="stack" noValidate>
          {mode === "signup" && (
            <input
              aria-label="Nom complet"
              type="text"
              placeholder="Nom complet"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              autoComplete="name"
              required
            />
          )}
          <input
            aria-label="E-mail"
            type="email"
            placeholder="votre@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          {mode !== "reset" && (
            <input
              aria-label="Mot de passe"
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={8}
            />
          )}
          <button disabled={busy}>
            {mode === "login" ? "Se connecter" : mode === "signup" ? "Créer mon compte" : "Envoyer le lien"}
          </button>
        </form>
        {notice && <p className={`notice ${notice.type}`}>{notice.text}</p>}
        <div className="auth-links">
          {mode !== "login" && <button type="button" onClick={() => { setMode("login"); setNotice(null); }}>Se connecter</button>}
          {mode !== "signup" && <button type="button" onClick={() => { setMode("signup"); setNotice(null); }}>Créer un compte</button>}
          {mode !== "reset" && <button type="button" onClick={() => { setMode("reset"); setNotice(null); }}>Mot de passe oublié ?</button>}
        </div>
      </section>
    </main>
  );
}
