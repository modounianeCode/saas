"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { validateEmail, validatePassword } from "@/lib/validation";

type Mode = "login" | "signup" | "reset";

export default function AuthForm() {
  const router = useRouter();
  const client = useMemo(supabase, []);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setNotice(null);

    const emailError = validateEmail(email);
    if (emailError) return setNotice({ type: "error", text: emailError });
    if (mode !== "reset") {
      const passwordError = validatePassword(password);
      if (passwordError) return setNotice({ type: "error", text: passwordError });
    }

    if (mode === "reset") {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/` });
      setNotice(error
        ? { type: "error", text: error.message }
        : { type: "success", text: "Un lien de réinitialisation vient d’être envoyé." });
      return;
    }

    const { error } = mode === "login"
      ? await client.auth.signInWithPassword({ email, password })
      : await client.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/` } });

    if (error) return setNotice({ type: "error", text: error.message });
    if (mode === "signup") {
      setNotice({ type: "success", text: "Vérifiez votre e-mail pour confirmer votre compte." });
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand"><span>✦</span> Argent Clair</div>
        <h1>Votre argent,<br />simplement.</h1>
        <p>Suivez chaque dépense. Gardez le contrôle.</p>
        <form onSubmit={submitAuth} className="stack" noValidate>
          <input
            aria-label="E-mail"
            type="email"
            placeholder="votre@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          {mode !== "reset" && (
            <input
              aria-label="Mot de passe"
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
            />
          )}
          <button>{mode === "login" ? "Se connecter" : mode === "signup" ? "Créer mon compte" : "Envoyer le lien"}</button>
        </form>
        {notice && <p className={`notice ${notice.type}`}>{notice.text}</p>}
        <div className="auth-links">
          {mode !== "login" && <button onClick={() => { setMode("login"); setNotice(null); }}>Se connecter</button>}
          {mode !== "signup" && <button onClick={() => { setMode("signup"); setNotice(null); }}>Créer un compte</button>}
          {mode !== "reset" && <button onClick={() => { setMode("reset"); setNotice(null); }}>Mot de passe oublié ?</button>}
        </div>
      </section>
    </main>
  );
}