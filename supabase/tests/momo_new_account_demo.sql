-- Run against a database with the Momo migration and template installed.
-- Everything, including the temporary Auth users, rolls back.
begin;
do $$
declare
  new_user uuid := gen_random_uuid();
  old_user uuid := gen_random_uuid();
  custom_user uuid := gen_random_uuid();
  user_row jsonb; empty_pet jsonb; payload jsonb; result jsonb; before_retry jsonb;
  expected_end date := (now() at time zone 'Asia/Singapore')::date-1;
begin
  if not exists (select 1 from pawsona_private.demo_pet_templates where enabled) then
    raise exception 'Install and activate the verified Momo template first';
  end if;
  insert into auth.users(id,email,created_at,updated_at) values
    (new_user,new_user::text||'@momo-test.invalid',now(),now()),
    (old_user,old_user::text||'@momo-test.invalid','2000-01-01',now()),
    (custom_user,custom_user::text||'@momo-test.invalid',now(),now());
  empty_pet := jsonb_build_object('id','placeholder','name','My pet','isEmptyProfile',true,
    'workspace',jsonb_build_object('observations','[]'::jsonb,'contexts','[]'::jsonb));
  user_row := jsonb_build_object('id',new_user::text,'name','QA caregiver','email','qa@momo-test.invalid',
    'activePetId','placeholder','setupStatus','pending','pets',jsonb_build_array(empty_pet));
  payload := jsonb_build_object('activeAccountId',new_user::text,'accounts',jsonb_build_array(user_row));
  insert into public.personal_workspaces(user_id,payload) values(new_user,payload);
  select w.payload into result from public.personal_workspaces w where user_id=new_user;
  if result #>> '{accounts,0,pets,0,name}' <> 'Momo'
     or jsonb_array_length(result #> '{accounts,0,pets,0,workspace,observations}') <> 50 then
    raise exception 'New user did not receive Momo and 50 observations';
  end if;
  if (select count(distinct o->>'image') from jsonb_array_elements(result #> '{accounts,0,pets,0,workspace,observations}') o) <> 50
     or exists (select 1 from jsonb_array_elements(result #> '{accounts,0,pets,0,workspace,observations}') o where coalesce(o->>'image','')='' or o->>'authorId'<>new_user::text) then
    raise exception 'Seed images or authors are incomplete';
  end if;
  if (select count(distinct left(o->>'savedAt',10)) from jsonb_array_elements(result #> '{accounts,0,pets,0,workspace,observations}') o) <> 7
     or result #>> '{accounts,0,pets,0,testData,periodEnd}' <> expected_end::text
     or result #>> '{accounts,0,pets,0,testData,periodStart}' <> (expected_end-6)::text
     or result #>> '{accounts,0,pets,0,testData,fictionalProfile,dateOfBirth}' <> '2023-07-12' then
    raise exception 'Demo dates did not shift correctly or birth date changed';
  end if;
  if result #> '{accounts,0,pets,0,testData,dailySummaries,5,afternoonRestMinutes}' <> 'null'::jsonb then
    raise exception 'Missing rest duration was invented';
  end if;
  -- A real edit is not replaced by a retry of first-login initialization.
  result := jsonb_set(result,'{accounts,0,pets,0,workspace,observations,0,note}',to_jsonb('QA owner edit'::text));
  update public.personal_workspaces set payload=result,revision=2 where user_id=new_user;
  before_retry := result;
  insert into public.personal_workspaces(user_id,payload) values(new_user,payload) on conflict(user_id) do nothing;
  select w.payload into result from public.personal_workspaces w where user_id=new_user;
  if result is distinct from before_retry then raise exception 'Initialization retry changed existing records'; end if;
  -- Accounts created before activation remain empty when initialized later.
  user_row := user_row || jsonb_build_object('id',old_user::text);
  payload := jsonb_build_object('activeAccountId',old_user::text,'accounts',jsonb_build_array(user_row));
  insert into public.personal_workspaces(user_id,payload) values(old_user,payload);
  if (select w.payload from public.personal_workspaces w where user_id=old_user) is distinct from payload then
    raise exception 'An older account was unexpectedly seeded';
  end if;
  -- A new user with an intentionally created pet also keeps that pet intact.
  user_row := user_row || jsonb_build_object('id',custom_user::text,'pets',jsonb_build_array(
    empty_pet || jsonb_build_object('name','My own dog','isEmptyProfile',false)));
  payload := jsonb_build_object('activeAccountId',custom_user::text,'accounts',jsonb_build_array(user_row));
  insert into public.personal_workspaces(user_id,payload) values(custom_user,payload);
  if (select w.payload from public.personal_workspaces w where user_id=custom_user) is distinct from payload then
    raise exception 'A caller-created pet was replaced';
  end if;
  if has_function_privilege('authenticated','pawsona_private.seed_momo_first_workspace()','execute')
     or has_table_privilege('authenticated','pawsona_private.demo_pet_templates','select') then
    raise exception 'Demo configuration is exposed to clients';
  end if;
end;
$$;
rollback;
