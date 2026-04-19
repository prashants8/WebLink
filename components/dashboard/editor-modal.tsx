"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bold,
  ChevronDown,
  FileText,
  Italic,
  LoaderCircle,
  Plus,
  Save,
  Sheet,
  Type,
  Underline,
  X
} from "lucide-react";
import { OnlyOfficeEditor } from "@/components/editors/onlyoffice-editor";
import { USER_FILES_BUCKET } from "@/lib/constants";
import {
  buildEditorSavePayload,
  createEditorDraft,
  draftToGrid,
  type EditorDraft,
  type EditorSavePayload,
  isDocxFile,
  isXlsxFile,
  updateDraftGrid,
  updateDraftText
} from "@/lib/file-workspace";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { DriveItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const supabase = createSupabaseBrowserClient();

type EditorModalProps = {
  item: DriveItem | null;
  open: boolean;
  onClose: () => void;
  onSave: (payload: EditorSavePayload) => Promise<void>;
};

type CellPointer = {
  row: number;
  column: number;
};

const DOCUMENT_FONTS = [
  { label: "Aptos", value: "Aptos, Calibri, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Mono", value: "'JetBrains Mono', monospace" }
] as const;

const DOCUMENT_SCALES = [90, 100, 110, 125];
const DOCUMENT_SIZES = [13, 15, 17];

function getColumnLabel(index: number) {
  let value = index + 1;
  let label = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }

  return label;
}

function getCellReference(pointer: CellPointer) {
  return `${getColumnLabel(pointer.column)}${pointer.row + 1}`;
}

function countWords(text: string) {
  const words = text.trim().match(/\S+/g);
  return words?.length ?? 0;
}

function countParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean).length;
}

function ToolbarChip({
  children,
  active = false
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-2xl border px-3 text-sm transition",
        active
          ? "border-sky-300/40 bg-sky-300/15 text-sky-100"
          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

export function EditorModal({ item, open, onClose, onSave }: EditorModalProps) {
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<CellPointer>({ row: 0, column: 0 });
  const [docFont, setDocFont] = useState<(typeof DOCUMENT_FONTS)[number]["value"]>(DOCUMENT_FONTS[0].value);
  const [docScale, setDocScale] = useState(100);
  const [docSize, setDocSize] = useState(15);
  const canUseOnlyOffice =
    Boolean(process.env.NEXT_PUBLIC_ONLYOFFICE_URL) &&
    Boolean(item && (isDocxFile(item.extension, item.mime_type) || isXlsxFile(item.extension, item.mime_type)));

  useEffect(() => {
    if (!open || !item) {
      setDraft(null);
      setError(null);
      return;
    }

    if (canUseOnlyOffice) {
      setDraft(null);
      setError(null);
      setLoading(false);
      return;
    }

    const currentItem = item;
    let cancelled = false;

    async function loadDraft() {
      setLoading(true);
      setError(null);

      try {
        let arrayBuffer: ArrayBuffer;

        if (currentItem.storage_path) {
          const { data, error: downloadError } = await supabase.storage
            .from(USER_FILES_BUCKET)
            .download(currentItem.storage_path);

          if (downloadError) {
            throw downloadError;
          }

          arrayBuffer = await data.arrayBuffer();
        } else {
          const encoded = new TextEncoder().encode(currentItem.content_text ?? "");
          arrayBuffer = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;
        }

        const nextDraft = await createEditorDraft(currentItem, arrayBuffer);
        if (!cancelled) {
          setDraft(nextDraft);
          setSelectedCell({ row: 0, column: 0 });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not open this file in the browser.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDraft();

    return () => {
      cancelled = true;
    };
  }, [canUseOnlyOffice, item, open]);

  if (!open || !item) {
    return null;
  }

  const activeItem = item;
  const grid = draft ? draftToGrid(draft) : [[""]];
  const activeCellValue = grid[selectedCell.row]?.[selectedCell.column] ?? "";
  const isSpreadsheetWorkspace = draft?.mode === "xlsx" || draft?.mode === "grid";
  const officeNote = canUseOnlyOffice
    ? "ONLYOFFICE is handling this document inside the existing DriveTo workspace, with real-time collaboration and version snapshots saved back to Supabase."
    : isDocxFile(activeItem.extension, activeItem.mime_type)
      ? "This editor writes changes back into the original .docx package, but advanced Word layout features may not round-trip perfectly."
      : draft?.mode === "xlsx"
        ? "This editor preserves the workbook as .xlsx while focusing on cell content editing."
        : null;

  async function handleSave() {
    if (!draft) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = await buildEditorSavePayload(activeItem, draft);
      await onSave(payload);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this file.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur sm:p-4">
      <div className="glass-panel flex h-[94vh] w-full max-w-[1400px] flex-col overflow-hidden">
        <div className="border-b border-white/10 bg-slate-950/70 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-accent">
                  {isSpreadsheetWorkspace ? "Spreadsheet workspace" : "Document workspace"}
                </p>
                <h3 className="truncate font-[var(--font-display)] text-2xl font-semibold sm:text-3xl">
                  {activeItem.name}
                </h3>
                {officeNote ? <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-400">{officeNote}</p> : null}
              </div>

              <div className="flex items-center gap-3">
                {!canUseOnlyOffice ? (
                  <button
                    type="button"
                    className="button-secondary gap-2"
                    onClick={handleSave}
                    disabled={saving || loading || !draft}
                  >
                    {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                ) : null}
                <button type="button" className="button-ghost" onClick={onClose}>
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {!loading && !error && !canUseOnlyOffice ? (
              <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-white/10 bg-white/5 p-2">
                {isSpreadsheetWorkspace ? (
                  <>
                    <ToolbarChip active>
                      <Sheet className="h-4 w-4" />
                      {draft?.mode === "xlsx" ? "Workbook" : "Sheet"}
                    </ToolbarChip>
                    <ToolbarChip>
                      <span className="font-mono text-xs">{getCellReference(selectedCell)}</span>
                    </ToolbarChip>
                    <div className="flex min-w-[260px] flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">fx</span>
                      <input
                        className="w-full bg-transparent text-sm text-white outline-none"
                        value={activeCellValue}
                        onChange={(event) => {
                          if (!draft || !isSpreadsheetWorkspace) {
                            return;
                          }

                          const nextGrid = grid.map((row) => [...row]);
                          nextGrid[selectedCell.row][selectedCell.column] = event.target.value;
                          setDraft(updateDraftGrid(draft, nextGrid));
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <ToolbarChip active>
                      <FileText className="h-4 w-4" />
                      Page
                    </ToolbarChip>
                    <label className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-slate-300">
                      <Type className="h-4 w-4" />
                      <select
                        value={docFont}
                        onChange={(event) =>
                          setDocFont(event.target.value as (typeof DOCUMENT_FONTS)[number]["value"])
                        }
                        className="bg-transparent outline-none"
                      >
                        {DOCUMENT_FONTS.map((font) => (
                          <option key={font.label} value={font.value} className="bg-slate-950 text-white">
                            {font.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-slate-300">
                      <span>{docSize}px</span>
                      <select
                        value={docSize}
                        onChange={(event) => setDocSize(Number(event.target.value))}
                        className="bg-transparent outline-none"
                      >
                        {DOCUMENT_SIZES.map((size) => (
                          <option key={size} value={size} className="bg-slate-950 text-white">
                            {size}px
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-slate-300">
                      <span>{docScale}%</span>
                      <select
                        value={docScale}
                        onChange={(event) => setDocScale(Number(event.target.value))}
                        className="bg-transparent outline-none"
                      >
                        {DOCUMENT_SCALES.map((scale) => (
                          <option key={scale} value={scale} className="bg-slate-950 text-white">
                            {scale}%
                          </option>
                        ))}
                      </select>
                    </label>
                    <ToolbarChip>
                      <Bold className="h-4 w-4" />
                    </ToolbarChip>
                    <ToolbarChip>
                      <Italic className="h-4 w-4" />
                    </ToolbarChip>
                    <ToolbarChip>
                      <Underline className="h-4 w-4" />
                    </ToolbarChip>
                    <div className="ml-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
                      <span>{countWords(draft?.mode === "text" || draft?.mode === "docx" ? draft.text : "")} words</span>
                      <span>{countParagraphs(draft?.mode === "text" || draft?.mode === "docx" ? draft.text : "")} paragraphs</span>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="scrollbar flex-1 overflow-auto bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.08),transparent_30%),linear-gradient(180deg,rgba(10,14,32,0.96),rgba(5,8,22,0.98))] p-3 sm:p-6">
          {loading ? (
            <div className="flex h-full min-h-[50vh] items-center justify-center gap-3 text-sm text-slate-400">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              Loading file workspace
            </div>
          ) : null}

          {!loading && error ? (
            <div className="mx-auto max-w-3xl rounded-3xl border border-rose-400/20 bg-rose-400/10 px-4 py-4 text-sm text-rose-200">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                {error}
              </div>
            </div>
          ) : null}

          {!loading && !error && isSpreadsheetWorkspace && draft ? (
            <div className="space-y-4">
              {draft.mode === "xlsx" ? (
                <div className="flex flex-wrap items-center gap-2">
                  {draft.sheets.map((sheet, index) => (
                    <button
                      key={sheet.name}
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm transition",
                        index === draft.activeSheet
                          ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-100"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                      )}
                      onClick={() => {
                        setDraft({ ...draft, activeSheet: index });
                        setSelectedCell({ row: 0, column: 0 });
                      }}
                    >
                      {sheet.name}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="overflow-auto rounded-[28px] border border-white/10 bg-[#0d1228] shadow-[0_20px_60px_rgba(15,23,42,0.45)]">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead className="sticky top-0 z-20">
                    <tr>
                      <th className="sticky left-0 z-30 h-12 min-w-14 border-b border-r border-white/10 bg-[#121934]" />
                      {Array.from({ length: grid[0]?.length ?? 1 }, (_, columnIndex) => (
                        <th
                          key={`col-${columnIndex}`}
                          className={cn(
                            "h-12 min-w-40 border-b border-r border-white/10 bg-[#121934] px-3 text-left text-xs font-semibold tracking-[0.18em] text-slate-400",
                            selectedCell.column === columnIndex && "bg-emerald-400/15 text-emerald-100"
                          )}
                        >
                          {getColumnLabel(columnIndex)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.map((row, rowIndex) => (
                      <tr key={`${rowIndex}-${row.join("-")}`}>
                        <th
                          className={cn(
                            "sticky left-0 z-10 min-w-14 border-b border-r border-white/10 bg-[#121934] px-3 py-3 text-xs font-semibold text-slate-400",
                            selectedCell.row === rowIndex && "bg-emerald-400/15 text-emerald-100"
                          )}
                        >
                          {rowIndex + 1}
                        </th>
                        {row.map((cell, columnIndex) => {
                          const active = selectedCell.row === rowIndex && selectedCell.column === columnIndex;

                          return (
                            <td
                              key={`${rowIndex}-${columnIndex}`}
                              className={cn(
                                "border-b border-r border-white/10 bg-[#0f1632] px-0 align-top transition",
                                active && "bg-emerald-400/8"
                              )}
                            >
                              <input
                                className={cn(
                                  "h-12 w-full min-w-40 bg-transparent px-3 text-sm text-white outline-none transition",
                                  active && "ring-2 ring-inset ring-emerald-300/60"
                                )}
                                value={cell}
                                onFocus={() => setSelectedCell({ row: rowIndex, column: columnIndex })}
                                onChange={(event) => {
                                  const nextGrid = grid.map((gridRow) => [...gridRow]);
                                  nextGrid[rowIndex][columnIndex] = event.target.value;
                                  setDraft(updateDraftGrid(draft, nextGrid));
                                  setSelectedCell({ row: rowIndex, column: columnIndex });
                                }}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="button-secondary gap-2"
                  onClick={() =>
                    setDraft(updateDraftGrid(draft, [...grid, Array.from({ length: grid[0]?.length ?? 1 }, () => "")]))
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add row
                </button>
                <button
                  type="button"
                  className="button-secondary gap-2"
                  onClick={() => setDraft(updateDraftGrid(draft, grid.map((row) => [...row, ""])))}
                >
                  <Plus className="h-4 w-4" />
                  Add column
                </button>
              </div>
            </div>
          ) : null}

          {!loading && !error && draft && (draft.mode === "text" || draft.mode === "docx") ? (
            <div className="mx-auto max-w-5xl">
              <div className="rounded-[34px] border border-white/10 bg-slate-900/70 p-3 shadow-[0_30px_80px_rgba(2,6,23,0.45)] sm:p-6">
                <div className="mx-auto max-w-4xl rounded-[30px] border border-slate-200/70 bg-white text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.14)]">
                  <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 text-xs uppercase tracking-[0.28em] text-slate-400 sm:px-10">
                    Page 1
                  </div>

                  <div className="overflow-x-auto border-b border-slate-200 bg-slate-50/80 px-6 py-3 sm:px-10">
                    <div className="flex min-w-[640px] items-center justify-between text-[10px] font-medium tracking-[0.18em] text-slate-400">
                      {Array.from({ length: 16 }, (_, index) => (
                        <span key={index}>{index + 1}</span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-4 sm:p-8">
                    <div
                      className="mx-auto min-h-[68vh] origin-top overflow-hidden rounded-[28px] border border-slate-200 bg-white"
                      style={{ maxWidth: `${Math.round(820 * (docScale / 100))}px` }}
                    >
                      <textarea
                        className="h-full min-h-[68vh] w-full resize-none bg-transparent px-6 py-8 text-slate-900 outline-none sm:px-12 sm:py-12"
                        style={{
                          fontFamily: docFont,
                          fontSize: `${docSize}px`,
                          lineHeight: 1.95
                        }}
                        value={draft.text}
                        onChange={(event) => setDraft(updateDraftText(draft, event.target.value))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!loading && !error && canUseOnlyOffice ? (
            <div className="h-full min-h-[72vh]">
              <OnlyOfficeEditor item={activeItem} />
            </div>
          ) : null}
        </div>

        {!loading && !error && draft && !canUseOnlyOffice ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-slate-950/70 px-4 py-3 text-xs text-slate-400 sm:px-6">
            <div className="flex items-center gap-4">
              <span>{isSpreadsheetWorkspace ? "Spreadsheet-style workspace" : "Document-style workspace"}</span>
              <span>{draft.mode === "xlsx" ? "Workbook" : draft.mode === "docx" ? "DOCX" : "Editable content"}</span>
            </div>
            <div className="flex items-center gap-4">
              {isSpreadsheetWorkspace ? <span>{getCellReference(selectedCell)}</span> : null}
              {!isSpreadsheetWorkspace ? <span>{countWords(draft.text)} words</span> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
