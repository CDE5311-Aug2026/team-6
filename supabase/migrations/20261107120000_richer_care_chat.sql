begin;

alter table public.care_messages
  add column if not exists attachment jsonb,
  add column if not exists deleted_at timestamptz,
  add column if not exists reply_to_id uuid references public.care_messages(id) on delete set null;
alter table public.care_messages drop constraint if exists care_messages_body_check;
alter table public.care_messages add constraint care_messages_body_check
  check (char_length(btrim(body)) <= 4000 and (char_length(btrim(body)) > 0 or attachment is not null or deleted_at is not null));
grant update (body, attachment, deleted_at) on public.care_messages to authenticated;

drop policy if exists care_messages_update_own on public.care_messages;
create policy care_messages_update_own on public.care_messages
for update to authenticated
using (sender_id = (select auth.uid()) and deleted_at is null and created_at >= now() - interval '10 minutes' and public.is_care_conversation_member(conversation_id))
with check (sender_id = (select auth.uid()) and deleted_at is not null and public.is_care_conversation_member(conversation_id));

create table if not exists public.care_message_hidden (
  message_id uuid not null references public.care_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.care_message_hidden enable row level security;
revoke all on public.care_message_hidden from anon, authenticated;
grant select, insert, delete on public.care_message_hidden to authenticated;
drop policy if exists care_message_hidden_read_own on public.care_message_hidden;
create policy care_message_hidden_read_own on public.care_message_hidden
for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists care_message_hidden_insert_own on public.care_message_hidden;
create policy care_message_hidden_insert_own on public.care_message_hidden
for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.care_messages m where m.id = message_id and public.is_care_conversation_member(m.conversation_id))
);
drop policy if exists care_message_hidden_delete_own on public.care_message_hidden;
create policy care_message_hidden_delete_own on public.care_message_hidden
for delete to authenticated using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('care-chat-media', 'care-chat-media', false, 31457280,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists care_chat_media_read on storage.objects;
create policy care_chat_media_read on storage.objects for select to authenticated
using (
  bucket_id = 'care-chat-media'
  and public.is_care_conversation_member((storage.foldername(name))[1]::uuid)
);
drop policy if exists care_chat_media_insert on storage.objects;
create policy care_chat_media_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'care-chat-media'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and public.is_care_conversation_member((storage.foldername(name))[1]::uuid)
);
drop policy if exists care_chat_media_delete_own on storage.objects;
create policy care_chat_media_delete_own on storage.objects for delete to authenticated
using (
  bucket_id = 'care-chat-media'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and public.is_care_conversation_member((storage.foldername(name))[1]::uuid)
);

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'care_conversation_members') then
    alter publication supabase_realtime add table public.care_conversation_members;
  end if;
end $$;

commit;

