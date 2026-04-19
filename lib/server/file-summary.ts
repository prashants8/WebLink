import JSZip from "jszip";
import * as XLSX from "xlsx";
import { isDocxFile, isXlsxFile } from "@/lib/file-workspace";
import type { DriveItem } from "@/lib/types";
import { isSpreadsheet, isTextEditable } from "@/lib/utils";

function summarizeText(text: string) {
  return text.trim().slice(0, 12000);
}

function decodeXmlEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractDocxText(xml: string) {
  const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) ?? [];

  return paragraphs
    .map((paragraph) =>
      (paragraph.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) ?? [])
        .map((run) => decodeXmlEntities(run.replace(/<\/?w:t[^>]*>/g, "")))
        .join("")
        .trim()
    )
    .filter(Boolean)
    .join("\n\n");
}

function summarizeSheets(workbook: XLSX.WorkBook) {
  return workbook.SheetNames.slice(0, 3)
    .map((name) => {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
        header: 1,
        defval: "",
        blankrows: true
      }) as unknown[][];

      const lines = rows
        .slice(0, 10)
        .map((row) => row.map((cell) => (cell == null ? "" : String(cell))).join(" | "));

      return `${name}\n${lines.join("\n")}`.trim();
    })
    .join("\n\n")
    .slice(0, 12000);
}

export async function summarizeStoredFile(
  item: Pick<DriveItem, "extension" | "mime_type">,
  bytes: ArrayBuffer | Uint8Array
) {
  const normalizedBytes = bytes instanceof Uint8Array ? new Uint8Array(bytes) : new Uint8Array(bytes);
  const arrayBuffer = normalizedBytes.buffer.slice(
    normalizedBytes.byteOffset,
    normalizedBytes.byteOffset + normalizedBytes.byteLength
  ) as ArrayBuffer;
  const extension = item.extension;
  const mimeType = item.mime_type;

  if (isDocxFile(extension, mimeType)) {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const documentXml = await zip.file("word/document.xml")?.async("string");
    return summarizeText(documentXml ? extractDocxText(documentXml) : "");
  }

  if (isXlsxFile(extension, mimeType)) {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    return summarizeSheets(workbook);
  }

  if (isTextEditable(extension, mimeType) || isSpreadsheet(extension, mimeType)) {
    const text = new TextDecoder().decode(normalizedBytes);
    return summarizeText(text);
  }

  return null;
}
