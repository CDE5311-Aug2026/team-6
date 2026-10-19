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
  update public.care_groups set workspace = v_workspace,
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

-- Keep the bucket private; allow the video types exposed by the moment uploader.
update storage.buckets set allowed_mime_types = array(select distinct unnest(allowed_mime_types || array['video/mp4','video/webm','video/quicktime']))
where id='pawsona-media' and public=false;
