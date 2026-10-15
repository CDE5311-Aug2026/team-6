-- Phase 1: verified identities and private personal workspaces.
-- Guest Luna data stays local and is never imported automatically.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 120),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep the current prototype's pet/workspace structure during the first migration.
-- This is private per-user persistence, NOT a shared care-circle database.
-- A revision guards against silently overwriting a second device's changes.
create table public.personal_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 1 check (schema_version = 1),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object')
    check (octet_length(payload::text) <= 1048576),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

create function public.pawsona_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.pawsona_touch_updated_at();
create trigger personal_workspaces_updated_at before update on public.personal_workspaces
for each row execute function public.pawsona_touch_updated_at();

alter table public.profiles enable row level security;
alter table public.personal_workspaces enable row level security;
revoke all on public.profiles, public.personal_workspaces from anon;
revoke all on public.profiles, public.personal_workspaces from authenticated;
grant select, insert, update, delete on public.profiles, public.personal_workspaces to authenticated;

create policy profiles_read_self on public.profiles for select to authenticated
using ((select auth.uid()) = id);
create policy profiles_insert_self on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);
create policy profiles_update_self on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy profiles_delete_self on public.profiles for delete to authenticated
using ((select auth.uid()) = id);

create policy workspace_read_self on public.personal_workspaces for select to authenticated
using ((select auth.uid()) = user_id);
create policy workspace_insert_self on public.personal_workspaces for insert to authenticated
with check ((select auth.uid()) = user_id and revision = 1);
create policy workspace_update_self on public.personal_workspaces for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy workspace_delete_self on public.personal_workspaces for delete to authenticated
using ((select auth.uid()) = user_id);

-- Private attachments. The client uploads files to <auth.uid()>/<random-id>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pawsona-media', 'pawsona-media', false, 10485760,
  array['image/jpeg','image/png','image/webp','audio/webm','audio/mp4','audio/mpeg','audio/ogg'])
on conflict (id) do nothing;
create policy pawsona_media_read on storage.objects for select to authenticated
using (bucket_id = 'pawsona-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy pawsona_media_insert on storage.objects for insert to authenticated
with check (bucket_id = 'pawsona-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy pawsona_media_update on storage.objects for update to authenticated
using (bucket_id = 'pawsona-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'pawsona-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy pawsona_media_delete on storage.objects for delete to authenticated
using (bucket_id = 'pawsona-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
