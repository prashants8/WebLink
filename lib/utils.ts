import { clsx } from "clsx";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function formatBytes(value: number) {
  if (!value) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  let size = value;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatDate(value: string | null) {
  if (!value) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function getExtension(name: string) {
  const parts = name.split(".");
  return parts.length > 1 ? parts.at(-1)?.toLowerCase() ?? null : null;
}

export function isTextEditable(extension: string | null, mimeType: string | null) {
  return Boolean(
    (extension && ["txt", "md", "json", "js", "ts", "tsx", "jsx", "css", "html"].includes(extension)) ||
      mimeType?.startsWith("text/")
  );
}

export function isSpreadsheet(extension: string | null, mimeType: string | null) {
  return Boolean(
    (extension && ["csv", "tsv"].includes(extension)) ||
      mimeType === "text/csv" ||
      mimeType === "text/tab-separated-values"
  );
}

export function isImage(mimeType: string | null) {
  return Boolean(mimeType?.startsWith("image/"));
}

export function isPdf(mimeType: string | null, extension: string | null) {
  return mimeType === "application/pdf" || extension === "pdf";
}

export function isPreviewable(extension: string | null, mimeType: string | null) {
  return isImage(mimeType) || isPdf(mimeType, extension) || isTextEditable(extension, mimeType) || isSpreadsheet(extension, mimeType);
}

export function csvToGrid(content: string) {
  return content
    .split(/\r?\n/)
    .filter((row) => row.length > 0)
    .map((row) => row.split(","));
}

export function gridToCsv(grid: string[][]) {
  return grid.map((row) => row.map((cell) => cell.replaceAll(",", "\\,")).join(",")).join("\n");
}

export function sanitizeName(name: string) {
  return name.trim().replace(/[\\/:*?"<>|]/g, "-");
}
