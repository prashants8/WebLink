"use client";

import {
  Download,
  ExternalLink,
  FileText,
  Folder,
  History,
  ImageIcon,
  PencilLine,
  Share2,
  Trash2,
  Undo2
} from "lucide-react";
import { isBrowserEditableFile, isDocxFile, isXlsxFile } from "@/lib/file-workspace";
import type { DriveItem, FileVersion } from "@/lib/types";
import { formatBytes, formatDate, isImage, isPdf } from "@/lib/utils";

type DetailsPanelProps = {
  item: DriveItem | null;
  previewUrl: string | null;
  versions: FileVersion[];
  activeView: "dashboard" | "recent" | "trash";
  onDownload: (item: DriveItem) => void;
  onDelete: (item: DriveItem) => void;
  onRestore: (item: DriveItem) => void;
  onShare: (item: DriveItem) => void;
  onEdit: (item: DriveItem) => void;
};

export function DetailsPanel({
  item,
  previewUrl,
  versions,
  activeView,
  onDownload,
  onDelete,
  onRestore,
  onShare,
  onEdit
}: DetailsPanelProps) {
  if (!item) {
    return (
      <aside className="glass-panel flex h-full items-center justify-center p-6 text-center text-sm leading-7 text-slate-400">
        Select a file or folder to view details, preview content, inspect versions, or manage sharing.
      </aside>
    );
  }

  const editable = item.item_type === "file" && isBrowserEditableFile(item.extension, item.mime_type);

  return (
    <aside className="glass-panel scrollbar flex h-full flex-col overflow-auto p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-accent">{item.item_type === "folder" ? "Folder" : "File"}</p>
          <h3 className="mt-2 font-[var(--font-display)] text-2xl font-semibold">{item.name}</h3>
        </div>
        {item.item_type === "folder" ? <Folder className="h-6 w-6 text-accent" /> : <FileText className="h-6 w-6 text-accent" />}
      </div>

      <div className="mt-5 grid gap-3">
        <button
          type="button"
          className="button-secondary justify-start gap-2"
          onClick={() => item.item_type === "file" && onDownload(item)}
        >
          <Download className="h-4 w-4" />
          Download
        </button>
        {editable ? (
          <button type="button" className="button-secondary justify-start gap-2" onClick={() => onEdit(item)}>
            <PencilLine className="h-4 w-4" />
            Edit in browser
          </button>
        ) : null}
        {item.item_type === "file" ? (
          <button type="button" className="button-secondary justify-start gap-2" onClick={() => onShare(item)}>
            <Share2 className="h-4 w-4" />
            Share via link
          </button>
        ) : null}
        {activeView === "trash" ? (
          <button type="button" className="button-secondary justify-start gap-2" onClick={() => onRestore(item)}>
            <Undo2 className="h-4 w-4" />
            Restore
          </button>
        ) : (
          <button type="button" className="button-secondary justify-start gap-2 text-rose-200" onClick={() => onDelete(item)}>
            <Trash2 className="h-4 w-4" />
            Move to trash
          </button>
        )}
      </div>

      <div className="mt-6 space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Size</span>
          <span>{formatBytes(item.size_bytes)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Uploaded</span>
          <span>{formatDate(item.created_at)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Updated</span>
          <span>{formatDate(item.updated_at)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Opened</span>
          <span>{formatDate(item.last_opened_at)}</span>
        </div>
      </div>

      {item.item_type === "file" ? (
        <div className="mt-6 space-y-4">
          <div>
            <p className="text-sm text-slate-500">Preview</p>
            <div className="mt-3 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60">
              {isImage(item.mime_type) && previewUrl ? (
                <img src={previewUrl} alt={item.name} className="h-72 w-full object-cover" />
              ) : null}
              {isPdf(item.mime_type, item.extension) && previewUrl ? (
                <iframe src={previewUrl} className="h-72 w-full" title={item.name} />
              ) : null}
              {editable ? (
                <div className="h-72 overflow-auto whitespace-pre-wrap p-4 text-sm text-slate-300">
                  {item.content_text?.slice(0, 4000) || "No content available yet."}
                </div>
              ) : null}
              {!previewUrl && !editable ? (
                <div className="flex h-72 flex-col items-center justify-center gap-3 text-sm text-slate-500">
                  <ImageIcon className="h-8 w-8" />
                  Browser preview is available for images, PDF, text, spreadsheets, and supported Office files.
                </div>
              ) : null}
            </div>
            {isDocxFile(item.extension, item.mime_type) ? (
              <p className="mt-3 text-xs leading-6 text-slate-500">
                DOCX preview shows extracted document text. Saving keeps the file in `.docx` format.
              </p>
            ) : null}
            {isXlsxFile(item.extension, item.mime_type) ? (
              <p className="mt-3 text-xs leading-6 text-slate-500">
                XLSX preview shows a workbook summary. Editing opens the spreadsheet grid and saves back as `.xlsx`.
              </p>
            ) : null}
            {previewUrl ? (
              <a href={previewUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm text-accent">
                Open preview in a new tab
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>

          <div>
            <div className="mb-3 inline-flex items-center gap-2 text-sm text-slate-400">
              <History className="h-4 w-4" />
              Version history
            </div>
            <div className="space-y-2">
              {versions.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-500">No versions yet.</div>
              ) : null}
              {versions.map((version) => (
                <div key={version.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="font-medium">Version {version.version_no}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(version.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
