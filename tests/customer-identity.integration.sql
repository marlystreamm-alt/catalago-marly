begin;
do $$
declare c uuid:=gen_random_uuid(); a uuid; sid uuid:=gen_random_uuid(); subject_id uuid:=gen_random_uuid(); google_sid uuid:=gen_random_uuid(); email text:=c::text||'@example.invalid'; cyber_email text:='cyberdoc999999999@martgor.shop'; cyber_client uuid:=gen_random_uuid(); result uuid;
begin
  insert into public.ma2_ops_records(id,module,title,status,payload_cipher) values(c,'clients','Identity recovery fixture','active','fixture'),(cyber_client,'clients','Cyberdoc fixture','active','fixture');
  insert into public.ma2_customer_accounts(client_id,email,password_hash,salt) values(c,email,repeat('a',64),repeat('a',32)) returning id into a;
  insert into public.ma2_customer_accounts(client_id,email,password_hash,salt,access_mode) values(cyber_client,cyber_email,repeat('a',64),repeat('a',32),'cyberdoc');
  insert into public.ma2_customer_sessions(token_hash,account_id,expires_at) values(gen_random_uuid()::text,a,now()+interval '1 day');
  if not public.ma2_customer_reset_verified(email,sid,repeat('b',64),repeat('b',32)) then raise exception 'valid recovery rejected';end if;
  if public.ma2_customer_reset_verified(email,sid,repeat('c',64),repeat('c',32)) then raise exception 'replayed recovery accepted';end if;
  if exists(select 1 from public.ma2_customer_sessions where account_id=a) then raise exception 'old session not removed';end if;
  if public.ma2_customer_reset_verified(cyber_email,gen_random_uuid(),repeat('b',64),repeat('b',32)) then raise exception 'Cyberdoc recovery not excluded';end if;
  if public.ma2_customer_google_verified(email,subject_id,google_sid,null,null,'','','') is not null then raise exception 'unlinked account accepted without password proof';end if;
  result:=public.ma2_customer_google_verified(email,subject_id,google_sid,repeat('b',64),null,'','','');
  if result is distinct from a then raise exception 'existing account failed to link';end if;
  if public.ma2_customer_google_verified(email,subject_id,google_sid,null,null,'','','') is not null then raise exception 'replayed Google session accepted';end if;
  if public.ma2_customer_google_verified(email,gen_random_uuid(),gen_random_uuid(),null,null,'','','') is not null then raise exception 'different identity accepted';end if;
  if public.ma2_customer_google_verified(email,subject_id,gen_random_uuid(),null,null,'','','') is distinct from a then raise exception 'linked identity could not enter';end if;
  if public.ma2_customer_google_verified(cyber_email,subject_id,gen_random_uuid(),repeat('a',64),null,'','','') is not null then raise exception 'Cyberdoc Google login accepted';end if;
  if has_function_privilege('anon','public.ma2_customer_reset_verified(text,uuid,text,text)','execute') or has_function_privilege('authenticated','public.ma2_customer_google_verified(text,uuid,uuid,text,text,text,text,text)','execute') then raise exception 'private identity functions exposed';end if;
end; $$;
rollback;
select 'Single-use recovery, session revocation, Google linking, Cyberdoc exclusion verified' as verification;
