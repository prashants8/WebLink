"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  FileText,
  Folder,
  FolderOpen,
  LoaderCircle,
  MoreHorizontal,
  PencilLine,
  RefreshCw,
  Share2,
  Trash2,
  Undo2
} from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { UploadDropzone } from "@/components/dashboard/upload-dropzone";
import { DetailsPanel } from "@/components/dashboard/details-panel";
import { EditorModal } from "@/components/dashboard/editor-modal";
import { ShareDialog } from "@/components/dashboard/share-dialog";
import { USER_FILES_BUCKET } from "@/lib/constants";
import { createUploadContentSummary, type EditorSavePayload, isBrowserEditableFile } from "@/lib/file-workspace";
import { buildBreadcrumbs, getDescendantIds, isDescendant } from "@/lib/drive";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { DriveItem, FileVersion, RealtimePayload, ShareLink, SharePermission } from "@/lib/types";
import {
  cn,
  formatBytes,
  formatDate,
  getExtension,
  isImage,
  isPdf,
  isSpreadsheet,
  isTextEditable,
  sanitizeName
} from "@/lib/utils";

const supabase = createSupabaseBrowserClient();

type DashboardShellProps = {
  userId: string;
  userEmail: string;
  initialItems: DriveItem[];
  initialShares: ShareLink[];
};

type DashboardView = "dashboard" | "recent" | "trash";

function applyRealtimeChange<T extends { id: string }>(current: T[], change: RealtimePayload<T>) {
  if (change.eventType === "DELETE" && change.old) {
    return current.filter((item) => item.id !== change.old!.id);
  }

  if (change.new) {
    const existing = current.find((item) => item.id === change.new!.id);
    if (existing) {
      return current.map((item) => (item.id === change.new!.id ? change.new! : item));
    }

    return [change.new!, ...current];
  }

  return current;
}

export function DashboardShell({ userId, userEmail, initialItems, initialShares }: DashboardShellProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [shares, setShares] = useState(initialShares);
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [currentView, setCurrentView] = useState<DashboardView>("dashboard");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<DriveItem | null>(null);
  const [search, setSearch] = useState("");
  const [uploadActive, setUploadActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editorItem, setEditorItem] = useState<DriveItem | null>(null);
  const [shareItem, setShareItem] = useState<DriveItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const liveItems = items.filter((item) => !item.deleted_at);
  const deletedItems = items.filter((item) => Boolean(item.deleted_at));
  const breadcrumbs = buildBreadcrumbs(items, currentFolderId);

  const visibleItems = useMemo(() => {
    if (currentView === "trash") {
      return deletedItems.filter(
        (item) =>
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.content_text?.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (currentView === "recent") {
      return [...liveItems]
        .filter(
          (item) =>
            item.item_type === "file" &&
            (item.name.toLowerCase().includes(search.toLowerCase()) ||
              item.content_text?.toLowerCase().includes(search.toLowerCase()))
        )
        .sort(
          (left, right) =>
            new Date(right.last_opened_at ?? right.updated_at).getTime() -
            new Date(left.last_opened_at ?? left.updated_at).getTime()
        )
        .slice(0, 18);
    }

    const scope = search
      ? liveItems.filter(
          (item) =>
            item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.content_text?.toLowerCase().includes(search.toLowerCase())
        )
      : liveItems.filter((item) => item.parent_id === currentFolderId);

    return [...scope].sort((left, right) => {
      if (left.item_type !== right.item_type) {
        return left.item_type === "folder" ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
  }, [currentFolderId, currentView, deletedItems, liveItems, search]);

  useEffect(() => {
    const driveChannel = (supabase.channel(`drive-items-${userId}`) as any)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drive_items", filter: `user_id=eq.${userId}` },
        (payload: RealtimePayload<DriveItem>) => {
          const change = payload as unknown as RealtimePayload<DriveItem>;
          setItems((current) => applyRealtimeChange(current, change));
        }
      )
      .subscribe();

    const shareChannel = (supabase.channel(`share-links-${userId}`) as any)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "share_links", filter: `user_id=eq.${userId}` },
        (payload: RealtimePayload<ShareLink>) => {
          const change = payload as unknown as RealtimePayload<ShareLink>;
          setShares((current) => applyRealtimeChange(current, change));
        }
      )
      .subscribe();

    const versionChannel = (supabase.channel(`file-versions-${userId}`) as any)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "file_versions", filter: `user_id=eq.${userId}` },
        (payload: RealtimePayload<FileVersion>) => {
          const change = payload as unknown as RealtimePayload<FileVersion>;
          setVersions((current) => {
            const activeItemId = selectedItem?.id;
            const relevantId = change.new?.item_id ?? change.old?.item_id ?? null;

            if (!activeItemId || relevantId !== activeItemId) {
              return current;
            }

            return applyRealtimeChange(current, change).sort((left, right) => right.version_no - left.version_no);
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(driveChannel);
      void supabase.removeChannel(shareChannel);
      void supabase.removeChannel(versionChannel);
    };
  }, [selectedItem?.id, userId]);

  useEffect(() => {
    if (selectedItem) {
      const nextSelectedItem = items.find((item) => item.id === selectedItem.id);
      if (nextSelectedItem && nextSelectedItem !== selectedItem) {
        setSelectedItem(nextSelectedItem);
      }
    }

    if (editorItem) {
      const nextEditorItem = items.find((item) => item.id === editorItem.id);
      if (nextEditorItem && nextEditorItem !== editorItem) {
        setEditorItem(nextEditorItem);
      }
    }

    if (shareItem) {
      const nextShareItem = items.find((item) => item.id === shareItem.id);
      if (nextShareItem && nextShareItem !== shareItem) {
        setShareItem(nextShareItem);
      }
    }
  }, [editorItem, items, selectedItem, shareItem]);

  useEffect(() => {
    if (!selectedItem || selectedItem.item_type !== "file") {
      setPreviewUrl(null);
      return;
    }

    const item = selectedItem;
    let cancelled = false;

    async function loadPreview() {
      if (!item.storage_path || (!isImage(item.mime_type) && !isPdf(item.mime_type, item.extension))) {
        setPreviewUrl(null);
        return;
      }

      const { data } = await supabase.storage.from(USER_FILES_BUCKET).createSignedUrl(item.storage_path, 60 * 10);
      if (!cancelled) {
        setPreviewUrl(data?.signedUrl ?? null);
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [selectedItem]);

  useEffect(() => {
    async function loadVersions() {
      if (!selectedItem || selectedItem.item_type !== "file") {
        setVersions([]);
        return;
      }

      const { data } = await supabase
        .from("file_versions")
        .select("*")
        .eq("item_id", selectedItem.id)
        .order("version_no", { ascending: false });

      setVersions(data ?? []);
    }

    void loadVersions();
  }, [selectedItem]);

  async function saveEditedFile(item: DriveItem, payload: EditorSavePayload) {
    const encoded = payload.fileBase64
      ? new Blob([Uint8Array.from(atob(payload.fileBase64), (char) => char.charCodeAt(0))], {
          type: payload.mimeType
        })
      : new Blob([payload.plainText ?? ""], { type: payload.mimeType });
    const storagePath = item.storage_path ?? `${userId}/${crypto.randomUUID()}-${item.name}`;

    const { error: uploadError } = await supabase.storage.from(USER_FILES_BUCKET).upload(storagePath, encoded, {
      upsert: true,
      contentType: payload.mimeType
    });

    if (uploadError) {
      throw uploadError;
    }

    const nextVersion = (versions[0]?.version_no ?? 0) + 1;

    const { error: itemError } = await supabase
      .from("drive_items")
      .update({
        content_text: payload.contentText,
        storage_path: storagePath,
        size_bytes: payload.sizeBytes,
        updated_at: new Date().toISOString(),
        last_opened_at: new Date().toISOString()
      })
      .eq("id", item.id);

    if (itemError) {
      throw itemError;
    }

    const { error: versionError } = await supabase.from("file_versions").insert({
      item_id: item.id,
      user_id: userId,
      version_no: nextVersion,
      storage_path: storagePath,
      content_text: payload.contentText,
      size_bytes: payload.sizeBytes
    });

    if (versionError) {
      throw versionError;
    }
  }

  async function createFolder() {
    const name = sanitizeName(window.prompt("Folder name", "New folder") ?? "");
    if (!name) {
      return;
    }

    setBusy(true);
    await supabase.from("drive_items").insert({
      user_id: userId,
      parent_id: currentView === "dashboard" ? currentFolderId : null,
      name,
      item_type: "folder",
      size_bytes: 0
    });
    setBusy(false);
  }

  async function createDocument() {
    const name = sanitizeName(window.prompt("Document name", "Untitled.md") ?? "");
    if (!name) {
      return;
    }

    setBusy(true);
    const extension = getExtension(name) ?? "md";
    const mimeType = extension === "json" ? "application/json" : "text/plain";
    const content = `# ${name.replace(/\.[^.]+$/, "")}\n\nStart writing here.`;
    const path = `${userId}/${crypto.randomUUID()}-${name}`;
    const blob = new Blob([content], { type: mimeType });

    await supabase.storage.from(USER_FILES_BUCKET).upload(path, blob, { contentType: mimeType, upsert: true });
    const { data, error } = await supabase
      .from("drive_items")
      .insert({
        user_id: userId,
        parent_id: currentView === "dashboard" ? currentFolderId : null,
        name,
        item_type: "file",
        storage_path: path,
        mime_type: mimeType,
        extension,
        size_bytes: blob.size,
        content_text: content,
        last_opened_at: new Date().toISOString()
      })
      .select()
      .single();

    if (!error && data) {
      await supabase.from("file_versions").insert({
        item_id: data.id,
        user_id: userId,
        version_no: 1,
        storage_path: path,
        content_text: content,
        size_bytes: blob.size
      });
      setSelectedItem(data);
      setEditorItem(data);
    }
    setBusy(false);
  }

  async function createSheet() {
    const name = sanitizeName(window.prompt("Sheet name", "Untitled.csv") ?? "");
    if (!name) {
      return;
    }

    setBusy(true);
    const content = "Task,Status,Owner\nPlan,In progress,You";
    const path = `${userId}/${crypto.randomUUID()}-${name}`;
    const blob = new Blob([content], { type: "text/csv" });

    await supabase.storage.from(USER_FILES_BUCKET).upload(path, blob, { contentType: "text/csv", upsert: true });
    const { data, error } = await supabase
      .from("drive_items")
      .insert({
        user_id: userId,
        parent_id: currentView === "dashboard" ? currentFolderId : null,
        name,
        item_type: "file",
        storage_path: path,
        mime_type: "text/csv",
        extension: "csv",
        size_bytes: blob.size,
        content_text: content,
        last_opened_at: new Date().toISOString()
      })
      .select()
      .single();

    if (!error && data) {
      await supabase.from("file_versions").insert({
        item_id: data.id,
        user_id: userId,
        version_no: 1,
        storage_path: path,
        content_text: content,
        size_bytes: blob.size
      });
      setSelectedItem(data);
      setEditorItem(data);
    }
    setBusy(false);
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setBusy(true);
    setUploadNotice(null);

    let uploadedCount = 0;
    const failures: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const storagePath = `${userId}/${crypto.randomUUID()}-${file.name}`;
        const extension = getExtension(file.name);

        const { error: uploadError } = await supabase.storage.from(USER_FILES_BUCKET).upload(storagePath, file, {
          upsert: false,
          contentType: file.type || "application/octet-stream"
        });

        if (uploadError) {
          failures.push(`${file.name}: ${uploadError.message}`);
          continue;
        }

        let contentText: string | null = null;

        try {
          contentText = await createUploadContentSummary(file);
        } catch (summaryError) {
          failures.push(
            `${file.name}: ${summaryError instanceof Error ? summaryError.message : "Could not prepare file preview."}`
          );
        }

        const { data, error: insertError } = await supabase
          .from("drive_items")
          .insert({
            user_id: userId,
            parent_id: currentView === "dashboard" ? currentFolderId : null,
            name: file.name,
            item_type: "file",
            storage_path: storagePath,
            mime_type: file.type || "application/octet-stream",
            extension,
            size_bytes: file.size,
            content_text: contentText
          })
          .select()
          .single();

        if (insertError || !data) {
          failures.push(`${file.name}: ${insertError?.message ?? "Could not save file metadata."}`);
          continue;
        }

        setItems((current) => {
          const withoutDuplicate = current.filter((item) => item.id !== data.id);
          return [data, ...withoutDuplicate];
        });

        const { error: versionError } = await supabase.from("file_versions").insert({
          item_id: data.id,
          user_id: userId,
          version_no: 1,
          storage_path: storagePath,
          content_text: contentText,
          size_bytes: file.size
        });

        if (versionError) {
          failures.push(`${file.name}: ${versionError.message}`);
        }

        uploadedCount += 1;
      }
    } finally {
      setBusy(false);
    }

    if (uploadedCount > 0 && failures.length === 0) {
      setUploadNotice(`${uploadedCount} file${uploadedCount === 1 ? "" : "s"} uploaded successfully.`);
      return;
    }

    if (uploadedCount > 0 && failures.length > 0) {
      setUploadNotice(
        `${uploadedCount} file${uploadedCount === 1 ? "" : "s"} uploaded. Some files failed: ${failures.join(" | ")}`
      );
      return;
    }

    setUploadNotice(failures[0] ?? "Upload failed. Please try again.");
  }

  async function markOpened(item: DriveItem) {
    await supabase.from("drive_items").update({ last_opened_at: new Date().toISOString() }).eq("id", item.id);
  }

  async function handleDownload(item: DriveItem) {
    if (!item.storage_path) {
      return;
    }

    await markOpened(item);
    const { data } = await supabase.storage.from(USER_FILES_BUCKET).createSignedUrl(item.storage_path, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function handleDelete(item: DriveItem) {
    setBusy(true);
    const targetIds = item.item_type === "folder" ? getDescendantIds(items, item.id) : [item.id];
    await supabase.from("drive_items").update({ deleted_at: new Date().toISOString() }).in("id", targetIds);
    if (selectedItem?.id && targetIds.includes(selectedItem.id)) {
      setSelectedItem(null);
    }
    setBusy(false);
  }

  async function handleRestore(item: DriveItem) {
    setBusy(true);
    const targetIds = item.item_type === "folder" ? getDescendantIds(items, item.id) : [item.id];
    await supabase.from("drive_items").update({ deleted_at: null }).in("id", targetIds);
    setBusy(false);
  }

  async function handleShareCreate(permission: SharePermission) {
    if (!shareItem) {
      return;
    }

    await supabase.from("share_links").insert({
      user_id: userId,
      item_id: shareItem.id,
      token: crypto.randomUUID().replaceAll("-", ""),
      permission
    });
  }

  async function handleShareToggle(linkId: string, isActive: boolean) {
    await supabase.from("share_links").update({ is_active: isActive }).eq("id", linkId);
  }

  async function handleOpen(item: DriveItem) {
    setSelectedItem(item);
    if (item.item_type === "folder") {
      setCurrentFolderId(item.id);
      setCurrentView("dashboard");
      return;
    }
    await markOpened(item);
  }

  async function moveItem(itemId: string, newParentId: string | null) {
    const movingItem = items.find((item) => item.id === itemId);
    if (!movingItem || movingItem.id === newParentId) {
      return;
    }

    if (movingItem.item_type === "folder" && newParentId && isDescendant(items, movingItem.id, newParentId)) {
      return;
    }

    await supabase.from("drive_items").update({ parent_id: newParentId }).eq("id", itemId);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/signin");
    router.refresh();
  }

  return (
    <>
      <div className="grid min-h-screen gap-4 bg-canvas p-3 lg:grid-cols-[300px_minmax(0,1fr)_340px] lg:gap-6 lg:p-4">
        <Sidebar
          currentView={currentView}
          search={search}
          onSearchChange={setSearch}
          onViewChange={(value) => {
            setCurrentView(value);
            if (value !== "dashboard") {
              setCurrentFolderId(null);
            }
          }}
          onCreateFolder={createFolder}
          onCreateDoc={createDocument}
          onCreateSheet={createSheet}
          onLogout={handleLogout}
        />

        <main className="glass-panel flex min-h-[calc(100vh-2rem)] flex-col overflow-hidden p-5">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm text-accent">
                {currentView === "dashboard" ? "Dashboard" : currentView === "recent" ? "Recent files" : "Trash"}
              </p>
              <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">
                {currentView === "dashboard"
                  ? breadcrumbs.length
                    ? breadcrumbs.at(-1)?.name
                    : "My drive"
                  : currentView === "recent"
                    ? "Recent activity"
                    : "Trash recovery"}
              </h1>
              <p className="mt-2 text-sm text-slate-400">Signed in as {userEmail}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {breadcrumbs.length > 0 && currentView === "dashboard" ? (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setCurrentFolderId(breadcrumbs.at(-1)?.parent_id ?? null)}
                >
                  Back
                </button>
              ) : null}
              <button type="button" className="button-secondary gap-2" onClick={() => router.refresh()}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              {busy ? (
                <div className="inline-flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Working
                </div>
              ) : null}
            </div>
          </div>

          {currentView === "dashboard" ? (
            <div className="mt-5">
              <UploadDropzone isActive={uploadActive} onDragStateChange={setUploadActive} onFilesSelected={handleUpload} />
              {uploadNotice ? (
                <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                  {uploadNotice}
                </div>
              ) : null}
            </div>
          ) : null}

          {breadcrumbs.length > 0 && currentView === "dashboard" ? (
            <div
              className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 p-3"
              onDragOver={(event) => event.preventDefault()}
              onDrop={async (event) => {
                event.preventDefault();
                if (draggedItemId) {
                  await moveItem(draggedItemId, currentFolderId);
                  setDraggedItemId(null);
                }
              }}
            >
              <button type="button" className="button-ghost" onClick={() => setCurrentFolderId(null)}>
                Root
              </button>
              {breadcrumbs.map((crumb) => (
                <button key={crumb.id} type="button" className="button-ghost" onClick={() => setCurrentFolderId(crumb.id)}>
                  / {crumb.name}
                </button>
              ))}
            </div>
          ) : null}

          <div className="scrollbar mt-5 flex-1 overflow-auto pr-1">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleItems.map((item) => {
                const editable = item.item_type === "file" && isBrowserEditableFile(item.extension, item.mime_type);

                return (
                  <article
                    key={item.id}
                    className={cn(
                      "group rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-white/20 hover:bg-white/10",
                      selectedItem?.id === item.id && "border-accent/40 bg-accent/10"
                    )}
                    draggable={currentView === "dashboard"}
                    onDragStart={() => setDraggedItemId(item.id)}
                    onDragOver={(event) => {
                      if (item.item_type === "folder") {
                        event.preventDefault();
                      }
                    }}
                    onDrop={async (event) => {
                      event.preventDefault();
                      if (item.item_type === "folder" && draggedItemId) {
                        await moveItem(draggedItemId, item.id);
                        setDraggedItemId(null);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <button type="button" className="text-left" onClick={() => handleOpen(item)}>
                        <div className="mb-4 inline-flex rounded-2xl bg-white/10 p-3 text-accent">
                          {item.item_type === "folder" ? <FolderOpen className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                        </div>
                        <h3 className="font-semibold text-white">{item.name}</h3>
                        <p className="mt-2 text-sm text-slate-400">
                          {item.item_type === "folder" ? "Folder" : item.mime_type || item.extension || "File"}
                        </p>
                      </button>
                      <button
                        type="button"
                        className="button-ghost opacity-50 transition group-hover:opacity-100"
                        onClick={() => setSelectedItem(item)}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-6 grid gap-2 text-sm text-slate-400">
                      <div className="flex items-center justify-between">
                        <span>Size</span>
                        <span>{formatBytes(item.size_bytes)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Updated</span>
                        <span>{formatDate(item.updated_at)}</span>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {item.item_type === "file" ? (
                        <button type="button" className="button-secondary gap-2" onClick={() => handleDownload(item)}>
                          <Download className="h-4 w-4" />
                          Download
                        </button>
                      ) : null}
                      {editable ? (
                        <button type="button" className="button-secondary gap-2" onClick={() => setEditorItem(item)}>
                          <PencilLine className="h-4 w-4" />
                          Edit
                        </button>
                      ) : null}
                      {item.item_type === "file" ? (
                        <button type="button" className="button-secondary gap-2" onClick={() => setShareItem(item)}>
                          <Share2 className="h-4 w-4" />
                          Share
                        </button>
                      ) : null}
                      {currentView === "trash" ? (
                        <button type="button" className="button-secondary gap-2" onClick={() => handleRestore(item)}>
                          <Undo2 className="h-4 w-4" />
                          Restore
                        </button>
                      ) : (
                        <button type="button" className="button-secondary gap-2 text-rose-200" onClick={() => handleDelete(item)}>
                          <Trash2 className="h-4 w-4" />
                          Trash
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {visibleItems.length === 0 ? (
              <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Folder className="h-6 w-6" />
                </div>
                <h3 className="font-[var(--font-display)] text-2xl font-semibold text-white">Nothing here yet</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Upload files, create folders, draft documents, or build CSV sheets to populate this workspace.
                </p>
              </div>
            ) : null}
          </div>
        </main>

        <DetailsPanel
          item={selectedItem}
          previewUrl={previewUrl}
          versions={versions}
          activeView={currentView}
          onDownload={handleDownload}
          onDelete={handleDelete}
          onRestore={handleRestore}
          onShare={(item) => setShareItem(item)}
          onEdit={(item) => setEditorItem(item)}
        />
      </div>

      <EditorModal
        item={editorItem}
        open={Boolean(editorItem)}
        onClose={() => setEditorItem(null)}
        onSave={async (payload) => {
          if (!editorItem) {
            return;
          }
          await saveEditedFile(editorItem, payload);
          setEditorItem(null);
        }}
      />

      <ShareDialog
        item={shareItem}
        links={shares}
        open={Boolean(shareItem)}
        onClose={() => setShareItem(null)}
        onCreateLink={handleShareCreate}
        onToggleLink={handleShareToggle}
      />
    </>
  );
}
