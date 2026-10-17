begin;

-- Care-group members may read another member's profile avatar without gaining
-- access to that member's pet photos or other files in the same storage folder.
create or replace function public.can_read_care_member_avatar(p_object_name text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles avatar_profile
    join public.care_group_members avatar_member on avatar_member.user_id = avatar_profile.id
    join public.care_group_members viewer_member on viewer_member.group_id = avatar_member.group_id
    where avatar_profile.avatar_path = 'pawsona-media://' || p_object_name
      and avatar_profile.id::text = split_part(p_object_name, '/', 1)
      and viewer_member.user_id = (select auth.uid())
  );
$$;

revoke all on function public.can_read_care_member_avatar(text) from public, anon;
grant execute on function public.can_read_care_member_avatar(text) to authenticated;

drop policy if exists pawsona_media_read_care_member_avatar on storage.objects;
create policy pawsona_media_read_care_member_avatar on storage.objects for select to authenticated
using (bucket_id = 'pawsona-media' and public.can_read_care_member_avatar(name));

commit;

