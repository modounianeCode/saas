import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabaseServer";

/**
 * Point d'entrée des liens envoyés par e-mail (confirmation d'inscription,
 * réinitialisation de mot de passe). @supabase/ssr utilise le flux PKCE : sans
 * échange explicite du `code` contre une session, les liens ne fonctionnent pas.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  if (code) {
    const supabase = await getServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL("/login?error=lien_invalide", origin));
}

/** N'accepte qu'un chemin interne, pour éviter une redirection ouverte. */
function sanitizeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}
