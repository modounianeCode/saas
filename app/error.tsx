"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="app-shell state-screen">
      <h1>Une erreur est survenue</h1>
      <p>Vos données locales sont intactes. Réessayez, puis rechargez la page si besoin.</p>
      <button onClick={reset}>Réessayer</button>
    </main>
  );
}
