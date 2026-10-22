import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabaseServer";
import AuthForm from "@/app/components/AuthForm";

const ERROR_MESSAGES: Record<string, string> = {
  lien_invalide: "Ce lien a expiré ou n’est plus valide. Demandez-en un nouveau.",
  session_expiree: "Votre session a expiré. Reconnectez-vous pour continuer.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getUser();
  if (user) redirect("/dashboard");

  const { error } = await searchParams;
  return <AuthForm initialError={error ? ERROR_MESSAGES[error] ?? ERROR_MESSAGES.lien_invalide : undefined} />;
}
