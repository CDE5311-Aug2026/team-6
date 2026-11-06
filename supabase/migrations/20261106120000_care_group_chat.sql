begin;

create table public.care_conversations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.care_groups(id) on delete cascade,
  kind text not null check (kind in ('group', 'direct')),
  direct_key text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  check ((kind = 'group' and direct_key is null) or (kind = 'direct' and direct_key is not null))
);
create unique index care_conversations_one_group_room on public.care_conversations(group_id) where kind = 'group';
create unique index care_conversations_one_direct_pair on public.care_conversations(group_id, direct_key) where kind = 'direct';

create table public.care_conversation_members (
  conversation_id uuid not null references public.care_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index care_conversation_members_user on public.care_conversation_members(user_id, conversation_id);

create table public.care_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.care_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index care_messages_conversation_time on public.care_messages(conversation_id, created_at desc);

alter table public.care_conversations enable row level security;
alter table public.care_conversation_members enable row level security;
alter table public.care_messages enable row level security;
revoke all on public.care_conversations, public.care_conversation_members, public.care_messages from anon, authenticated;
grant select on public.care_conversations, public.care_conversation_members, public.care_messages to authenticated;
grant insert on public.care_messages to authenticated;
grant update (last_read_at) on public.care_conversation_members to authenticated;

create or replace function public.is_care_conversation_member(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.care_conversations c
    join public.care_conversation_members cm on cm.conversation_id = c.id
    join public.care_group_members gm on gm.group_id = c.group_id and gm.user_id = cm.user_id
    where c.id = p_conversation_id and cm.user_id = (select auth.uid())
  );
$$;

create policy care_conversations_read_members on public.care_conversations
for select to authenticated using (public.is_care_conversation_member(id));
create policy care_conversation_members_read_chat on public.care_conversation_members
for select to authenticated using (public.is_care_conversation_member(conversation_id));
create policy care_conversation_members_update_read on public.care_conversation_members
for update to authenticated using (user_id = (select auth.uid()) and public.is_care_conversation_member(conversation_id))
with check (user_id = (select auth.uid()) and public.is_care_conversation_member(conversation_id));
create policy care_messages_read_members on public.care_messages
for select to authenticated using (public.is_care_conversation_member(conversation_id));
create policy care_messages_insert_members on public.care_messages
for insert to authenticated with check (sender_id = (select auth.uid()) and public.is_care_conversation_member(conversation_id));

create or replace function public.create_group_chat_room()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.care_conversations(group_id, kind, created_by)
  values (new.id, 'group', new.owner_id)
  on conflict (group_id) where kind = 'group' do nothing;
  return new;
end;
$$;
create trigger care_group_chat_room_created after insert on public.care_groups
for each row execute function public.create_group_chat_room();

create or replace function public.sync_care_group_chat_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.care_conversation_members(conversation_id, user_id)
    select c.id, new.user_id from public.care_conversations c
    where c.group_id = new.group_id and c.kind = 'group'
    on conflict (conversation_id, user_id) do nothing;
    return new;
  end if;
  delete from public.care_conversation_members cm
  using public.care_conversations c
  where c.id = cm.conversation_id and c.group_id = old.group_id and c.kind = 'group' and cm.user_id = old.user_id;
  return old;
end;
$$;
create trigger care_group_chat_membership_changed after insert or delete on public.care_group_members
for each row execute function public.sync_care_group_chat_membership();

insert into public.care_conversations(group_id, kind, created_by)
select g.id, 'group', g.owner_id from public.care_groups g
on conflict (group_id) where kind = 'group' do nothing;
insert into public.care_conversation_members(conversation_id, user_id)
select c.id, gm.user_id from public.care_conversations c
join public.care_group_members gm on gm.group_id = c.group_id
where c.kind = 'group'
on conflict (conversation_id, user_id) do nothing;

create or replace function public.get_or_create_care_direct_conversation(p_group_id uuid, p_other_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_key text;
  v_conversation_id uuid;
begin
  if v_user is null then raise exception 'Sign in before starting a chat.'; end if;
  if p_other_user_id is null or p_other_user_id = v_user then raise exception 'Choose another care-group member.'; end if;
  if not exists (select 1 from public.care_group_members where group_id = p_group_id and user_id = v_user)
    or not exists (select 1 from public.care_group_members where group_id = p_group_id and user_id = p_other_user_id) then
    raise exception 'Chats are available only between current members of the same care group.';
  end if;
  v_key := least(v_user::text, p_other_user_id::text) || ':' || greatest(v_user::text, p_other_user_id::text);
  insert into public.care_conversations(group_id, kind, direct_key, created_by)
  values (p_group_id, 'direct', v_key, v_user)
  on conflict (group_id, direct_key) where kind = 'direct' do update set updated_at = now()
  returning id into v_conversation_id;
  insert into public.care_conversation_members(conversation_id, user_id)
  values (v_conversation_id, v_user), (v_conversation_id, p_other_user_id)
  on conflict (conversation_id, user_id) do nothing;
  return v_conversation_id;
end;
$$;

create or replace function public.mark_care_conversation_read(p_conversation_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.care_conversation_members set last_read_at = now()
  where conversation_id = p_conversation_id and user_id = (select auth.uid())
    and public.is_care_conversation_member(p_conversation_id);
  return found;
end;
$$;

create or replace function public.touch_care_conversation_after_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.care_conversations set last_message_at = new.created_at, updated_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;
create trigger care_message_updates_conversation after insert on public.care_messages
for each row execute function public.touch_care_conversation_after_message();

revoke all on function public.is_care_conversation_member(uuid) from public, anon;
revoke all on function public.create_group_chat_room() from public, anon, authenticated;
revoke all on function public.sync_care_group_chat_membership() from public, anon, authenticated;
revoke all on function public.touch_care_conversation_after_message() from public, anon, authenticated;
revoke all on function public.get_or_create_care_direct_conversation(uuid, uuid) from public, anon;
revoke all on function public.mark_care_conversation_read(uuid) from public, anon;
grant execute on function public.is_care_conversation_member(uuid) to authenticated;
grant execute on function public.get_or_create_care_direct_conversation(uuid, uuid) to authenticated;
grant execute on function public.mark_care_conversation_read(uuid) to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'care_messages') then
    alter publication supabase_realtime add table public.care_messages;
  end if;
end $$;

commit;
