import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const token = request.query.token;

  if (typeof token !== "string") {
    return response.status(400).json({ error: "Token is required." });
  }

  const supabase = createSupabaseAdminClient();
  const { data: link } = await supabase
    .from("share_links")
    .select("*, drive_items(*)")
    .eq("token", token)
    .eq("is_active", true)
    .single();

  if (!link) {
    return response.status(404).json({ error: "Not found." });
  }

  const item = Array.isArray(link.drive_items) ? link.drive_items[0] : link.drive_items;

  if (!item?.storage_path) {
    return response.status(404).json({ error: "No asset found." });
  }

  const { data } = await supabase.storage.from("user-files").createSignedUrl(item.storage_path, 60);
  if (!data?.signedUrl) {
    return response.status(500).json({ error: "Could not create signed URL." });
  }

  response.redirect(data.signedUrl);
}
