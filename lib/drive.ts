import type { DriveItem } from "@/lib/types";

export function buildBreadcrumbs(items: DriveItem[], folderId: string | null) {
  const chain: DriveItem[] = [];
  let pointer = folderId;

  while (pointer) {
    const folder = items.find((item) => item.id === pointer);
    if (!folder) {
      break;
    }
    chain.unshift(folder);
    pointer = folder.parent_id;
  }

  return chain;
}

export function getDescendantIds(items: DriveItem[], id: string) {
  const ids = new Set<string>([id]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const item of items) {
      if (item.parent_id && ids.has(item.parent_id) && !ids.has(item.id)) {
        ids.add(item.id);
        changed = true;
      }
    }
  }

  return Array.from(ids);
}

export function isDescendant(items: DriveItem[], parentId: string, targetId: string) {
  let pointer = items.find((item) => item.id === targetId)?.parent_id ?? null;

  while (pointer) {
    if (pointer === parentId) {
      return true;
    }
    pointer = items.find((item) => item.id === pointer)?.parent_id ?? null;
  }

  return false;
}
