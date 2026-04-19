create extension if not exists pgcrypto;

create table if not exists public.drive_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.drive_items(id) on delete cascade,
  name text not null,
  item_type text not null check (item_type in ('file', 'folder')),
  storage_path text unique,
  mime_type text,
  extension text,
  size_bytes bigint not null default 0,
  content_text text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  last_opened_at timestamptz
);

create table if not exists public.file_versions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.drive_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version_no integer not null,
  storage_path text,
  content_text text,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  unique (item_id, version_no)
);

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.drive_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  permission text not null check (permission in ('view', 'edit')),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz
);

alter table public.drive_items enable row level security;
alter table public.file_versions enable row level security;
alter table public.share_links enable row level security;

create policy "Users manage their own drive items"
on public.drive_items
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users manage their own file versions"
on public.file_versions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users manage their own share links"
on public.share_links
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('user-files', 'user-files', false)
on conflict (id) do nothing;

create policy "Users can upload their own objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'user-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can read their own objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'user-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update their own objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'user-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their own objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'user-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

alter publication supabase_realtime add table public.drive_items;
alter publication supabase_realtime add table public.share_links;
alter publication supabase_realtime add table public.file_versions;
