-- Share media contributed by any current member, only while referenced by a
-- non-private shared Story record. Keep the bucket private and the existing
-- restrictive current-session policy in force.
-- Reuse the existing session-checked care-group RPC to verify both members;
-- do not add a SECURITY DEFINER function or allow an entire uploader folder.
create policy pawsona_media_read_shared_story
on storage.objects for select to authenticated
using (
  bucket_id = 'pawsona-media'
  and exists (
    select 1
    from public.list_my_care_groups() g
    cross join lateral jsonb_array_elements(coalesce(g.workspace->'observations', '[]'::jsonb)) observation
    where g.members @> jsonb_build_array(jsonb_build_object('id', split_part(storage.objects.name, '/', 1)))
      and observation->'privateRecord' is distinct from 'true'::jsonb
      and (
        observation->>'image' = 'pawsona-media://' || storage.objects.name
        or exists (
          select 1 from jsonb_array_elements(coalesce(observation->'relatedPhotos', '[]'::jsonb)) attachment
          where attachment->>'url' = 'pawsona-media://' || storage.objects.name
        )
      )
  )
);
