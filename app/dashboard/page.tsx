import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabaseServer";
import Dashboard from "@/app/components/Dashboard";

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  return <Dashboard />;
}