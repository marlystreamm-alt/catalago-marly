begin;
do $$
declare client uuid:=gen_random_uuid(); req public.ma2_recharge_requests; other public.ma2_recharge_requests; eid uuid; n integer; total bigint; outcome text; cfg jsonb:='{"enabled":true,"minimum":1,"maximum":5000,"minutes":60,"openLimit":5,"dailyLimit":0,"uniqueCents":false,"bonusPercent":10}';
begin
 insert into public.ma2_ops_records(id,module,title,status,payload_cipher) values(client,'clients','Transactional recharge verification','active','fixture');
 insert into public.ma2_recharge_config(id,settings,password_cipher,tested_signature) values(1,cfg,'fixture','fixture') on conflict(id) do update set settings=excluded.settings,password_cipher='fixture',tested_signature='fixture';
 req:=public.ma2_recharge_create(client,1500);
 insert into public.ma2_recharge_events(source_key,received_at,amount_cents,reference,tracking,transfer_key,verified,config_signature) values(gen_random_uuid()::text,now(),req.payable_cents,req.reference,'fixture-trace','fixture-'||client,true,'fixture') returning id into eid;
 outcome:=public.ma2_recharge_settle(eid);if outcome<>'credited' then raise exception 'valid payment not credited: %',outcome;end if;
 perform public.ma2_recharge_settle(eid);
 select count(*),sum(amount_cents) into n,total from public.ma2_wallet_entries where client_id=client;
 if n<>1 or total<>1650 then raise exception 'replay or bonus mismatch % %',n,total;end if;
 insert into public.ma2_recharge_events(source_key,received_at,amount_cents,reference,transfer_key,verified,config_signature) values(gen_random_uuid()::text,now(),req.payable_cents,req.reference,'fixture-'||client,true,'fixture') returning id into eid;
 if public.ma2_recharge_settle(eid)<>'duplicate' then raise exception 'duplicate transfer allowed';end if;
 req:=public.ma2_recharge_create(client,2500);
 insert into public.ma2_recharge_events(source_key,received_at,amount_cents,reference,transfer_key,verified,config_signature) values(gen_random_uuid()::text,now(),2400,req.reference,gen_random_uuid()::text,true,'fixture') returning id into eid;
 if public.ma2_recharge_settle(eid)<>'review' then raise exception 'wrong amount credited';end if;
 update public.ma2_recharge_events set amount_cents=2500,verified=false where id=eid;
 if public.ma2_recharge_settle(eid)<>'review' then raise exception 'unverified credited';end if;
 update public.ma2_recharge_events set verified=true,config_signature='different-config' where id=eid;
 if public.ma2_recharge_settle(eid)<>'review' then raise exception 'old mailbox credited';end if;
 select count(*) into n from public.ma2_wallet_entries where client_id=client;if n<>1 then raise exception 'invalid payment wrote wallet';end if;
 update public.ma2_recharge_config set settings=jsonb_set(cfg,'{uniqueCents}','true') where id=1;
 req:=public.ma2_recharge_create(client,5000);other:=public.ma2_recharge_create(client,5000);
 if req.payable_cents=other.payable_cents or req.payable_cents=5000 then raise exception 'unique cents collision';end if;
 insert into public.ma2_recharge_events(source_key,received_at,amount_cents,reference,transfer_key,verified,config_signature) values(gen_random_uuid()::text,now(),req.payable_cents,other.reference,gen_random_uuid()::text,true,'fixture') returning id into eid;
 if public.ma2_recharge_settle(eid)<>'review' then raise exception 'valid but mismatched reference fell through';end if;
 update public.ma2_recharge_events set reference=null where id=eid;
 -- Processing after a request was marked expired still accepts a receipt that arrived during its window.
 update public.ma2_recharge_requests set status='expired' where id=req.id;
 if public.ma2_recharge_settle(eid)<>'credited' then raise exception 'unique cents fallback failed';end if;
 insert into public.ma2_recharge_events(source_key,received_at,amount_cents,reference,transfer_key,verified,config_signature) values(gen_random_uuid()::text,other.expires_at+interval '1 second',other.payable_cents,other.reference,gen_random_uuid()::text,true,'fixture') returning id into eid;
 if public.ma2_recharge_settle(eid)<>'review' then raise exception 'late receipt credited';end if;
 update public.ma2_recharge_config set started_at=now()+interval '1 second' where id=1;
 if exists(select 1 from public.ma2_recharge_requests where client_id=client and status='pending') then raise exception 'old references remained active';end if;
 if has_table_privilege('anon','public.ma2_recharge_config','SELECT') or has_table_privilege('authenticated','public.ma2_recharge_events','SELECT') or has_function_privilege('anon','public.ma2_recharge_settle(uuid)','EXECUTE') or has_function_privilege('authenticated','public.ma2_recharge_create(uuid,bigint)','EXECUTE') then raise exception 'public permissions leak';end if;
end;$$;
rollback;
select 'All recharge transaction, duplicate, mismatch, cents, expiry, identity and permission checks passed; fixtures rolled back.' as verification;
