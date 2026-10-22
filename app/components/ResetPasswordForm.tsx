"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { validatePassword } from "@/lib/validation";

export default function ResetPasswordForm() {
  const router = useRouter();
  const client = useMemo(supabase, []);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const passwordError = validatePassword(password);
    if (passwordError) return setNotice({ type: "error", text: passwordError });
    if (password !== confirm) return setNotice({ type: "error", text: "Les deux mots de passe ne correspondent pas." });

    setBusy(true);
    const { error } = await client.auth.updateUser({ password });
    setBusy(false);
    if (error) return setNotice({ type: "error", text: error.message });

    setNotice({ type: "success", text: "Mot de passe mis à jour." });
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand"><span>✦</span> Argent Clair</div>
        <h1>Nouveau mot de passe</h1>
        <p>Choisissez un mot de passe d’au moins 8 caractères.</p>
        <form onSubmit={submit} className="stack" noValidate>
          <input
            aria-label="Nouveau mot de passe"
            type="password"
            placeholder="Nouveau mot de passe"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <input
            aria-label="Confirmer le mot de passe"
            type="password"
            placeholder="Confirmer le mot de passe"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <button disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
        </form>
        {notice && <p className={`notice ${notice.type}`}>{notice.text}</p>}
      </section>
    </main>
  );
}
