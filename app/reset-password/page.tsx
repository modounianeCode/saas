import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabaseServer";
import ResetPasswordForm from "@/app/components/ResetPasswordForm";

export default async function ResetPasswordPage() {
  const user = await getUser();
  // Page accessible uniquement avec la session temporaire issue du lien e-mail.
  if (!user) redirect("/login?error=session_expiree");
  return <ResetPasswordForm />;
}
