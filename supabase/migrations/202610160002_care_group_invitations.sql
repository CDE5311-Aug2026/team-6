begin;

create table if not exists public.care_groups (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  pet_id text not null,
  pet_name text not null,
  pet_breed text not null default '',
  pet_age text not null default '',
  pet_avatar text not null default '',
  pet_species text not null default 'Dog' check (pet_species in ('Dog', 'Cat')),
  group_name text not null default 'Care circle',
  workspace jsonb not null default '{}'::jsonb check (jsonb_typeof(workspace) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.care_group_members (
  group_id uuid not null references public.care_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'Caregiver' check (role in ('Caregiver', 'Viewer')),
  is_owner boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.care_group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.care_groups(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('Caregiver', 'Viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (inviter_id <> invitee_id)
);

create unique index if not exists care_group_one_pending_invite
  on public.care_group_invitations (group_id, invitee_id) where status = 'pending';
create index if not exists care_group_invite_inbox
  on public.care_group_invitations (invitee_id, status, created_at desc);
create index if not exists care_group_invite_outbox
  on public.care_group_invitations (inviter_id, status, created_at desc);

create trigger care_groups_updated_at before update on public.care_groups
for each row execute function public.pawsona_touch_updated_at();

alter table public.care_groups enable row level security;
alter table public.care_group_members enable row level security;
alter table public.care_group_invitations enable row level security;
revoke all on public.care_groups, public.care_group_members, public.care_group_invitations from anon, authenticated;
grant select, insert, update, delete on public.care_groups, public.care_group_members, public.care_group_invitations to authenticated;

create policy care_groups_read_member on public.care_groups for select to authenticated
using (exists (select 1 from public.care_group_members m where m.group_id = id and m.user_id = (select auth.uid()))
  or exists (select 1 from public.care_group_invitations i where i.group_id = id and i.invitee_id = (select auth.uid()) and i.status = 'pending'));
create policy care_groups_insert_owner on public.care_groups for insert to authenticated
with check (owner_id = (select auth.uid()));
create policy care_groups_update_owner on public.care_groups for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy care_groups_delete_owner on public.care_groups for delete to authenticated
using (owner_id = (select auth.uid()));

create policy care_group_members_read_group on public.care_group_members for select to authenticated
using (user_id = (select auth.uid()));
create policy care_group_invitations_read_related on public.care_group_invitations for select to authenticated
using (invitee_id = (select auth.uid()) or inviter_id = (select auth.uid()));

create or replace function public.send_care_group_invitation(
  p_group_id uuid, p_recipient_id uuid, p_role text, p_pet_id text,
  p_pet_name text, p_pet_breed text, p_pet_age text, p_pet_avatar text,
  p_pet_species text, p_group_name text, p_workspace jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_invite uuid;
begin
  if v_user is null then raise exception 'Sign in before inviting a caregiver.'; end if;
  if p_recipient_id = v_user then raise exception 'You cannot invite your own account.'; end if;
  if p_role not in ('Caregiver', 'Viewer') then raise exception 'Choose a valid permission.'; end if;
  if not exists (select 1 from auth.users where id = p_recipient_id) then raise exception 'That account could not be found.'; end if;
  if exists (select 1 from public.care_group_members where group_id = p_group_id and user_id = p_recipient_id) then raise exception 'This account is already a group member.'; end if;
  if exists (select 1 from public.care_group_invitations where group_id = p_group_id and invitee_id = p_recipient_id and status = 'pending') then raise exception 'This account already has a pending invitation.'; end if;
  insert into public.care_groups (id, owner_id, pet_id, pet_name, pet_breed, pet_age, pet_avatar, pet_species, group_name, workspace)
  values (p_group_id, v_user, p_pet_id, left(p_pet_name, 120), left(coalesce(p_pet_breed, ''), 120), left(coalesce(p_pet_age, ''), 32), left(coalesce(p_pet_avatar, ''), 2000000), coalesce(p_pet_species, 'Dog'), left(coalesce(p_group_name, 'Care circle'), 80), coalesce(p_workspace, '{}'::jsonb))
  on conflict (id) do update set pet_name = excluded.pet_name, pet_breed = excluded.pet_breed, pet_age = excluded.pet_age,
    pet_avatar = excluded.pet_avatar, pet_species = excluded.pet_species, group_name = excluded.group_name, workspace = excluded.workspace
  where public.care_groups.owner_id = v_user;
  if not exists (select 1 from public.care_groups where id = p_group_id and owner_id = v_user) then raise exception 'Only the group owner can invite members.'; end if;
  insert into public.care_group_members (group_id, user_id, role, is_owner)
  values (p_group_id, v_user, 'Caregiver', true) on conflict (group_id, user_id) do nothing;
  insert into public.care_group_invitations (group_id, inviter_id, invitee_id, role)
  values (p_group_id, v_user, p_recipient_id, p_role) returning id into v_invite;
  return v_invite;
end;
$$;

create or replace function public.list_my_care_group_invitations()
returns table (id uuid, group_id uuid, inviter_id uuid, invitee_id uuid, role text, status text, created_at timestamptz,
  owner_name text, invitee_username text, pet_id text, pet_name text, pet_breed text, pet_age text, pet_avatar text, pet_species text, group_name text, workspace jsonb)
language sql stable security definer set search_path = '' as $$
  select i.id, i.group_id, i.inviter_id, i.invitee_id, i.role, i.status, i.created_at,
    coalesce(nullif(p.display_name, ''), u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)),
    coalesce(r.raw_user_meta_data ->> 'username', split_part(r.email, '@', 1)),
    g.pet_id, g.pet_name, g.pet_breed, g.pet_age, g.pet_avatar, g.pet_species, g.group_name, g.workspace
  from public.care_group_invitations i
  join public.care_groups g on g.id = i.group_id
  join auth.users u on u.id = i.inviter_id
  join auth.users r on r.id = i.invitee_id
  left join public.profiles p on p.id = i.inviter_id
  where (i.invitee_id = (select auth.uid()) or i.inviter_id = (select auth.uid())) and i.status = 'pending'
  order by i.created_at desc;
$$;

create or replace function public.respond_to_care_group_invitation(p_invitation_id uuid, p_response text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_inv public.care_group_invitations%rowtype; v_group public.care_groups%rowtype;
begin
  if p_response not in ('accepted', 'declined') then raise exception 'Invalid invitation response.'; end if;
  update public.care_group_invitations set status = p_response, responded_at = now()
    where id = p_invitation_id and invitee_id = auth.uid() and status = 'pending' returning * into v_inv;
  if not found then raise exception 'This invitation is no longer available.'; end if;
  if p_response = 'accepted' then
    insert into public.care_group_members (group_id, user_id, role, is_owner)
    values (v_inv.group_id, auth.uid(), v_inv.role, false) on conflict (group_id, user_id) do nothing;
    select * into v_group from public.care_groups where id = v_inv.group_id;
    return jsonb_build_object('group_id', v_group.id, 'owner_id', v_group.owner_id, 'pet_id', v_group.pet_id,
      'pet_name', v_group.pet_name, 'pet_breed', v_group.pet_breed, 'pet_age', v_group.pet_age, 'pet_avatar', v_group.pet_avatar,
      'pet_species', v_group.pet_species, 'group_name', v_group.group_name, 'workspace', v_group.workspace, 'role', v_inv.role,
      'members', (select coalesce(jsonb_agg(jsonb_build_object('id', m.user_id, 'name', coalesce(nullif(p.display_name, ''), u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)), 'email', '', 'role', m.role, 'is_owner', m.is_owner)), '[]'::jsonb)
        from public.care_group_members m join auth.users u on u.id = m.user_id left join public.profiles p on p.id = m.user_id where m.group_id = v_group.id));
  end if;
  return '{}'::jsonb;
end;
$$;

create or replace function public.cancel_care_group_invitation(p_invitation_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.care_group_invitations set status = 'cancelled', responded_at = now()
    where id = p_invitation_id and inviter_id = auth.uid() and status = 'pending';
  return found;
end;
$$;

create or replace function public.list_my_care_groups()
returns table (group_id uuid, owner_id uuid, pet_id text, pet_name text, pet_breed text, pet_age text, pet_avatar text,
  pet_species text, group_name text, workspace jsonb, role text, is_owner boolean, members jsonb)
language sql stable security definer set search_path = '' as $$
  select g.id, g.owner_id, g.pet_id, g.pet_name, g.pet_breed, g.pet_age, g.pet_avatar, g.pet_species, g.group_name, g.workspace, m.role, m.is_owner,
    (select coalesce(jsonb_agg(jsonb_build_object('id', member.user_id, 'name', coalesce(nullif(p.display_name, ''), u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)), 'email', '', 'role', member.role, 'is_owner', member.is_owner)), '[]'::jsonb)
      from public.care_group_members member join auth.users u on u.id = member.user_id left join public.profiles p on p.id = member.user_id where member.group_id = g.id)
  from public.care_group_members m join public.care_groups g on g.id = m.group_id
  where m.user_id = (select auth.uid());
$$;

create or replace function public.save_care_group_workspace(p_group_id uuid, p_workspace jsonb, p_group_name text,
  p_pet_name text, p_pet_breed text, p_pet_age text, p_pet_avatar text, p_pet_species text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_member public.care_group_members%rowtype;
begin
  select * into v_member from public.care_group_members where group_id = p_group_id and user_id = auth.uid();
  if not found or (v_member.role = 'Viewer' and not v_member.is_owner) then raise exception 'You do not have permission to update this care group.'; end if;
  update public.care_groups set workspace = coalesce(p_workspace, '{}'::jsonb), group_name = case when v_member.is_owner then left(coalesce(p_group_name, group_name), 80) else group_name end,
    pet_name = case when v_member.is_owner then left(coalesce(p_pet_name, pet_name), 120) else pet_name end,
    pet_breed = case when v_member.is_owner then left(coalesce(p_pet_breed, pet_breed), 120) else pet_breed end,
    pet_age = case when v_member.is_owner then left(coalesce(p_pet_age, pet_age), 32) else pet_age end,
    pet_avatar = case when v_member.is_owner then left(coalesce(p_pet_avatar, pet_avatar), 2000000) else pet_avatar end,
    pet_species = case when v_member.is_owner then coalesce(p_pet_species, pet_species) else pet_species end
    where id = p_group_id;
  return true;
end;
$$;

create or replace function public.remove_care_group_member(p_group_id uuid, p_member_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.care_groups where id = p_group_id and owner_id = auth.uid()) then raise exception 'Only the group owner can remove members.'; end if;
  delete from public.care_group_members where group_id = p_group_id and user_id = p_member_id and is_owner = false;
  update public.care_group_invitations set status = 'cancelled', responded_at = now()
    where group_id = p_group_id and invitee_id = p_member_id and status in ('pending', 'accepted');
  return found;
end;
$$;

create or replace function public.update_care_group_member(p_group_id uuid, p_member_id uuid, p_role text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_role not in ('Caregiver', 'Viewer') then raise exception 'Invalid care-group permission.'; end if;
  if not exists (select 1 from public.care_groups where id = p_group_id and owner_id = auth.uid()) then raise exception 'Only the group owner can change member permissions.'; end if;
  update public.care_group_members set role = p_role where group_id = p_group_id and user_id = p_member_id and is_owner = false;
  return found;
end;
$$;

revoke all on function public.send_care_group_invitation(uuid,uuid,text,text,text,text,text,text,text,text,jsonb) from public, anon;
revoke all on function public.list_my_care_group_invitations() from public, anon;
revoke all on function public.respond_to_care_group_invitation(uuid,text) from public, anon;
revoke all on function public.cancel_care_group_invitation(uuid) from public, anon;
revoke all on function public.list_my_care_groups() from public, anon;
revoke all on function public.save_care_group_workspace(uuid,jsonb,text,text,text,text,text,text) from public, anon;
revoke all on function public.remove_care_group_member(uuid,uuid) from public, anon;
revoke all on function public.update_care_group_member(uuid,uuid,text) from public, anon;
grant execute on function public.send_care_group_invitation(uuid,uuid,text,text,text,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.list_my_care_group_invitations() to authenticated;
grant execute on function public.respond_to_care_group_invitation(uuid,text) to authenticated;
grant execute on function public.cancel_care_group_invitation(uuid) to authenticated;
grant execute on function public.list_my_care_groups() to authenticated;
grant execute on function public.save_care_group_workspace(uuid,jsonb,text,text,text,text,text,text) to authenticated;
grant execute on function public.remove_care_group_member(uuid,uuid) to authenticated;
grant execute on function public.update_care_group_member(uuid,uuid,text) to authenticated;

commit;
