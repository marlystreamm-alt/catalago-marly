alter table public.ma2_customer_accounts add column access_mode text not null default 'normal' check(access_mode in ('normal','cyberdoc')),
  add column identity_user_id uuid;
create unique index ma2_customer_main_identity_unique on public.ma2_customer_accounts(identity_user_id) where business_id is null and identity_user_id is not null;
update public.ma2_customer_accounts set access_mode='cyberdoc' where email ~* '^cyberdoc[0-9]+@martgor\.shop$';
create table public.ma2_customer_identity_uses(session_id uuid not null,purpose text not null check(purpose in ('reset','google')),account_id uuid not null references public.ma2_customer_accounts(id),used_at timestamptz not null default now(),primary key(session_id,purpose));
alter table public.ma2_customer_identity_uses enable row level security;
revoke all on public.ma2_customer_identity_uses from public,anon,authenticated;
grant select,insert,delete on public.ma2_customer_identity_uses to service_role;

create function public.ma2_customer_reset_verified(p_email text,p_session uuid,p_hash text,p_salt text) returns boolean
language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.ma2_customer_accounts;
begin
  if p_email ~* '^cyberdoc[0-9]+@martgor\.shop$' or p_hash !~ '^[a-f0-9]{64}$' or p_salt !~ '^[a-f0-9]{32}$' then return false; end if;
  select c.* into a from public.ma2_customer_accounts c join public.ma2_ops_records r on r.id=c.client_id where c.email=p_email and c.business_id is null and c.active and c.access_mode='normal' and r.status='active' and r.module='clients' and r.archived_at is null for update of c;
  if not found then return false;end if;
  insert into public.ma2_customer_identity_uses(session_id,purpose,account_id) values(p_session,'reset',a.id) on conflict do nothing;
  if not found then return false;end if;
  update public.ma2_customer_accounts set password_hash=p_hash,salt=p_salt,must_change=false where id=a.id;
  delete from public.ma2_customer_sessions where account_id=a.id;
  return true;
end; $$;

-- Only the trusted server calls this after verifying a recent Google identity proof.
-- Existing passwords must be verified before first-time linking, and are never overwritten.
create function public.ma2_customer_google_verified(p_email text,p_subject uuid,p_session uuid,p_current_hash text,p_name text,p_hash text,p_salt text,p_payload text) returns uuid
language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.ma2_customer_accounts; c uuid;
begin
  if p_email ~* '^cyberdoc[0-9]+@martgor\.shop$' then return null;end if;
  perform pg_advisory_xact_lock(hashtextextended('ma2-identity:'||p_email,0));
  if exists(select 1 from public.ma2_customer_identity_uses where session_id=p_session and purpose='google') then return null; end if;
  select x.* into a from public.ma2_customer_accounts x where x.email=p_email and x.business_id is null for update;
  if found then
    if not a.active or a.access_mode<>'normal' or (a.identity_user_id is not null and a.identity_user_id<>p_subject) then return null; end if;
    if not exists(select 1 from public.ma2_ops_records where id=a.client_id and module='clients' and status='active' and archived_at is null) then return null;end if;
    if a.identity_user_id is null then
      if p_current_hash is null or p_current_hash<>a.password_hash then return null;end if;
      update public.ma2_customer_accounts set identity_user_id=p_subject where id=a.id;
    end if;
  else
    if p_name is null or length(trim(p_name))<2 or p_hash !~ '^[a-f0-9]{64}$' or p_salt !~ '^[a-f0-9]{32}$' or p_payload is null or p_payload='' then return null;end if;
    insert into public.ma2_ops_records(module,title,status,payload_cipher) values('clients',p_name,'active',p_payload) returning id into c;
    insert into public.ma2_customer_accounts(client_id,email,password_hash,salt,identity_user_id) values(c,p_email,p_hash,p_salt,p_subject) returning * into a;
  end if;
  insert into public.ma2_customer_identity_uses(session_id,purpose,account_id) values(p_session,'google',a.id);
  return a.id;
end; $$;
revoke all on function public.ma2_customer_reset_verified(text,uuid,text,text),public.ma2_customer_google_verified(text,uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.ma2_customer_reset_verified(text,uuid,text,text),public.ma2_customer_google_verified(text,uuid,uuid,text,text,text,text,text) to service_role;
notify pgrst,'reload schema';
