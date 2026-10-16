-- Allow signed-in users to find registered accounts for care-circle invitations
-- without exposing email addresses or the auth.users table to the client.
begin;

create or replace function public.search_pawsona_accounts(p_query text)
returns table (id uuid, username text, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
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
  limit 20;
$$;

revoke all on function public.search_pawsona_accounts(text) from public, anon;
grant execute on function public.search_pawsona_accounts(text) to authenticated;

commit;
