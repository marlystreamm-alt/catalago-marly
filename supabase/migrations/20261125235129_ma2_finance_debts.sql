create table public.ma2_finance_debts(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('receivable','payable')),name text not null,amount_cents bigint not null check(amount_cents>0),due_on date,note text not null default '',created_at timestamptz not null default now());
alter table public.ma2_finance_debts enable row level security;
revoke all on public.ma2_finance_debts from public,anon,authenticated;
grant select,insert,update on public.ma2_finance_debts to service_role;
