begin;

-- Members need to view media that belongs to the pet owner in a shared care group.
-- Uploads, updates, and deletes remain restricted to each user's own folder.
drop policy if exists pawsona_media_read on storage.objects;
create policy pawsona_media_read on storage.objects for select to authenticated
using (
  bucket_id = 'pawsona-media'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1
      from public.care_group_members member
      join public.care_groups care_group on care_group.id = member.group_id
      where member.user_id = (select auth.uid())
        and care_group.owner_id::text = (storage.foldername(name))[1]
    )
  )
);

commit;
