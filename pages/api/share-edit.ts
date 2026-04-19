import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { USER_FILES_BUCKET } from "@/lib/constants";
import { isBrowserEditableFile } from "@/lib/file-workspace";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const { token, contentText, plainText, fileBase64, mimeType, sizeBytes } = request.body as {
    token?: string;
    contentText?: string;
    plainText?: string;
    fileBase64?: string;
    mimeType?: string;
    sizeBytes?: number;
  };

  if (typeof token !== "string" || typeof contentText !== "string") {
    return response.status(400).json({ error: "Token and content metadata are required." });
  }

  const supabase = createSupabaseAdminClient();
  const { data: link, error: linkError } = await supabase
    .from("share_links")
    .select("*, drive_items(*)")
    .eq("token", token)
    .eq("permission", "edit")
    .eq("is_active", true)
    .single();

  if (linkError || !link) {
    return response.status(403).json({ error: "Share link is not valid for editing." });
  }

  const item = Array.isArray(link.drive_items) ? link.drive_items[0] : link.drive_items;
  const editable = isBrowserEditableFile(item.extension, item.mime_type);

  if (!editable) {
    return response.status(400).json({ error: "This file type is not editable in the browser." });
  }

  const nextMimeType = mimeType || item.mime_type || "application/octet-stream";
  const blob = typeof fileBase64 === "string"
    ? new Blob([Buffer.from(fileBase64, "base64")], { type: nextMimeType })
    : new Blob([plainText ?? ""], { type: nextMimeType });
  const storagePath = item.storage_path ?? `${item.user_id}/${crypto.randomUUID()}-${item.name}`;
  const { error: storageError } = await supabase.storage.from(USER_FILES_BUCKET).upload(storagePath, blob, {
    upsert: true,
    contentType: nextMimeType
  });

  if (storageError) {
    return response.status(500).json({ error: storageError.message });
  }

  const { data: latestVersion } = await supabase
    .from("file_versions")
    .select("version_no")
    .eq("item_id", item.id)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  const versionNo = (latestVersion?.version_no ?? 0) + 1;

  await supabase
    .from("drive_items")
    .update({
      content_text: contentText,
      storage_path: storagePath,
      size_bytes: typeof sizeBytes === "number" ? sizeBytes : blob.size,
      updated_at: new Date().toISOString(),
      last_opened_at: new Date().toISOString()
    })
    .eq("id", item.id);

  await supabase.from("file_versions").insert({
    item_id: item.id,
    user_id: item.user_id,
    version_no: versionNo,
    storage_path: storagePath,
    content_text: contentText,
    size_bytes: typeof sizeBytes === "number" ? sizeBytes : blob.size
  });

  return response.status(200).json({ ok: true });
}
