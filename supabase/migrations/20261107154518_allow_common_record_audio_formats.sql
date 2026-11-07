-- Match record and chat upload controls with common browser recording formats.
update storage.buckets set allowed_mime_types = array(select distinct value from unnest(coalesce(allowed_mime_types,array[]::text[]) || array['audio/wav','audio/x-wav','audio/wave','audio/vnd.wave','audio/aac','audio/x-m4a']) value) where id in ('pawsona-media','care-chat-media');
