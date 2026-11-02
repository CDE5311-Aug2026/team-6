
begin;
do $test$
declare u uuid:=gen_random_uuid(); s1 uuid:=gen_random_uuid(); s2 uuid:=gen_random_uuid(); rejected boolean:=false;
begin
  insert into auth.users(id,email) values(u,'session-fence-'||u||'@tests.pawsona.invalid');
  insert into auth.sessions(id,user_id,created_at,updated_at) values(s1,u,now()-interval '2 minutes',now()),(s2,u,now()-interval '1 minute',now());
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',u,'session_id',s1)::text,true);
  if not public.pawsona_claim_session() then raise exception 'First session did not claim'; end if;
  perform pawsona_private.require_current_session();
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',u,'session_id',s2)::text,true);
  if not public.pawsona_claim_session() then raise exception 'Newer session did not claim'; end if;
  perform pawsona_private.require_current_session();
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',u,'session_id',s1)::text,true);
  if public.pawsona_session_status() or public.pawsona_claim_session() then raise exception 'Old session regained ownership'; end if;
  begin
    perform public.save_care_group_workspace_checked(gen_random_uuid(),now(),'{}','test','test','test','1','','Dog');
  exception when invalid_authorization_specification then rejected:=true; end;
  if not rejected then raise exception 'Old RPC session was not fenced'; end if;
  rejected:=false;
  begin
    insert into public.personal_workspaces(user_id,payload,revision) values(u,'{}',1);
  exception when invalid_authorization_specification then rejected:=true; end;
  if not rejected then raise exception 'Old direct write was not fenced'; end if;
  delete from auth.sessions where id=s2;
  if public.pawsona_claim_session() then raise exception 'Logout resurrected an older session'; end if;
end;
$test$;
rollback;