import { NextRequest, NextResponse } from "next/server";
import type { IConfig } from "@onlyoffice/document-editor-react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { USER_FILES_BUCKET } from "@/lib/constants";
import {
  buildOnlyOfficeCallbackSignature,
  buildOnlyOfficeDocumentKey,
  createAvatarDataUri,
  getOnlyOfficeDocumentType,
  getOnlyOfficeFileType,
  getOnlyOfficeServerUrl,
  getPublicAppUrl,
  isOnlyOfficeConfigured,
  isOnlyOfficeFile,
  normalizeDisplayName,
  normalizeIdentity,
  signOnlyOfficeConfig,
  type OnlyOfficeCallbackContext
} from "@/lib/onlyoffice";
import type { DriveItem, SharePermission } from "@/lib/types";

export const runtime = "nodejs";

function getItemFromRelation(data: { drive_items?: DriveItem | DriveItem[] | null }) {
  if (Array.isArray(data.drive_items)) {
    return data.drive_items[0] ?? null;
  }

  return data.drive_items ?? null;
}

export async function GET(request: NextRequest) {
  if (!isOnlyOfficeConfigured()) {
    return NextResponse.json({ error: "ONLYOFFICE is not configured for this environment." }, { status: 503 });
  }

  const admin = createSupabaseAdminClient();
  const searchParams = request.nextUrl.searchParams;
  const shareToken = searchParams.get("shareToken");
  const itemId = searchParams.get("itemId");
  let permission: SharePermission = "edit";
  let source: OnlyOfficeCallbackContext["source"] = "drive";
  let item: DriveItem | null = null;
  let currentUserId = "";
  let currentUserName = "";

  if (shareToken) {
    source = "share";
    const { data: link, error } = await admin
      .from("share_links")
      .select("permission, expires_at, drive_items(*)")
      .eq("token", shareToken)
      .eq("is_active", true)
      .single();

    if (error || !link) {
      return NextResponse.json({ error: "The share link is no longer available." }, { status: 404 });
    }

    if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "This share link has expired." }, { status: 403 });
    }

    item = getItemFromRelation(link);
    permission = link.permission;
    currentUserId = normalizeIdentity(searchParams.get("guestId"), `guest-${crypto.randomUUID()}`);
    currentUserName = normalizeDisplayName(searchParams.get("guestName"), "DriveTo guest");
  } else if (itemId) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in to open this document." }, { status: 401 });
    }

    const { data, error } = await supabase.from("drive_items").select("*").eq("id", itemId).single();
    if (error || !data) {
      return NextResponse.json({ error: "The requested document could not be found." }, { status: 404 });
    }

    item = data;
    currentUserId = normalizeIdentity(user.id, "driveto-user");
    currentUserName = normalizeDisplayName(user.email?.split("@")[0], "DriveTo user");
  } else {
    return NextResponse.json({ error: "An item id or share token is required." }, { status: 400 });
  }

  if (!item || item.item_type !== "file" || !item.storage_path || !isOnlyOfficeFile(item)) {
    return NextResponse.json({ error: "This file is not available for ONLYOFFICE editing." }, { status: 400 });
  }

  const { data: signed } = await admin.storage.from(USER_FILES_BUCKET).createSignedUrl(item.storage_path, 60 * 60 * 6);
  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "A signed file URL could not be created." }, { status: 500 });
  }

  const callbackContext: OnlyOfficeCallbackContext = {
    itemId: item.id,
    permission,
    shareToken,
    source
  };
  const callbackSignature = buildOnlyOfficeCallbackSignature(callbackContext);
  const callbackQuery = new URLSearchParams({
    itemId: item.id,
    permission,
    signature: callbackSignature,
    source
  });

  if (shareToken) {
    callbackQuery.set("shareToken", shareToken);
  }

  const callbackUrl = `${getPublicAppUrl(request)}/api/onlyoffice/callback?${callbackQuery.toString()}`;
  const documentType = getOnlyOfficeDocumentType(item);
  const canEdit = permission === "edit";

  const config: IConfig = {
    document: {
      fileType: getOnlyOfficeFileType(item),
      info: {
        folder: "DriveTo",
        owner: item.user_id,
        uploaded: item.created_at
      },
      key: buildOnlyOfficeDocumentKey(item, callbackContext),
      permissions: {
        chat: true,
        comment: canEdit,
        copy: true,
        download: true,
        edit: canEdit,
        print: true,
        review: canEdit && documentType === "word",
        userInfoGroups: [""]
      },
      title: item.name,
      url: signed.signedUrl
    },
    documentType,
    editorConfig: {
      callbackUrl,
      coEditing: {
        change: true,
        mode: "fast"
      },
      customization: {
        autosave: true,
        comments: canEdit,
        compactHeader: false,
        compactToolbar: false,
        forcesave: true,
        hideRightMenu: false,
        mobile: {
          forceView: false,
          info: true,
          standardView: true
        },
        toolbarHideFileName: false,
        uiTheme: "theme-dark",
        zoom: 100
      },
      lang: "en",
      mode: canEdit ? "edit" : "view",
      region: "en-US",
      user: {
        id: currentUserId,
        image: createAvatarDataUri(currentUserName),
        name: currentUserName
      }
    },
    token: ""
  };

  config.token = signOnlyOfficeConfig(config);

  return NextResponse.json({
    canEdit,
    config,
    documentServerUrl: getOnlyOfficeServerUrl(),
    lastEditedAt: item.updated_at,
    permission,
    source
  });
}
