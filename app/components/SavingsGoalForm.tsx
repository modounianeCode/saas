import { FormEvent, useState } from "react";

type Props = {
  onCreate: (name: string, target: string) => Promise<string | null>;
};

export default function SavingsGoalForm({ onCreate }: Props) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = await onCreate(name, target);
    if (message) return setError(message);
    setError(null);
    setName("");
    setTarget("");
  }

  return (
    <form className="goal-form" onSubmit={submit} noValidate>
      <input
        aria-label="Nom de l'objectif"
        type="text"
        placeholder="Objectif (ex. Nouveau téléphone)"
        value={name}
        onChange={e => setName(e.target.value)}
        required
      />
      <input
        aria-label="Montant cible"
        type="number"
        min="1"
        step="1"
        placeholder="Objectif (FCFA)"
        value={target}
        onChange={e => setTarget(e.target.value)}
        required
      />
      <button>Créer l'objectif</button>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}