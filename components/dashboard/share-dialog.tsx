"use client";

import { useMemo, useState } from "react";
import { Copy, Link2, LoaderCircle, ShieldCheck, X } from "lucide-react";
import type { DriveItem, ShareLink, SharePermission } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type ShareDialogProps = {
  item: DriveItem | null;
  links: ShareLink[];
  open: boolean;
  onClose: () => void;
  onCreateLink: (permission: SharePermission) => Promise<void>;
  onToggleLink: (linkId: string, isActive: boolean) => Promise<void>;
};

export function ShareDialog({ item, links, open, onClose, onCreateLink, onToggleLink }: ShareDialogProps) {
  const [permission, setPermission] = useState<SharePermission>("view");
  const [loading, setLoading] = useState(false);
  const itemLinks = useMemo(() => links.filter((link) => link.item_id === item?.id), [item?.id, links]);

  if (!open || !item) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur">
      <div className="glass-panel w-full max-w-2xl p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm text-accent">Share links</p>
            <h3 className="font-[var(--font-display)] text-3xl font-semibold">{item.name}</h3>
            <p className="mt-2 text-sm text-slate-400">
              Create public links with view or edit access. Edit links can update text documents and CSV sheets.
            </p>
          </div>
          <button type="button" className="button-ghost" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <select
            className="field"
            value={permission}
            onChange={(event) => setPermission(event.target.value as SharePermission)}
          >
            <option value="view">Can view</option>
            <option value="edit">Can edit</option>
          </select>
          <button
            type="button"
            className="button-primary sm:min-w-40"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              await onCreateLink(permission);
              setLoading(false);
            }}
          >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Create link"}
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {itemLinks.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
              No links yet for this item.
            </div>
          ) : null}

          {itemLinks.map((link) => {
            const url =
              typeof window === "undefined" ? `/share/${link.token}` : `${window.location.origin}/share/${link.token}`;

            return (
              <div key={link.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 text-sm text-accent">
                      <ShieldCheck className="h-4 w-4" />
                      {link.permission === "edit" ? "Edit permission" : "View permission"}
                    </div>
                    <p className="text-sm break-all text-slate-300">{url}</p>
                    <p className="text-xs text-slate-500">Created {formatDate(link.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="button-secondary gap-2"
                      onClick={() => navigator.clipboard.writeText(url)}
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </button>
                    <button
                      type="button"
                      className="button-secondary gap-2"
                      onClick={() => onToggleLink(link.id, !link.is_active)}
                    >
                      <Link2 className="h-4 w-4" />
                      {link.is_active ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
