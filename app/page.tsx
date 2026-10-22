import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabaseServer";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; next?: string }>;
}) {
  const params = await searchParams;

  // Ancien lien e-mail pointant sur la racine : on le route vers l'échange PKCE
  // au lieu de perdre le `code` dans la redirection.
  if (params.code) {
    const next = params.next ? `&next=${encodeURIComponent(params.next)}` : "";
    redirect(`/auth/callback?code=${encodeURIComponent(params.code)}${next}`);
  }

  const user = await getUser();
  redirect(user ? "/dashboard" : "/login");
}
