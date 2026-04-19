import JSZip from "jszip";
import * as XLSX from "xlsx";
import type { DriveItem } from "@/lib/types";
import { csvToGrid, gridToCsv, isSpreadsheet, isTextEditable } from "@/lib/utils";

export type SheetDraft = {
  name: string;
  rows: string[][];
};

export type EditorDraft =
  | {
      mode: "text";
      text: string;
      contentText: string;
    }
  | {
      mode: "grid";
      text: string;
      contentText: string;
      delimiter: "," | "\t";
    }
  | {
      mode: "docx";
      text: string;
      contentText: string;
      originalBase64: string;
    }
  | {
      mode: "xlsx";
      text: string;
      contentText: string;
      originalBase64: string;
      activeSheet: number;
      sheets: SheetDraft[];
    };

export type EditorSavePayload = {
  contentText: string;
  mimeType: string;
  sizeBytes: number;
  plainText?: string;
  fileBase64?: string;
};

export function isDocxFile(extension: string | null, mimeType: string | null) {
  return (
    extension === "docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export function isXlsxFile(extension: string | null, mimeType: string | null) {
  return (
    extension === "xlsx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

export function isBrowserEditableFile(extension: string | null, mimeType: string | null) {
  return (
    isTextEditable(extension, mimeType) ||
    isSpreadsheet(extension, mimeType) ||
    isDocxFile(extension, mimeType) ||
    isXlsxFile(extension, mimeType)
  );
}

export function isBrowserPreviewableFile(extension: string | null, mimeType: string | null) {
  return isBrowserEditableFile(extension, mimeType);
}

export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string) {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function ensureRows(rows: unknown[][]) {
  const normalized = rows.map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
  if (normalized.length === 0) {
    return [[""]];
  }

  const width = Math.max(...normalized.map((row) => row.length), 1);
  return normalized.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""));
}

function summarizeText(text: string) {
  return text.trim().slice(0, 12000);
}

function summarizeSheets(sheets: SheetDraft[]) {
  return sheets
    .slice(0, 3)
    .map((sheet) => {
      const lines = ensureRows(sheet.rows)
        .slice(0, 10)
        .map((row) => row.join(" | "));
      return `${sheet.name}\n${lines.join("\n")}`;
    })
    .join("\n\n")
    .slice(0, 12000);
}

function extractDocxText(xml: string) {
  const parser = new DOMParser();
  const documentXml = parser.parseFromString(xml, "application/xml");
  const paragraphs = Array.from(documentXml.getElementsByTagNameNS("*", "p"))
    .map((paragraph) =>
      Array.from(paragraph.getElementsByTagNameNS("*", "t"))
        .map((node) => node.textContent ?? "")
        .join("")
    )
    .filter((paragraph) => paragraph.length > 0);

  return paragraphs.join("\n\n");
}

function setParagraphText(paragraph: Element, nextText: string) {
  const textNodes = Array.from(paragraph.getElementsByTagNameNS("*", "t"));
  if (textNodes.length === 0) {
    return;
  }

  textNodes.forEach((node, index) => {
    node.textContent = index === 0 ? nextText : "";
    if (index === 0 && (/^\s/.test(nextText) || /\s$/.test(nextText) || nextText.includes("  "))) {
      node.setAttribute("xml:space", "preserve");
    } else {
      node.removeAttribute("xml:space");
    }
  });
}

function splitParagraphs(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [""];
  }
  return normalized.split(/\n{2,}/);
}

export async function createEditorDraft(item: DriveItem, fileBytes: ArrayBuffer) {
  if (isDocxFile(item.extension, item.mime_type)) {
    const zip = await JSZip.loadAsync(fileBytes);
    const documentXml = await zip.file("word/document.xml")?.async("string");
    const text = documentXml ? extractDocxText(documentXml) : "";
    return {
      mode: "docx",
      text,
      contentText: summarizeText(text),
      originalBase64: arrayBufferToBase64(fileBytes)
    } satisfies EditorDraft;
  }

  if (isXlsxFile(item.extension, item.mime_type)) {
    const workbook = XLSX.read(fileBytes, { type: "array", cellStyles: true });
    const sheets = workbook.SheetNames.map((name) => ({
      name,
      rows: ensureRows(XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: "", blankrows: true }) as unknown[][])
    }));

    return {
      mode: "xlsx",
      text: summarizeSheets(sheets),
      contentText: summarizeSheets(sheets),
      originalBase64: arrayBufferToBase64(fileBytes),
      activeSheet: 0,
      sheets
    } satisfies EditorDraft;
  }

  const text = await new Blob([fileBytes]).text();

  if (isSpreadsheet(item.extension, item.mime_type)) {
    return {
      mode: "grid",
      text,
      contentText: summarizeText(text),
      delimiter: item.extension === "tsv" ? "\t" : ","
    } satisfies EditorDraft;
  }

  return {
    mode: "text",
    text,
    contentText: summarizeText(text)
  } satisfies EditorDraft;
}

export async function createUploadContentSummary(file: File) {
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? null;

  if (isTextEditable(extension, file.type) || isSpreadsheet(extension, file.type)) {
    return summarizeText(await file.text());
  }

  if (isDocxFile(extension, file.type) || isXlsxFile(extension, file.type)) {
    const item = {
      extension,
      mime_type: file.type
    } as Pick<DriveItem, "extension" | "mime_type"> as DriveItem;
    const draft = await createEditorDraft(item, await file.arrayBuffer());
    return draft.contentText;
  }

  return null;
}

export async function buildEditorSavePayload(item: DriveItem, draft: EditorDraft): Promise<EditorSavePayload> {
  if (draft.mode === "text") {
    const plainText = draft.text;
    return {
      plainText,
      contentText: summarizeText(plainText),
      mimeType: item.mime_type ?? "text/plain",
      sizeBytes: new Blob([plainText]).size
    };
  }

  if (draft.mode === "grid") {
    const grid = draft.text
      ? draft.text.split(/\r?\n/).map((row) => row.split(draft.delimiter))
      : [[""]];
    const plainText =
      draft.delimiter === "\t"
        ? grid.map((row) => row.join("\t")).join("\n")
        : gridToCsv(grid);

    return {
      plainText,
      contentText: summarizeText(plainText),
      mimeType: item.mime_type ?? (draft.delimiter === "\t" ? "text/tab-separated-values" : "text/csv"),
      sizeBytes: new Blob([plainText]).size
    };
  }

  if (draft.mode === "docx") {
    const zip = await JSZip.loadAsync(base64ToUint8Array(draft.originalBase64));
    const documentEntry = zip.file("word/document.xml");
    if (!documentEntry) {
      throw new Error("The .docx document structure could not be loaded.");
    }

    const parser = new DOMParser();
    const xml = await documentEntry.async("string");
    const documentXml = parser.parseFromString(xml, "application/xml");
    const serializer = new XMLSerializer();
    const paragraphs = Array.from(documentXml.getElementsByTagNameNS("*", "p"));
    const nextParagraphs = splitParagraphs(draft.text);
    const template = paragraphs.find((paragraph) => paragraph.getElementsByTagNameNS("*", "t").length > 0) ?? paragraphs.at(-1) ?? null;

    nextParagraphs.forEach((nextText, index) => {
      if (paragraphs[index]) {
        setParagraphText(paragraphs[index], nextText);
        return;
      }

      if (template?.parentNode) {
        const clone = template.cloneNode(true) as Element;
        setParagraphText(clone, nextText);
        template.parentNode.appendChild(clone);
      }
    });

    if (nextParagraphs.length < paragraphs.length) {
      paragraphs.slice(nextParagraphs.length).forEach((paragraph) => setParagraphText(paragraph, ""));
    }

    zip.file("word/document.xml", serializer.serializeToString(documentXml));
    const bytes = await zip.generateAsync({ type: "uint8array" });

    return {
      fileBase64: arrayBufferToBase64(bytes),
      contentText: summarizeText(draft.text),
      mimeType:
        item.mime_type ?? "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: bytes.byteLength
    };
  }

  const workbook = XLSX.read(base64ToUint8Array(draft.originalBase64), { type: "array", cellStyles: true });
  const nextSheets: Record<string, XLSX.WorkSheet> = {};
  const nextSheetNames = draft.sheets.map((sheet) => sheet.name);

  draft.sheets.forEach((sheet) => {
    nextSheets[sheet.name] = XLSX.utils.aoa_to_sheet(ensureRows(sheet.rows));
  });

  workbook.SheetNames = nextSheetNames;
  workbook.Sheets = nextSheets;

  const output = XLSX.write(workbook, { type: "array", bookType: "xlsx", cellStyles: true });
  const bytes = output instanceof ArrayBuffer ? new Uint8Array(output) : new Uint8Array(output as number[]);

  return {
    fileBase64: arrayBufferToBase64(bytes),
    contentText: summarizeSheets(draft.sheets),
    mimeType: item.mime_type ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sizeBytes: bytes.byteLength
  };
}

export function draftToGrid(draft: EditorDraft) {
  if (draft.mode === "xlsx") {
    return ensureRows(draft.sheets[draft.activeSheet]?.rows ?? [[""]]);
  }

  if (draft.mode === "grid") {
    return draft.delimiter === "\t"
      ? ensureRows(draft.text.split(/\r?\n/).map((row) => row.split("\t")))
      : ensureRows(csvToGrid(draft.text || "Column A,Column B\n,"));
  }

  return [[""]];
}

export function updateDraftGrid(draft: EditorDraft, nextGrid: string[][]) {
  if (draft.mode === "xlsx") {
    const nextSheets = draft.sheets.map((sheet, index) =>
      index === draft.activeSheet ? { ...sheet, rows: ensureRows(nextGrid) } : sheet
    );
    return {
      ...draft,
      sheets: nextSheets,
      text: summarizeSheets(nextSheets),
      contentText: summarizeSheets(nextSheets)
    } satisfies EditorDraft;
  }

  if (draft.mode === "grid") {
    const nextText =
      draft.delimiter === "\t"
        ? ensureRows(nextGrid).map((row) => row.join("\t")).join("\n")
        : gridToCsv(ensureRows(nextGrid));

    return {
      ...draft,
      text: nextText,
      contentText: summarizeText(nextText)
    } satisfies EditorDraft;
  }

  return draft;
}

export function updateDraftText(draft: EditorDraft, nextText: string) {
  if (draft.mode === "xlsx") {
    return draft;
  }

  return {
    ...draft,
    text: nextText,
    contentText: summarizeText(nextText)
  } satisfies EditorDraft;
}
