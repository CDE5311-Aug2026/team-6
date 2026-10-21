-- Optional biological sex; old profiles remain Unknown, never inferred.
alter table public.care_groups add column if not exists pet_sex text not null default 'Unknown';
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.care_groups'::regclass and conname='care_groups_pet_sex_check') then
    alter table public.care_groups add constraint care_groups_pet_sex_check check (pet_sex in ('Female','Male','Unknown'));
  end if;
end $$;
-- New circles inherit the owner's already saved profile field on creation.
create or replace function public.initialize_care_group_pet_sex() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  new.pet_sex := case when new.workspace->>'petSex' in ('Female','Male','Unknown') then new.workspace->>'petSex' else 'Unknown' end;
  return new;
end; $$;
revoke all on function public.initialize_care_group_pet_sex() from public, anon, authenticated;
drop trigger if exists initialize_pet_sex on public.care_groups;
create trigger initialize_pet_sex before insert on public.care_groups for each row execute function public.initialize_care_group_pet_sex();

-- Deployment script: compare the timestamp of the workspace the caller actually read.
-- No schema columns or existing records are removed.
create or replace function public.save_care_group_workspace_checked(
  p_group_id uuid, p_expected_updated_at timestamptz, p_workspace jsonb, p_group_name text,
  p_pet_name text, p_pet_breed text, p_pet_age text, p_pet_avatar text, p_pet_species text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_member public.care_group_members%rowtype; v_stamp timestamptz; v_workspace jsonb;
begin
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
end; $$;
revoke all on function public.save_care_group_workspace_checked(uuid,timestamptz,jsonb,text,text,text,text,text,text) from public, anon;
grant execute on function public.save_care_group_workspace_checked(uuid,timestamptz,jsonb,text,text,text,text,text,text) to authenticated;

