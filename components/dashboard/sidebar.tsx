"use client";

import { Folders, LogOut, Plus, Search, Trash2 } from "lucide-react";
import { SIDEBAR_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type SidebarProps = {
  currentView: "dashboard" | "recent" | "trash";
  search: string;
  onSearchChange: (value: string) => void;
  onViewChange: (value: "dashboard" | "recent" | "trash") => void;
  onCreateFolder: () => void;
  onCreateDoc: () => void;
  onCreateSheet: () => void;
  onLogout: () => void;
};

export function Sidebar({
  currentView,
  search,
  onSearchChange,
  onViewChange,
  onCreateFolder,
  onCreateDoc,
  onCreateSheet,
  onLogout
}: SidebarProps) {
  return (
    <aside className="glass-panel flex h-full flex-col gap-5 p-4 sm:p-5">
      <div>
        <p className="font-[var(--font-display)] text-2xl font-semibold">DriveTo</p>
        <p className="mt-2 text-sm text-slate-400">Personal cloud storage with secure sync.</p>
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          className="field pl-11"
          placeholder="Search files and folders"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      <div className="grid gap-2 sm:grid-cols-1">
        {SIDEBAR_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition",
              currentView === item.key ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
            )}
            onClick={() => onViewChange(item.key)}
          >
            {item.key === "dashboard" ? <Folders className="h-4 w-4" /> : null}
            {item.key === "recent" ? <Search className="h-4 w-4" /> : null}
            {item.key === "trash" ? <Trash2 className="h-4 w-4" /> : null}
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold text-white">Create</p>
        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-3 lg:grid-cols-1">
          <button type="button" className="button-secondary w-full justify-start gap-2" onClick={onCreateFolder}>
            <Plus className="h-4 w-4" />
            New folder
          </button>
          <button type="button" className="button-secondary w-full justify-start gap-2" onClick={onCreateDoc}>
            <Plus className="h-4 w-4" />
            New document
          </button>
          <button type="button" className="button-secondary w-full justify-start gap-2" onClick={onCreateSheet}>
            <Plus className="h-4 w-4" />
            New sheet
          </button>
        </div>
      </div>

      <button type="button" className="button-ghost mt-auto w-full justify-start gap-2 text-rose-200" onClick={onLogout}>
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </aside>
  );
}
