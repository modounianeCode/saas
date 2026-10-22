import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit la session Supabase à chaque requête et reporte les cookies
 * tournés sur la réponse. Sans ce middleware, l'access token expire au bout
 * d'une heure et `getUser()` côté serveur renvoie `null` alors que le refresh
 * token est toujours valide (déconnexions « aléatoires »).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  try {
    const { data } = await supabase.auth.getUser();

    if (data.user && request.nextUrl.pathname === "/login") {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/dashboard";
      redirect.search = "";
      return NextResponse.redirect(redirect);
    }
  } catch {
    // Réseau indisponible : on laisse passer, les pages se protègent elles-mêmes.
  }

  return response;
}

export const config = {
  matcher: [
    // Tout sauf les assets statiques, le service worker et les fichiers publics.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|sw.js|manifest.webmanifest|offline.html).*)",
  ],
};
