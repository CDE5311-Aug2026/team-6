begin;

-- Keep recall enforceable even if a client bypasses the UI's 10-minute timer.
drop policy if exists care_messages_update_own on public.care_messages;
create policy care_messages_update_own on public.care_messages
for update to authenticated
using (
  sender_id = (select auth.uid())
  and deleted_at is null
  and created_at >= now() - interval '10 minutes'
  and public.is_care_conversation_member(conversation_id)
)
with check (
  sender_id = (select auth.uid())
  and deleted_at is not null
  and public.is_care_conversation_member(conversation_id)
);

commit;

