-- Shared group rows must never contain owner-private records or chat/drafts.
create or replace function pawsona_private.redact_care_group_workspace()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare w jsonb;
begin
  w := coalesce(new.workspace, '{}'::jsonb) - 'askMessages' - 'askOwnerAccountId' - 'drafts' - 'sharedUpdatedAt';
  w := jsonb_set(w, '{observations}', coalesce((select jsonb_agg(o) from jsonb_array_elements(coalesce(w->'observations','[]'::jsonb)) o where coalesce(o->>'privateRecord','false') <> 'true'), '[]'::jsonb));
  w := jsonb_set(w, '{lifeEvents}', coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(w->'lifeEvents','[]'::jsonb)) e where e->>'useForAsk'='true'), '[]'::jsonb));
  w := jsonb_set(w, '{contexts}', coalesce((select jsonb_agg(c) from jsonb_array_elements(coalesce(w->'contexts','[]'::jsonb)) c where exists(select 1 from jsonb_array_elements(w->'observations') o where o->>'id'=c->>'momentId')), '[]'::jsonb));
  new.workspace := w;
  return new;
end;
$$;
revoke all on function pawsona_private.redact_care_group_workspace() from public, anon, authenticated;
create trigger redact_shared_workspace before insert or update of workspace on public.care_groups
for each row execute function pawsona_private.redact_care_group_workspace();
