import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  const [{ data: items }, { data: shares }] = await Promise.all([
    supabase.from("drive_items").select("*").order("updated_at", { ascending: false }),
    supabase.from("share_links").select("*").order("created_at", { ascending: false })
  ]);

  return (
    <DashboardShell
      userId={user.id}
      userEmail={user.email ?? "Signed-in user"}
      initialItems={items ?? []}
      initialShares={shares ?? []}
    />
  );
}
