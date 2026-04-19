"use client";

import { useEffect, useMemo, useState } from "react";
import type { IConfig } from "@onlyoffice/document-editor-react";
import { DocumentEditor } from "@onlyoffice/document-editor-react";
import { AlertCircle, CheckCircle2, Cloud, LoaderCircle, Users } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { DriveItem, SharePermission } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const supabase = createSupabaseBrowserClient();

type OnlyOfficeConfigResponse = {
  canEdit: boolean;
  config: IConfig;
  documentServerUrl: string;
  lastEditedAt: string;
  permission: SharePermission;
  source: "drive" | "share";
};

type PresenceUser = {
  color: string;
  id: string;
  name: string;
};

type OnlyOfficeEditorProps = {
  item: DriveItem;
  permission?: SharePermission;
  shareToken?: string;
};

const PRESENCE_COLORS = ["#38bdf8", "#22c55e", "#f97316", "#f43f5e", "#a78bfa", "#facc15"];

function getPresenceColor(id: string) {
  const seed = Array.from(id).reduce((total, character) => total + character.charCodeAt(0), 0);
  return PRESENCE_COLORS[seed % PRESENCE_COLORS.length];
}

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "D"
  );
}

function getGuestIdentity(shareToken: string) {
  const storageKey = `driveto-share-identity:${shareToken}`;
  const fallbackId = `guest-${crypto.randomUUID()}`;
  const fallbackName = `Guest ${fallbackId.slice(-4).toUpperCase()}`;

  if (typeof window === "undefined") {
    return { id: fallbackId, name: fallbackName };
  }

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as { id?: string; name?: string };
      if (parsed.id && parsed.name) {
        return { id: parsed.id, name: parsed.name };
      }
    }
  } catch {
    return { id: fallbackId, name: fallbackName };
  }

  const nextIdentity = { id: fallbackId, name: fallbackName };
  window.localStorage.setItem(storageKey, JSON.stringify(nextIdentity));
  return nextIdentity;
}

function flattenPresence(state: Record<string, Array<{ color?: string; id?: string; name?: string }>>) {
  const users = Object.values(state)
    .flat()
    .map((entry) => ({
      color: entry.color ?? "#38bdf8",
      id: entry.id ?? crypto.randomUUID(),
      name: entry.name ?? "DriveTo user"
    }));

  const unique = new Map<string, PresenceUser>();
  users.forEach((user) => {
    unique.set(user.id, user);
  });

  return Array.from(unique.values());
}

export function OnlyOfficeEditor({ item, permission = "edit", shareToken }: OnlyOfficeEditorProps) {
  const editorId = useMemo(
    () => `onlyoffice-${item.id}-${shareToken ?? "private"}`.replace(/[^a-zA-Z0-9-_]/g, ""),
    [item.id, shareToken]
  );
  const [configPayload, setConfigPayload] = useState<OnlyOfficeConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"loading" | "dirty" | "synced">("loading");
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [lastEditedAt, setLastEditedAt] = useState(item.updated_at);

  const shareIdentity = useMemo(() => (shareToken ? getGuestIdentity(shareToken) : null), [shareToken]);

  async function loadConfig() {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (shareToken) {
      params.set("shareToken", shareToken);
      params.set("guestId", shareIdentity?.id ?? "");
      params.set("guestName", shareIdentity?.name ?? "");
    } else {
      params.set("itemId", item.id);
    }

    try {
      const response = await fetch(`/api/onlyoffice/config?${params.toString()}`, {
        cache: "no-store"
      });
      const body = (await response.json()) as OnlyOfficeConfigResponse & { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Could not prepare the ONLYOFFICE session.");
      }

      setConfigPayload(body);
      setLastEditedAt(body.lastEditedAt ?? item.updated_at);
      setSaveState("synced");
      return body;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not prepare the ONLYOFFICE session.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConfig();
  }, [item.id, shareIdentity?.id, shareIdentity?.name, shareToken]);

  useEffect(() => {
    setLastEditedAt(item.updated_at);
  }, [item.updated_at]);

  useEffect(() => {
    if (!configPayload) {
      return;
    }

    const actor = configPayload.config.editorConfig?.user ?? {
      id: shareIdentity?.id ?? item.user_id,
      name: shareIdentity?.name ?? item.name
    };
    const channel = supabase.channel(`onlyoffice-presence:${item.id}`, {
      config: {
        presence: {
          key: actor.id ?? item.id
        }
      }
    });

    channel.on("presence", { event: "sync" }, () => {
      setPresenceUsers(flattenPresence(channel.presenceState() as Record<string, Array<{ color?: string; id?: string; name?: string }>>));
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          color: getPresenceColor(actor.id ?? item.id),
          id: actor.id ?? item.id,
          name: actor.name ?? "DriveTo user"
        });
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [configPayload, item.id, item.name, item.user_id, shareIdentity?.id, shareIdentity?.name]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm",
            saveState === "dirty"
              ? "border-sky-300/30 bg-sky-300/10 text-sky-100"
              : "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
          )}
        >
          {saveState === "dirty" ? <Cloud className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {saveState === "dirty" ? "Auto-save in progress" : "All changes synced"}
        </div>

        <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
          <Users className="h-4 w-4 text-slate-400" />
          {presenceUsers.length === 0 ? "Just you here" : `${presenceUsers.length} collaborator${presenceUsers.length === 1 ? "" : "s"}`}
        </div>

        <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
          Last edited {formatDate(lastEditedAt)}
        </div>

        {presenceUsers.length > 0 ? (
          <div className="ml-auto flex items-center gap-2">
            {presenceUsers.slice(0, 6).map((user) => (
              <div
                key={user.id}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-xs font-semibold text-white"
                style={{ backgroundColor: user.color }}
                title={user.name}
              >
                {getInitials(user.name)}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-hidden rounded-[30px] border border-white/10 bg-[#0b1020] shadow-[0_30px_80px_rgba(2,6,23,0.45)]">
        {loading ? (
          <div className="flex h-full min-h-[70vh] items-center justify-center gap-3 text-sm text-slate-400">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            Loading collaborative editor
          </div>
        ) : null}

        {!loading && error ? (
          <div className="m-4 flex min-h-[20rem] items-center gap-3 rounded-3xl border border-rose-400/20 bg-rose-400/10 px-4 py-4 text-sm text-rose-200">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        ) : null}

        {!loading && !error && configPayload ? (
          <DocumentEditor
            config={configPayload.config}
            documentServerUrl={configPayload.documentServerUrl}
            events_onAppReady={() => setSaveState("synced")}
            events_onDocumentReady={() => setSaveState("synced")}
            events_onDocumentStateChange={(event: { data?: boolean }) => {
              if (event.data) {
                setSaveState("dirty");
                return;
              }

              setSaveState("synced");
              setLastEditedAt(new Date().toISOString());
            }}
            events_onError={(event: { data?: { errorDescription?: string } }) => {
              setError(event.data?.errorDescription ?? "The ONLYOFFICE editor reported an error.");
            }}
            events_onRequestRefreshFile={async () => {
              const refreshed = await loadConfig();
              const editor = window.DocEditor?.instances[editorId];
              if (refreshed && editor?.refreshFile) {
                editor.refreshFile(refreshed.config);
              }
            }}
            height="100%"
            id={editorId}
            onLoadComponentError={(_code, description) => {
              setError(description);
            }}
            shardkey={configPayload.config.document?.key ?? item.id}
            width="100%"
          />
        ) : null}
      </div>

      <div className="mt-4 text-xs leading-6 text-slate-500">
        {permission === "edit"
          ? "Live edits, comments, and collaboration presence are handled by ONLYOFFICE while DriveTo continues storing the canonical file and version snapshots in Supabase."
          : "This shared session is view-only. Download is still available from the surrounding DriveTo interface."}
      </div>
    </div>
  );
}
