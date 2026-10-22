import Link from "next/link";

export default function NotFound() {
  return (
    <main className="app-shell state-screen">
      <h1>Page introuvable</h1>
      <p>La page demandée n’existe pas ou a été déplacée.</p>
      <Link href="/">Retour à l’accueil</Link>
    </main>
  );
}
