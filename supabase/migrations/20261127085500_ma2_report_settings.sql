create table public.ma2_report_settings (
  id integer primary key check (id = 1),
  days integer[] not null check (days <@ array[0, 1, 2, 3, 4, 5, 6] and array_position(days, null) is null),
  opens_at text not null check (opens_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  closes_at text not null check (closes_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  require_evidence boolean not null,
  allow_manual boolean not null
);
alter table public.ma2_report_settings enable row level security;
revoke all on public.ma2_report_settings from anon, authenticated;
grant select, insert, update on public.ma2_report_settings to service_role;
