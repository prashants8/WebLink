import { NextRequest, NextResponse } from "next/server";
import { USER_FILES_BUCKET } from "@/lib/constants";
import {
  normalizeIdentity,
  type OnlyOfficeCallbackContext,
  verifyOnlyOfficeCallbackSignature
} from "@/lib/onlyoffice";
import { summarizeStoredFile } from "@/lib/server/file-summary";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type OnlyOfficeCallbackPayload = {
  filetype?: string;
  key?: string;
  status?: number;
  url?: string;
};

function buildVersionPath(storagePath: string, itemId: string, fileName: string) {
  const segments = storagePath.split("/");
  const ownerRoot = segments[0] || "versions";
  return `${ownerRoot}/versions/${itemId}/${Date.now()}-${fileName}`;
}

function callbackFailure(message: string, status = 400) {
  return NextResponse.json({ error: 1, message }, { status });
}

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const callbackContext: OnlyOfficeCallbackContext = {
    itemId: searchParams.get("itemId") ?? "",
    permission: (searchParams.get("permission") ?? "view") as OnlyOfficeCallbackContext["permission"],
    shareToken: searchParams.get("shareToken"),
    source: (searchParams.get("source") ?? "drive") as OnlyOfficeCallbackContext["source"]
  };

  if (!verifyOnlyOfficeCallbackSignature(searchParams.get("signature"), callbackContext)) {
    return callbackFailure("Callback signature verification failed.", 403);
  }

  const payload = (await request.json()) as OnlyOfficeCallbackPayload;
  if (!payload.status) {
    return callbackFailure("Missing ONLYOFFICE callback status.");
  }

  if ([1, 4].includes(payload.status)) {
    return NextResponse.json({ error: 0 });
  }

  if (![2, 3, 6, 7].includes(payload.status) || !payload.url) {
    return callbackFailure("This ONLYOFFICE callback does not include a savable document URL.");
  }

  const supabase = createSupabaseAdminClient();

  if (callbackContext.source === "share" && callbackContext.shareToken) {
    const { data: link } = await supabase
      .from("share_links")
      .select("id")
      .eq("token", callbackContext.shareToken)
      .eq("permission", "edit")
      .eq("is_active", true)
      .maybeSingle();

    if (!link) {
      return callbackFailure("The share link is not valid for editing.", 403);
    }
  }

  const { data: item } = await supabase
    .from("drive_items")
    .select("*")
    .eq("id", callbackContext.itemId)
    .maybeSingle();

  if (!item || item.item_type !== "file") {
    return callbackFailure("The target file could not be found.", 404);
  }

  const fileResponse = await fetch(payload.url);
  if (!fileResponse.ok) {
    return callbackFailure("The edited file could not be downloaded from ONLYOFFICE.", 502);
  }

  const bytes = new Uint8Array(await fileResponse.arrayBuffer());
  const mimeType = fileResponse.headers.get("content-type") ?? item.mime_type ?? "application/octet-stream";
  const storagePath = item.storage_path ?? `${normalizeIdentity(item.user_id, "driveto")}/${crypto.randomUUID()}-${item.name}`;
  const versionPath = buildVersionPath(storagePath, item.id, item.name);
  const uploadBody = new Blob([bytes], { type: mimeType });

  const { error: currentUploadError } = await supabase.storage.from(USER_FILES_BUCKET).upload(storagePath, uploadBody, {
    contentType: mimeType,
    upsert: true
  });

  if (currentUploadError) {
    return callbackFailure(currentUploadError.message, 500);
  }

  const { error: versionUploadError } = await supabase.storage.from(USER_FILES_BUCKET).upload(versionPath, uploadBody, {
    contentType: mimeType,
    upsert: true
  });

  if (versionUploadError) {
    return callbackFailure(versionUploadError.message, 500);
  }

  const contentText = await summarizeStoredFile(item, bytes);
  const { data: latestVersion } = await supabase
    .from("file_versions")
    .select("version_no")
    .eq("item_id", item.id)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  const versionNo = (latestVersion?.version_no ?? 0) + 1;
  const timestamp = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("drive_items")
    .update({
      content_text: contentText,
      last_opened_at: timestamp,
      size_bytes: bytes.byteLength,
      storage_path: storagePath,
      updated_at: timestamp
    })
    .eq("id", item.id);

  if (updateError) {
    return callbackFailure(updateError.message, 500);
  }

  const { error: versionInsertError } = await supabase.from("file_versions").insert({
    content_text: contentText,
    item_id: item.id,
    size_bytes: bytes.byteLength,
    storage_path: versionPath,
    user_id: item.user_id,
    version_no: versionNo
  });

  if (versionInsertError) {
    return callbackFailure(versionInsertError.message, 500);
  }

  return NextResponse.json({ error: 0 });
}
