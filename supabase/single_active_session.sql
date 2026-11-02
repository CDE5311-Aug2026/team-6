
create table if not exists pawsona_private.active_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null,
  started_at timestamptz not null
);
alter table pawsona_private.active_sessions enable row level security;
revoke all on pawsona_private.active_sessions from public, anon, authenticated;

-- Preserve the newest existing session on rollout; never resurrect an older login.
insert into pawsona_private.active_sessions(user_id,session_id,started_at)
select distinct on (user_id) user_id,id,created_at
from auth.sessions
where created_at is not null and (not_after is null or not_after > now())
order by user_id,created_at desc,id desc
on conflict (user_id) do nothing;

create or replace function pawsona_private.session_is_current()
returns boolean language sql stable security definer set search_path = ''
as $fn$
  select exists (
    select 1 from pawsona_private.active_sessions a
    join auth.sessions s on s.id=a.session_id and s.user_id=a.user_id
    where a.user_id=(select auth.uid())
      and a.session_id=nullif((select auth.jwt())->>'session_id','')::uuid
      and (s.not_after is null or s.not_after>now())
  );
$fn$;
revoke all on function pawsona_private.session_is_current() from public,anon;
grant usage on schema pawsona_private to authenticated;
grant execute on function pawsona_private.session_is_current() to authenticated;

create or replace function public.pawsona_session_status()
returns boolean language sql stable security invoker set search_path = ''
as $fn$ select pawsona_private.session_is_current(); $fn$;
revoke all on function public.pawsona_session_status() from public,anon;
grant execute on function public.pawsona_session_status() to authenticated;

-- IDs and ordering come from Auth, never from client metadata or device clocks.
create or replace function public.pawsona_claim_session()
returns boolean language plpgsql security definer set search_path = ''
as $fn$
declare v_user uuid := auth.uid(); v_sid uuid := nullif(auth.jwt()->>'session_id','')::uuid; v_started timestamptz;
begin
  if v_user is null or v_sid is null then return false; end if;
  select created_at into v_started from auth.sessions
    where id=v_sid and user_id=v_user and (not_after is null or not_after>now());
  if not found or v_started is null then return false; end if;
  insert into pawsona_private.active_sessions(user_id,session_id,started_at)
    values(v_user,v_sid,v_started)
  on conflict(user_id) do update set session_id=excluded.session_id,started_at=excluded.started_at
    where (excluded.started_at,excluded.session_id) >= (active_sessions.started_at,active_sessions.session_id);
  return pawsona_private.session_is_current();
end;
$fn$;
revoke all on function public.pawsona_claim_session() from public,anon;
grant execute on function public.pawsona_claim_session() to authenticated;

-- The shared lock serializes an in-flight write with a later session claim.
create or replace function pawsona_private.require_current_session()
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_sid uuid; v_user uuid := auth.uid();
begin
  select session_id into v_sid from pawsona_private.active_sessions where user_id=v_user for share;
  if v_user is null or v_sid is distinct from nullif(auth.jwt()->>'session_id','')::uuid
     or not exists(select 1 from auth.sessions where id=v_sid and user_id=v_user and (not_after is null or not_after>now())) then
    raise exception using errcode='28000', message='PAWSONA_SESSION_REPLACED';
  end if;
end;
$fn$;
revoke all on function pawsona_private.require_current_session() from public,anon;
grant execute on function pawsona_private.require_current_session() to authenticated;

create or replace function pawsona_private.enforce_current_session_write()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
begin
  -- SQL maintenance and existing service-role jobs keep their own authorization.
  if nullif(current_setting('request.jwt.claims',true),'') is not null
     and coalesce(auth.jwt()->>'role','') <> 'service_role' then
    perform pawsona_private.require_current_session();
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$fn$;
revoke all on function pawsona_private.enforce_current_session_write() from public,anon,authenticated;

do $block$
declare t text;
begin
  foreach t in array array['profiles','personal_workspaces','care_groups','care_group_members','care_group_invitations'] loop
    execute format('create policy pawsona_current_session on public.%I as restrictive for all to authenticated using ((select pawsona_private.session_is_current())) with check ((select pawsona_private.session_is_current()))',t);
    execute format('create trigger pawsona_current_session_write before insert or update or delete on public.%I for each row execute function pawsona_private.enforce_current_session_write()',t);
  end loop;
end;
$block$;
create policy pawsona_current_media_session on storage.objects as restrictive for all to authenticated
using (bucket_id <> 'pawsona-media' or (select pawsona_private.session_is_current()))
with check (bucket_id <> 'pawsona-media' or (select pawsona_private.session_is_current()));

-- Preserve existing function ownership/member predicates; add a session fence.
CREATE OR REPLACE FUNCTION public.search_pawsona_accounts(p_query text)
 RETURNS TABLE(id uuid, username text, display_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select guarded.* from (
select
    u.id,
    coalesce(nullif(u.raw_user_meta_data ->> 'username', ''), split_part(u.email, '@', 1)) as username,
    coalesce(nullif(p.display_name, ''), nullif(u.raw_user_meta_data ->> 'display_name', ''), nullif(u.raw_user_meta_data ->> 'username', ''), split_part(u.email, '@', 1)) as display_name
  from auth.users as u
  left join public.profiles as p on p.id = u.id
  where auth.uid() is not null
    and char_length(trim(coalesce(p_query, ''))) between 2 and 100
    and u.id <> (select auth.uid())
    and (
      position(lower(trim(p_query)) in lower(coalesce(u.raw_user_meta_data ->> 'username', ''))) > 0
      or position(lower(trim(p_query)) in lower(coalesce(nullif(p.display_name, ''), u.raw_user_meta_data ->> 'display_name', ''))) > 0
      or position(lower(trim(p_query)) in lower(coalesce(u.email, ''))) > 0
    )
  order by 3, 2
  limit 20
) guarded where (select pawsona_private.session_is_current());
$function$
;
CREATE OR REPLACE FUNCTION public.list_my_care_group_invitations()
 RETURNS TABLE(id uuid, group_id uuid, inviter_id uuid, invitee_id uuid, role text, status text, created_at timestamp with time zone, owner_name text, invitee_username text, pet_id text, pet_name text, pet_breed text, pet_age text, pet_avatar text, pet_species text, group_name text, workspace jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select guarded.* from (
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
  order by i.created_at desc
) guarded where (select pawsona_private.session_is_current());
$function$
;
CREATE OR REPLACE FUNCTION public.send_care_group_invitation(p_group_id uuid, p_recipient_id uuid, p_role text, p_pet_id text, p_pet_name text, p_pet_breed text, p_pet_age text, p_pet_avatar text, p_pet_species text, p_group_name text, p_workspace jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid := auth.uid(); v_invite uuid;
begin
  perform pawsona_private.require_current_session();
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
$function$
;
CREATE OR REPLACE FUNCTION public.respond_to_care_group_invitation(p_invitation_id uuid, p_response text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_inv public.care_group_invitations%rowtype; v_group public.care_groups%rowtype;
begin
  perform pawsona_private.require_current_session();
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
$function$
;
CREATE OR REPLACE FUNCTION public.cancel_care_group_invitation(p_invitation_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform pawsona_private.require_current_session();
  update public.care_group_invitations set status = 'cancelled', responded_at = now()
    where id = p_invitation_id and inviter_id = auth.uid() and status = 'pending';
  return found;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.save_care_group_workspace(p_group_id uuid, p_workspace jsonb, p_group_name text, p_pet_name text, p_pet_breed text, p_pet_age text, p_pet_avatar text, p_pet_species text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_member public.care_group_members%rowtype;
begin
  perform pawsona_private.require_current_session();
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
$function$
;
CREATE OR REPLACE FUNCTION public.remove_care_group_member(p_group_id uuid, p_member_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform pawsona_private.require_current_session();
  if not exists (select 1 from public.care_groups where id = p_group_id and owner_id = auth.uid()) then raise exception 'Only the group owner can remove members.'; end if;
  delete from public.care_group_members where group_id = p_group_id and user_id = p_member_id and is_owner = false;
  update public.care_group_invitations set status = 'cancelled', responded_at = now()
    where group_id = p_group_id and invitee_id = p_member_id and status in ('pending', 'accepted');
  return found;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.update_care_group_member(p_group_id uuid, p_member_id uuid, p_role text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform pawsona_private.require_current_session();
  if p_role not in ('Caregiver', 'Viewer') then raise exception 'Invalid care-group permission.'; end if;
  if not exists (select 1 from public.care_groups where id = p_group_id and owner_id = auth.uid()) then raise exception 'Only the group owner can change member permissions.'; end if;
  update public.care_group_members set role = p_role where group_id = p_group_id and user_id = p_member_id and is_owner = false;
  return found;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.list_my_care_groups()
 RETURNS TABLE(group_id uuid, owner_id uuid, pet_id text, pet_name text, pet_breed text, pet_age text, pet_avatar text, pet_species text, group_name text, workspace jsonb, role text, is_owner boolean, members jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select guarded.* from (
select g.id, g.owner_id, g.pet_id, g.pet_name, g.pet_breed, g.pet_age, g.pet_avatar, g.pet_species, g.group_name, g.workspace, m.role, m.is_owner,
    (select coalesce(jsonb_agg(jsonb_build_object(
      'id', member.user_id,
      'name', coalesce(nullif(p.display_name, ''), u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)),
      'email', '',
      'avatar', coalesce(nullif(p.avatar_path, ''), (
        select workspace.payload #>> '{accounts,0,avatar}'
        from public.personal_workspaces workspace
        where workspace.user_id = member.user_id
      ), ''),
      'role', member.role,
      'is_owner', member.is_owner
    )), '[]'::jsonb)
      from public.care_group_members member
      join auth.users u on u.id = member.user_id
      left join public.profiles p on p.id = member.user_id
      where member.group_id = g.id)
  from public.care_group_members m
  join public.care_groups g on g.id = m.group_id
  where m.user_id = (select auth.uid())
) guarded where (select pawsona_private.session_is_current());
$function$
;
CREATE OR REPLACE FUNCTION public.can_read_care_member_avatar(p_object_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select guarded.* from (
select exists (
    select 1
    from public.profiles avatar_profile
    join public.care_group_members avatar_member on avatar_member.user_id = avatar_profile.id
    join public.care_group_members viewer_member on viewer_member.group_id = avatar_member.group_id
    where avatar_profile.avatar_path = 'pawsona-media://' || p_object_name
      and avatar_profile.id::text = split_part(p_object_name, '/', 1)
      and viewer_member.user_id = (select auth.uid())
  )
) guarded where (select pawsona_private.session_is_current());
$function$
;
CREATE OR REPLACE FUNCTION public.save_care_group_workspace_checked(p_group_id uuid, p_expected_updated_at timestamp with time zone, p_workspace jsonb, p_group_name text, p_pet_name text, p_pet_breed text, p_pet_age text, p_pet_avatar text, p_pet_species text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_member public.care_group_members%rowtype; v_stamp timestamptz; v_workspace jsonb;
begin
  perform pawsona_private.require_current_session();
  select * into v_member from public.care_group_members where group_id = p_group_id and user_id = (select auth.uid());
  if not found or (v_member.role = 'Viewer' and not v_member.is_owner) then raise exception 'You do not have permission to update this care group.'; end if;
  select updated_at into v_stamp from public.care_groups where id = p_group_id for update;
  if v_stamp is distinct from p_expected_updated_at then raise exception 'Shared records changed on another device. Your edits are kept on this device. Reload before editing again.'; end if;
  if jsonb_typeof(p_workspace) <> 'object' then raise exception 'Invalid workspace.'; end if;
  v_workspace := p_workspace - 'askMessages' - 'askOwnerAccountId' - 'drafts' - 'sharedUpdatedAt';
  v_workspace := jsonb_set(v_workspace, '{observations}', coalesce((select jsonb_agg(o) from jsonb_array_elements(coalesce(v_workspace->'observations','[]')) o where coalesce(o->>'privateRecord','false') <> 'true'), '[]'));
  v_workspace := jsonb_set(v_workspace, '{contexts}', coalesce((select jsonb_agg(c) from jsonb_array_elements(coalesce(v_workspace->'contexts','[]')) c where exists(select 1 from jsonb_array_elements(v_workspace->'observations') o where o->>'id'=c->>'momentId')), '[]'));
  v_workspace := jsonb_set(v_workspace, '{lifeEvents}', coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(v_workspace->'lifeEvents','[]')) e where e->>'useForAsk'='true'), '[]'));
  v_workspace := jsonb_set(v_workspace, '{petSex}', to_jsonb(case
    when v_member.is_owner and p_workspace->>'petSex' in ('Female','Male','Unknown') then p_workspace->>'petSex'
    else (select pet_sex from public.care_groups where id=p_group_id) end));
  update public.care_groups set workspace = v_workspace,
    pet_sex = v_workspace->>'petSex',
    group_name = case when v_member.is_owner then left(p_group_name,80) else group_name end,
    pet_name = case when v_member.is_owner then left(p_pet_name,120) else pet_name end,
    pet_breed = case when v_member.is_owner then left(p_pet_breed,120) else pet_breed end,
    pet_age = case when v_member.is_owner then left(p_pet_age,32) else pet_age end,
    pet_avatar = case when v_member.is_owner then left(p_pet_avatar,2000000) else pet_avatar end,
    pet_species = case when v_member.is_owner then p_pet_species else pet_species end
    where id=p_group_id returning updated_at into v_stamp;
  return v_stamp;
end; $function$
;
