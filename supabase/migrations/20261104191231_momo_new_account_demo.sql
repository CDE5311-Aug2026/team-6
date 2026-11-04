-- Momo is a versioned, fictional starter dataset, copied once into new
-- accounts. Existing workspaces are never updated by this migration.
create table pawsona_private.demo_pet_templates (
  id text primary key,
  pet jsonb not null check (jsonb_typeof(pet) = 'object'),
  enabled boolean not null default false,
  activated_at timestamptz not null default now(),
  check (octet_length(pet::text) <= 524288),
  check (jsonb_array_length(pet #> '{workspace,observations}') = 50)
);
alter table pawsona_private.demo_pet_templates enable row level security;
revoke all on pawsona_private.demo_pet_templates from public, anon, authenticated;
comment on table pawsona_private.demo_pet_templates is
  'Private configuration. No client policies by design; only the first-workspace trigger reads this immutable demo template.';

-- Only synthetic illustration assets belong in this bucket. No client write
-- policies are installed. Publication is a separate, bounded operator task.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('pawsona-demo','pawsona-demo',true,5242880,array['image/jpeg'])
on conflict (id) do nothing;

create function pawsona_private.shift_demo_dates(value jsonb, day_shift integer)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare result jsonb; item record; text_value text;
begin
  case jsonb_typeof(value)
    when 'object' then
      result := '{}'::jsonb;
      for item in select key,val from jsonb_each(value) as e(key,val) loop
        result := result || jsonb_build_object(item.key,pawsona_private.shift_demo_dates(item.val,day_shift));
      end loop;
      return result;
    when 'array' then
      result := '[]'::jsonb;
      for item in select val from jsonb_array_elements(value) as e(val) loop
        result := result || jsonb_build_array(pawsona_private.shift_demo_dates(item.val,day_shift));
      end loop;
      return result;
    when 'string' then
      text_value := value #>> '{}';
      if text_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}($|T)' then
        return to_jsonb(((left(text_value,10)::date + day_shift)::text) || substring(text_value from 11));
      end if;
      return value;
    else return value;
  end case;
end;
$$;
revoke all on function pawsona_private.shift_demo_dates(jsonb,integer) from public,anon,authenticated;

create function pawsona_private.seed_momo_first_workspace()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  template pawsona_private.demo_pet_templates%rowtype;
  account jsonb; placeholder jsonb; pet jsonb; observations jsonb := '[]'::jsonb;
  observation jsonb; summaries jsonb; stories jsonb;
  user_created_at timestamptz;
  period_end date := (now() at time zone 'Asia/Singapore')::date - 1;
  shift_days integer;
begin
  -- This function has no API EXECUTE grant; table ownership/RLS and the
  -- existing current-session trigger still govern the INSERT that invokes it.
  if auth.uid() is not null and auth.uid() <> new.user_id then
    raise exception 'Account mismatch';
  end if;
  if new.payload ->> 'activeAccountId' is distinct from new.user_id::text
     or jsonb_typeof(new.payload -> 'accounts') is distinct from 'array'
     or jsonb_array_length(new.payload -> 'accounts') <> 1 then return new; end if;
  account := new.payload #> '{accounts,0}';
  if account ->> 'id' is distinct from new.user_id::text
     or jsonb_typeof(account -> 'pets') is distinct from 'array'
     or jsonb_array_length(account -> 'pets') <> 1 then return new; end if;
  placeholder := account #> '{pets,0}';
  if placeholder -> 'isEmptyProfile' is distinct from 'true'::jsonb then return new; end if;
  -- A caller-created pet or any existing content must never be replaced.
  if exists (
    select 1 from jsonb_each(coalesce(placeholder -> 'workspace','{}'::jsonb)) as e(key,val)
    where key in ('observations','contexts','drafts','careTasks','lifeEvents','patterns','askMessages')
      and val is distinct from '[]'::jsonb
  ) then return new; end if;
  select * into template from pawsona_private.demo_pet_templates
    where enabled order by activated_at desc,id limit 1;
  if not found then return new; end if;
  select created_at into user_created_at from auth.users where id=new.user_id;
  if user_created_at is null or user_created_at < template.activated_at then return new; end if;

  pet := template.pet;
  shift_days := period_end - (pet #>> '{testData,periodEnd}')::date;
  for observation in select value from jsonb_array_elements(
    pawsona_private.shift_demo_dates(pet #> '{workspace,observations}',shift_days)
  ) loop
    -- Pawsona's current timeline uses savedAt as the event time. Preserve the
    -- original after-event logging time separately instead of moving a meal.
    observation := observation || jsonb_build_object(
      'authorId',new.user_id::text,'authorName','Demo caregiver',
      'recordedAt',observation ->> 'savedAt','savedAt',observation ->> 'observedAt');
    observations := observations || jsonb_build_array(observation);
  end loop;
  summaries := pawsona_private.shift_demo_dates(pet #> '{testData,dailySummaries}',shift_days);
  stories := pawsona_private.shift_demo_dates(pet #> '{testData,dailyStories}',shift_days);
  pet := jsonb_set(pet,'{workspace,observations}',observations);
  pet := jsonb_set(pet,'{workspace,careMembers}',jsonb_build_array(jsonb_build_object(
    'id',new.user_id::text,'name',coalesce(account ->> 'name','Pet caregiver'),
    'role','Primary caregiver','detail','manages this demo pet profile')));
  pet := jsonb_set(pet,'{workspace,askOwnerAccountId}',to_jsonb(new.user_id::text));
  pet := jsonb_set(pet,'{workspace,scenarioDate}',to_jsonb(period_end::text));
  pet := jsonb_set(pet,'{testData,dailySummaries}',summaries);
  pet := jsonb_set(pet,'{testData,dailyStories}',stories);
  pet := jsonb_set(pet,'{testData,periodStart}',to_jsonb((period_end-6)::text));
  pet := jsonb_set(pet,'{testData,periodEnd}',to_jsonb(period_end::text));
  pet := jsonb_set(pet,'{testData,seededAt}',to_jsonb(now()));
  account := account || jsonb_build_object('pets',jsonb_build_array(pet),
    'activePetId',pet ->> 'id','setupStatus','completed','guideStatus','pending',
    'demoSeedVersion',template.id);
  new.payload := jsonb_set(new.payload,'{accounts}',jsonb_build_array(account));
  return new;
end;
$$;
revoke all on function pawsona_private.seed_momo_first_workspace() from public,anon,authenticated;
create trigger pawsona_seed_momo_first_workspace before insert on public.personal_workspaces
for each row execute function pawsona_private.seed_momo_first_workspace();
