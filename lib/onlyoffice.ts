import { createHash, createHmac } from "node:crypto";
import jwt from "jsonwebtoken";
import type { IConfig } from "@onlyoffice/document-editor-react";
import { isDocxFile, isXlsxFile } from "@/lib/file-workspace";
import type { DriveItem, SharePermission } from "@/lib/types";

export type OnlyOfficeSource = "drive" | "share";

export type OnlyOfficeCallbackContext = {
  itemId: string;
  permission: SharePermission;
  shareToken?: string | null;
  source: OnlyOfficeSource;
};

const CALLBACK_VERSION = "v1";

export function getOnlyOfficeServerUrl() {
  return process.env.NEXT_PUBLIC_ONLYOFFICE_URL?.replace(/\/+$/, "") ?? "";
}

export function isOnlyOfficeConfigured() {
  return Boolean(getOnlyOfficeServerUrl() && process.env.ONLYOFFICE_JWT_SECRET);
}

export function isOnlyOfficeFile(item: Pick<DriveItem, "extension" | "mime_type">) {
  return isDocxFile(item.extension, item.mime_type) || isXlsxFile(item.extension, item.mime_type);
}

export function getOnlyOfficeDocumentType(item: Pick<DriveItem, "extension" | "mime_type">) {
  return isDocxFile(item.extension, item.mime_type) ? "word" : "cell";
}

export function getOnlyOfficeFileType(item: Pick<DriveItem, "extension" | "mime_type">) {
  return isDocxFile(item.extension, item.mime_type) ? "docx" : "xlsx";
}

export function buildOnlyOfficeDocumentKey(
  item: Pick<DriveItem, "id" | "updated_at">,
  context: OnlyOfficeCallbackContext
) {
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        callbackVersion: CALLBACK_VERSION,
        context,
        itemId: item.id,
        updatedAt: item.updated_at
      })
    )
    .digest("hex");

  return `${item.id.replace(/-/g, "").slice(0, 12)}-${hash.slice(0, 20)}`;
}

export function buildOnlyOfficeCallbackSignature(context: OnlyOfficeCallbackContext) {
  return createHmac("sha256", process.env.ONLYOFFICE_JWT_SECRET!)
    .update(`${CALLBACK_VERSION}:${JSON.stringify(context)}`)
    .digest("hex");
}

export function verifyOnlyOfficeCallbackSignature(signature: string | null, context: OnlyOfficeCallbackContext) {
  if (!signature || !process.env.ONLYOFFICE_JWT_SECRET) {
    return false;
  }

  return buildOnlyOfficeCallbackSignature(context) === signature;
}

export function signOnlyOfficeConfig(config: IConfig) {
  return jwt.sign(config as object, process.env.ONLYOFFICE_JWT_SECRET!, {
    algorithm: "HS256"
  });
}

export function getPublicAppUrl(request: Request) {
  const explicit = process.env.ONLYOFFICE_CALLBACK_URL?.replace(/\/+$/, "");
  if (explicit) {
    return explicit;
  }

  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "http";

  if (!forwardedHost) {
    throw new Error("A public application URL is required to build the ONLYOFFICE callback URL.");
  }

  return `${forwardedProto}://${forwardedHost}`;
}

export function normalizeDisplayName(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, 128);
}

export function normalizeIdentity(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 128) || fallback;
}

export function createAvatarDataUri(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "D";
  const hueSeed = Array.from(name).reduce((total, character) => total + character.charCodeAt(0), 0);
  const hue = hueSeed % 360;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
      <rect width="72" height="72" rx="24" fill="hsl(${hue} 70% 46%)"/>
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="white">${initials}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
