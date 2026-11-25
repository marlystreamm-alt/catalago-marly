create table public.ma2_finance_accounts(id uuid primary key default gen_random_uuid(),name text not null unique,opening_cents bigint not null default 0,created_at timestamptz not null default now());
create table public.ma2_finance_moves(id uuid primary key,kind text not null check(kind in ('income','expense','transfer')),account_id uuid not null references public.ma2_finance_accounts(id),to_account_id uuid references public.ma2_finance_accounts(id),amount_cents bigint not null check(amount_cents>0),occurred_on date not null,category text not null,note text not null default '',reference text not null default '',source_key text unique,voided_at timestamptz,created_at timestamptz not null default now(),check((kind='transfer' and to_account_id is not null and account_id<>to_account_id) or (kind<>'transfer' and to_account_id is null)));
create table public.ma2_finance_cuts(id uuid primary key default gen_random_uuid(),account_id uuid not null references public.ma2_finance_accounts(id),cut_on date not null,expected_cents bigint not null,counted_cents bigint not null,created_at timestamptz not null default now());
alter table public.ma2_finance_accounts enable row level security;
alter table public.ma2_finance_moves enable row level security;
alter table public.ma2_finance_cuts enable row level security;
revoke all on public.ma2_finance_accounts,public.ma2_finance_moves,public.ma2_finance_cuts from public,anon,authenticated;
grant select,insert,update on public.ma2_finance_accounts,public.ma2_finance_moves,public.ma2_finance_cuts to service_role;
