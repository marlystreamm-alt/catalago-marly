begin;
do $$
declare c uuid:=gen_random_uuid(); ref text; e uuid; trace text:=gen_random_uuid()::text; n integer; total bigint;
begin
  insert into public.ma2_ops_records(id,module,title,status,payload_cipher) values(c,'clients','Transactional permanent recharge fixture','active','fixture') returning client_reference into ref;
  insert into public.ma2_customer_accounts(client_id,email,password_hash,salt) values(c,c::text||'@example.invalid','fixture','fixture');
  insert into public.ma2_recharge_config(id,settings,password_cipher,tested_signature,started_at)
    values(1,'{"enabled":true,"minimum":1,"maximum":5000}','fixture','fixture',now()-interval '1 hour')
    on conflict(id) do update set settings=excluded.settings,tested_signature='fixture',started_at=excluded.started_at;
  insert into public.ma2_recharge_events(source_key,received_at,amount_cents,reference,tracking,transfer_key,verified,config_signature)
    values(gen_random_uuid()::text,now(),1200,ref,trace,trace,true,'fixture') returning id into e;
  if public.ma2_recharge_settle(e)<>'credited' or public.ma2_recharge_settle(e)<>'credited' then raise exception 'permanent credit failed'; end if;
  insert into public.ma2_recharge_events(source_key,received_at,amount_cents,reference,transfer_key,verified,config_signature)
    values(gen_random_uuid()::text,now(),1200,ref,trace,true,'fixture') returning id into e;
  if public.ma2_recharge_settle(e)<>'duplicate' then raise exception 'permanent duplicate accepted'; end if;
  insert into public.ma2_recharge_events(source_key,received_at,amount_cents,reference,transfer_key,verified,config_signature)
    values(gen_random_uuid()::text,now(),1200,ref,gen_random_uuid()::text,false,'fixture') returning id into e;
  if public.ma2_recharge_settle(e)<>'review' then raise exception 'unverified permanent notice accepted'; end if;
  select count(*),sum(amount_cents) into n,total from public.ma2_wallet_entries where client_id=c;
  if n<>1 or total<>1200 then raise exception 'unexpected wallet entries'; end if;
end; $$;
rollback;
select 'Permanent reference settlement verified; fixtures rolled back' as verification;
