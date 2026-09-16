import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabaseServer";

export default async function Home() {
  const user = await getUser();
  redirect(user ? "/dashboard" : "/login");
}