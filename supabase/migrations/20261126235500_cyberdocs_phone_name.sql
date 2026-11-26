create function public.ma2_cyberdocs_phone(input text) returns text
language sql immutable strict set search_path = '' as $$
  select case when length(d)=10 then '52'||d
    when length(d)=13 and left(d,3)='521' then '52'||substr(d,4)
    when length(d) between 11 and 15 then d end
  from (select regexp_replace(regexp_replace(trim(input),'^00',''),'[^0-9]','','g') d) t;
$$;
create table public.ma2_cyberdocs_contact_names (
  phone text primary key, first_name text not null
);
alter table public.ma2_cyberdocs_contact_names enable row level security;
revoke all on public.ma2_cyberdocs_contact_names from public,anon,authenticated;
grant select,insert,update on public.ma2_cyberdocs_contact_names to service_role;
insert into public.ma2_cyberdocs_contact_names(phone,first_name)
select distinct on (p) p,trim(client_name)
from (select *,public.ma2_cyberdocs_phone(whatsapp) p from public.cyberdocs_orders
      where source_key='cyberdocsmx_bot' and trim(client_name)<>'' ) s
where p is not null order by p,created_at,id;
create function public.ma2_cyberdocs_keep_name() returns trigger
language plpgsql set search_path='' as $$
declare p text := public.ma2_cyberdocs_phone(new.whatsapp); saved text;
begin
  if new.source_key='cyberdocsmx_bot' and p is not null then
    if trim(coalesce(new.client_name,''))<>'' then
      insert into public.ma2_cyberdocs_contact_names as c values(p,trim(new.client_name))
      on conflict(phone) do update set first_name=c.first_name returning first_name into saved;
    else
      select first_name into saved from public.ma2_cyberdocs_contact_names where phone=p;
    end if;
    new.client_name:=coalesce(saved,new.client_name);
  end if;
  return new;
end $$;
create trigger ma2_cyberdocs_keep_name before insert or update of whatsapp,client_name
on public.cyberdocs_orders for each row execute function public.ma2_cyberdocs_keep_name();
