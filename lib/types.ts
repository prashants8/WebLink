export type ItemType = "file" | "folder";
export type SharePermission = "view" | "edit";

export type DriveItem = {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  item_type: ItemType;
  storage_path: string | null;
  mime_type: string | null;
  extension: string | null;
  size_bytes: number;
  content_text: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  last_opened_at: string | null;
};

export type FileVersion = {
  id: string;
  item_id: string;
  user_id: string;
  version_no: number;
  storage_path: string | null;
  content_text: string | null;
  size_bytes: number;
  created_at: string;
};

export type ShareLink = {
  id: string;
  item_id: string;
  user_id: string;
  token: string;
  permission: SharePermission;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
};

export type RealtimePayload<T> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  old: T | null;
  new: T | null;
};
