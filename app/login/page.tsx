import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabaseServer";
import AuthForm from "@/app/components/AuthForm";

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect("/dashboard");
  return <AuthForm />;
}