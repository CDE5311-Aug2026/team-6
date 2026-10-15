begin;
create schema if not exists pawsona_private;
revoke all on schema pawsona_private from public, anon, authenticated;
grant usage on schema pawsona_private to service_role;
create table pawsona_private.signup_attempts (
  bucket text not null check (char_length(bucket) between 1 and 64),
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0),
  primary key (bucket, window_start)
);
alter table pawsona_private.signup_attempts enable row level security;
revoke all on pawsona_private.signup_attempts from public, anon, authenticated;
grant all on pawsona_private.signup_attempts to service_role;
create function public.pawsona_signup_quota(p_bucket text, p_limit integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_attempts integer;
begin
  if p_limit < 1 or p_limit > 1000 or char_length(p_bucket) > 64 then return false; end if;
  delete from pawsona_private.signup_attempts where window_start < now() - interval '1 day';
  insert into pawsona_private.signup_attempts(bucket, window_start, attempts)
  values (p_bucket, date_trunc('hour', now()), 1)
  on conflict (bucket, window_start) do update
    set attempts = pawsona_private.signup_attempts.attempts + 1
    where pawsona_private.signup_attempts.attempts < p_limit
  returning attempts into v_attempts;
  return found;
end;
$$;
revoke all on function public.pawsona_signup_quota(text,integer) from public, anon, authenticated;
grant execute on function public.pawsona_signup_quota(text,integer) to service_role;
commit;
