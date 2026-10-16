begin;

create or replace function public.list_my_care_groups()
returns table (group_id uuid, owner_id uuid, pet_id text, pet_name text, pet_breed text, pet_age text, pet_avatar text,
  pet_species text, group_name text, workspace jsonb, role text, is_owner boolean, members jsonb)
language sql stable security definer set search_path = '' as $$
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
  where m.user_id = (select auth.uid());
$$;

revoke all on function public.list_my_care_groups() from public, anon;
grant execute on function public.list_my_care_groups() to authenticated;

commit;
