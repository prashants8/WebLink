import { notFound } from "next/navigation";
import { ShareClient } from "@/components/share/share-client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SharePageProps = {
  params: Promise<{ token: string }>;
};

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: link } = await supabase
    .from("share_links")
    .select("*, drive_items(*)")
    .eq("token", token)
    .eq("is_active", true)
    .single();

  if (!link || !link.drive_items) {
    notFound();
  }

  const item = Array.isArray(link.drive_items) ? link.drive_items[0] : link.drive_items;
  let assetUrl: string | null = null;

  if (item.storage_path) {
    const { data } = await supabase.storage.from("user-files").createSignedUrl(item.storage_path, 60 * 10);
    assetUrl = data?.signedUrl ?? null;
  }

  return (
    <main className="min-h-screen bg-canvas px-6 py-10 text-white">
      <ShareClient token={token} item={item} permission={link.permission} assetUrl={assetUrl} />
    </main>
  );
}
