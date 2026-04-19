"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Download, LoaderCircle, Plus, Save } from "lucide-react";
import { OnlyOfficeEditor } from "@/components/editors/onlyoffice-editor";
import {
  buildEditorSavePayload,
  createEditorDraft,
  draftToGrid,
  type EditorDraft,
  isDocxFile,
  isXlsxFile,
  updateDraftGrid,
  updateDraftText
} from "@/lib/file-workspace";
import type { DriveItem, SharePermission } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type ShareClientProps = {
  token: string;
  item: DriveItem;
  permission: SharePermission;
  assetUrl: string | null;
};

export function ShareClient({ token, item, permission, assetUrl }: ShareClientProps) {
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editable = permission === "edit" && item.item_type === "file";
  const canUseOnlyOffice =
    Boolean(process.env.NEXT_PUBLIC_ONLYOFFICE_URL) &&
    (isDocxFile(item.extension, item.mime_type) || isXlsxFile(item.extension, item.mime_type));

  useEffect(() => {
    if (canUseOnlyOffice) {
      setDraft(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadDraft() {
      if (!assetUrl && !item.content_text) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const buffer = assetUrl
          ? await fetch(assetUrl).then(async (response) => {
              if (!response.ok) {
                throw new Error("Could not load the shared file contents.");
              }
              return response.arrayBuffer();
            })
          : (() => {
              const encoded = new TextEncoder().encode(item.content_text ?? "");
              return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;
            })();

        const nextDraft = await createEditorDraft(item, buffer);
        if (!cancelled) {
          setDraft(nextDraft);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load this shared file.");
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
  }, [assetUrl, canUseOnlyOffice, item]);

  const grid = useMemo(() => (draft ? draftToGrid(draft) : [[""]]), [draft]);

  async function save() {
    if (!draft || !editable) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = await buildEditorSavePayload(item, draft);
      const response = await fetch("/api/share-edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ token, ...payload })
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Could not save the shared file.");
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the shared file.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-panel mx-auto max-w-6xl p-4 sm:p-6">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-accent">{permission === "edit" ? "Shared for editing" : "Shared for viewing"}</p>
          <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">{item.name}</h1>
          <p className="mt-2 text-sm text-slate-400">Updated {formatDate(item.updated_at)}</p>
          {canUseOnlyOffice ? (
            <p className="mt-2 text-xs leading-6 text-slate-500">
              This shared session uses ONLYOFFICE for live editing while DriveTo keeps the original Office format intact.
            </p>
          ) : isDocxFile(item.extension, item.mime_type) ? (
            <p className="mt-2 text-xs leading-6 text-slate-500">This shared editor writes changes back into the original `.docx` file.</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={`/api/share-download?token=${token}`} className="button-secondary gap-2">
            <Download className="h-4 w-4" />
            Download
          </a>
          {editable && !canUseOnlyOffice ? (
            <button type="button" className="button-primary gap-2" onClick={save} disabled={saving || loading || !draft}>
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-slate-400">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            Loading shared file
          </div>
        ) : null}

        {!loading && error ? (
          <div className="flex items-center gap-3 rounded-3xl border border-rose-400/20 bg-rose-400/10 px-4 py-4 text-sm text-rose-200">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        ) : null}

        {!loading && !error && assetUrl && item.mime_type?.startsWith("image/") ? (
          <img src={assetUrl} alt={item.name} className="max-h-[70vh] w-full rounded-3xl object-contain" />
        ) : null}

        {!loading && !error && assetUrl && item.mime_type === "application/pdf" ? (
          <iframe title={item.name} src={assetUrl} className="h-[75vh] w-full rounded-3xl border border-white/10" />
        ) : null}

        {!loading && !error && canUseOnlyOffice ? (
          <OnlyOfficeEditor item={item} permission={permission} shareToken={token} />
        ) : null}

        {!loading && !error && draft?.mode === "xlsx" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {draft.sheets.map((sheet, index) => (
                <button
                  key={sheet.name}
                  type="button"
                  className={index === draft.activeSheet ? "button-primary" : "button-secondary"}
                  onClick={() => setDraft({ ...draft, activeSheet: index })}
                >
                  {sheet.name}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto rounded-3xl border border-white/10">
              <table className="min-w-full border-collapse">
                <tbody>
                  {grid.map((row, rowIndex) => (
                    <tr key={`${rowIndex}-${row.join("-")}`} className="border-b border-white/10">
                      {row.map((cell, columnIndex) => (
                        <td key={`${rowIndex}-${columnIndex}`} className="min-w-40 border-r border-white/10 p-2">
                          <input
                            className="field bg-transparent"
                            disabled={!editable}
                            value={cell}
                            onChange={(event) => {
                              if (!editable) {
                                return;
                              }

                              const nextGrid = grid.map((gridRow) => [...gridRow]);
                              nextGrid[rowIndex][columnIndex] = event.target.value;
                              setDraft(updateDraftGrid(draft, nextGrid));
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editable ? (
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
            ) : null}
          </div>
        ) : null}

        {!loading && !error && draft?.mode === "grid" ? (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-3xl border border-white/10">
              <table className="min-w-full border-collapse">
                <tbody>
                  {grid.map((row, rowIndex) => (
                    <tr key={`${rowIndex}-${row.join("-")}`} className="border-b border-white/10">
                      {row.map((cell, columnIndex) => (
                        <td key={`${rowIndex}-${columnIndex}`} className="min-w-40 border-r border-white/10 p-2">
                          <input
                            className="field bg-transparent"
                            disabled={!editable}
                            value={cell}
                            onChange={(event) => {
                              if (!editable) {
                                return;
                              }

                              const nextGrid = grid.map((gridRow) => [...gridRow]);
                              nextGrid[rowIndex][columnIndex] = event.target.value;
                              setDraft(updateDraftGrid(draft, nextGrid));
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editable ? (
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
            ) : null}
          </div>
        ) : null}

        {!loading && !error && draft && (draft.mode === "text" || draft.mode === "docx") ? (
          <textarea
            className="h-[70vh] w-full rounded-3xl border border-white/10 bg-slate-950/60 p-5 text-sm leading-7 outline-none"
            value={draft.text}
            readOnly={!editable}
            onChange={(event) => {
              if (!editable) {
                return;
              }
              setDraft(updateDraftText(draft, event.target.value));
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
