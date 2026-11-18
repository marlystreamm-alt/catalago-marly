create table public.ma2_customer_accounts(
 id uuid primary key default gen_random_uuid(),client_id uuid not null unique references public.ma2_ops_records(id),business_id uuid references public.menu_businesses(id),
 email text not null check(length(email)<=254),password_hash text not null,salt text not null,must_change boolean not null default false,active boolean not null default true,created_at timestamptz not null default now()
);
create unique index ma2_customer_shop_email on public.ma2_customer_accounts(coalesce(business_id,'00000000-0000-0000-0000-000000000000'::uuid),email);
create index ma2_customer_shop on public.ma2_customer_accounts(business_id);
create table public.ma2_customer_sessions(token_hash text primary key,account_id uuid not null references public.ma2_customer_accounts(id) on delete cascade,expires_at timestamptz not null,created_at timestamptz not null default now());
create index ma2_customer_session_account on public.ma2_customer_sessions(account_id);
create table public.ma2_customer_limits(key text primary key,window_start timestamptz not null default now(),attempts integer not null default 0);
create table public.ma2_customer_orders(id uuid primary key,client_id uuid not null references public.ma2_ops_records(id),business_id uuid references public.menu_businesses(id),stock_id uuid not null references public.stock_items(id),amount_cents bigint not null check(amount_cents>0),title text not null,detail jsonb not null,expires_on date,created_at timestamptz not null default now());
create index ma2_customer_order_client on public.ma2_customer_orders(client_id,created_at desc);
create index ma2_customer_order_business on public.ma2_customer_orders(business_id);
create table public.ma2_shop_licenses(sale_request_id uuid primary key references public.notification_log(id),business_id uuid not null unique references public.menu_businesses(id),created_at timestamptz not null default now());
alter table public.ma2_customer_accounts enable row level security;
alter table public.ma2_customer_sessions enable row level security;
alter table public.ma2_customer_limits enable row level security;
alter table public.ma2_customer_orders enable row level security;
alter table public.ma2_shop_licenses enable row level security;
revoke all on public.ma2_customer_accounts,public.ma2_customer_sessions,public.ma2_customer_limits,public.ma2_customer_orders,public.ma2_shop_licenses from public,anon,authenticated;
grant select,insert,update,delete on public.ma2_customer_sessions to service_role;
grant select,insert,update on public.ma2_customer_accounts,public.ma2_customer_limits,public.ma2_customer_orders,public.ma2_shop_licenses to service_role;
create function public.ma2_customer_limit(p_key text,p_max integer,p_seconds integer) returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare n integer;begin
 insert into public.ma2_customer_limits(key) values(p_key) on conflict do nothing;
 update public.ma2_customer_limits set attempts=case when window_start<now()-make_interval(secs=>p_seconds) then 1 else attempts+1 end,window_start=case when window_start<now()-make_interval(secs=>p_seconds) then now() else window_start end where key=p_key returning attempts into n;
 return n<=p_max;
end;$$;
create function public.ma2_customer_register(p_business uuid,p_email text,p_hash text,p_salt text,p_name text,p_payload text) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare c uuid; a uuid;begin
 if p_business is not null and not exists(select 1 from public.menu_businesses where id=p_business and active and not access_suspended and (expires_on is null or expires_on+grace_days>=(now() at time zone 'America/Monterrey')::date)) then raise exception 'Tienda no disponible';end if;
 insert into public.ma2_ops_records(module,title,status,payload_cipher) values('clients',p_name,'active',p_payload) returning id into c;
 insert into public.ma2_customer_accounts(client_id,business_id,email,password_hash,salt) values(c,p_business,p_email,p_hash,p_salt) returning id into a;
 return a;
end;$$;
create function public.ma2_customer_buy(p_account uuid,p_stock uuid,p_price bigint,p_request uuid) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.ma2_customer_accounts; s public.stock_items; o public.ma2_customer_orders; today date:=(now() at time zone 'America/Monterrey')::date; expiry date;begin
 select * into a from public.ma2_customer_accounts where id=p_account and active and not must_change for update;
 if not found then raise exception 'Inicia sesión y actualiza tu contraseña';end if;
 if a.business_id is not null then perform 1 from public.menu_businesses where id=a.business_id and active and not access_suspended and (expires_on is null or expires_on+grace_days>=today) for share;if not found then raise exception 'Tienda no disponible';end if;end if;
 select * into o from public.ma2_customer_orders where id=p_request;
 if found then if o.client_id<>a.client_id or o.stock_id<>p_stock or o.amount_cents<>p_price then raise exception 'Solicitud ya utilizada';end if;return o.id;end if;
 select * into s from public.stock_items where id=p_stock and business_id is not distinct from a.business_id for update;
 if not found or s.status<>'available' or s.account_type='split_parent' or exists(select 1 from public.stock_items where parent_stock_id=s.id) or s.sale_price is null or s.sale_price<=0 or s.username='' or s.password_cipher='' or (s.expires_on is not null and s.expires_on<today) then raise exception 'Este producto ya no está disponible';end if;
 if round(s.sale_price*100)::bigint<>p_price then raise exception 'El precio cambió. Actualiza la tienda';end if;
 expiry:=case when s.starts_on_sale then (today+make_interval(months=>s.duration_months))::date else s.expires_on end;
 perform public.ma2_wallet_post(a.client_id,-p_price,'purchase','Compra en tienda · '||s.platform,p_request);
 insert into public.ma2_customer_orders(id,client_id,business_id,stock_id,amount_cents,title,detail,expires_on) values(p_request,a.client_id,a.business_id,s.id,p_price,s.platform||' · '||s.account_type,jsonb_build_object('username',s.username,'password_cipher',s.password_cipher,'profilePin',s.profile_pin,'stockKind',s.stock_kind),expiry);
 update public.stock_items set status='assigned',client_name=(select title from public.ma2_ops_records where id=a.client_id),client_whatsapp='',delivered_on=today,expires_on=expiry,related_order_id=p_request::text,updated_at=clock_timestamp() where id=s.id;
 insert into public.stock_history(stock_id,business_id,action,detail) values(s.id,s.business_id,'entregado','Compra desde el portal · '||p_request::text);
 return p_request;
end;$$;
create function public.ma2_activate_shop(p_sale uuid,p_name text,p_owner text,p_whatsapp text,p_plan text,p_monthly numeric,p_slug text,p_username text,p_hash text,p_salt text,p_features jsonb) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare b uuid; sp uuid;begin
 perform 1 from public.notification_log where id=p_sale and channel='ma2_sale' and status='paid' for update;
 if not found then raise exception 'Confirma el pago antes de crear la tienda';end if;
 select business_id into b from public.ma2_shop_licenses where sale_request_id=p_sale;
 if b is not null then return jsonb_build_object('businessId',b,'created',false);end if;
 insert into public.menu_businesses(name,owner_name,whatsapp,slug,access_username,access_hash,access_salt,access_temp,features,plan_name,renewal_price,expires_on,billing_day,contract_started_on,grace_days) values(p_name,p_owner,p_whatsapp,p_slug,p_username,p_hash,p_salt,true,p_features,p_plan,p_monthly,((now() at time zone 'America/Monterrey')::date+interval '1 month')::date,extract(day from now() at time zone 'America/Monterrey')::integer,(now() at time zone 'America/Monterrey')::date,0) returning id into b;
 insert into public.menu_spaces(business_id,kind,name,slug) values(b,'catalog',p_name,p_slug) returning id into sp;
 insert into public.menu_categories(business_id,space_id,name) values(b,sp,'General');
 insert into public.ma2_shop_licenses(sale_request_id,business_id) values(p_sale,b);
 return jsonb_build_object('businessId',b,'created',true);
end;$$;
revoke execute on function public.ma2_customer_limit(text,integer,integer),public.ma2_customer_register(uuid,text,text,text,text,text),public.ma2_customer_buy(uuid,uuid,bigint,uuid),public.ma2_activate_shop(uuid,text,text,text,text,numeric,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ma2_customer_limit(text,integer,integer),public.ma2_customer_register(uuid,text,text,text,text,text),public.ma2_customer_buy(uuid,uuid,bigint,uuid),public.ma2_activate_shop(uuid,text,text,text,text,numeric,text,text,text,text,jsonb) to service_role;
notify pgrst,'reload schema';
;
