-- Fixtures and audit records are rolled back. No customer stock is touched.
begin;
set local role service_role;
do $$
declare parent_id uuid := gen_random_uuid(); child public.stock_items; n integer;
begin
  insert into public.stock_items(id,platform,username,password_cipher,panel_url,panel_username,panel_password_cipher,notes,related_order_id)
    values(parent_id,'fixture profiles','fixture@example.test','fixture-cipher','https://example.test','fixture-panel','fixture-panel-cipher','Conservar nota','');
  n := public.ma2_stock_convert_profiles(parent_id,null,3);
  if n<>3 or (select count(*) from public.stock_items where parent_stock_id=parent_id)<>3 then raise exception 'Wrong count';end if;
  if (select status from public.stock_items where id=parent_id)<>'expired' then raise exception 'Parent still available';end if;
  if exists(select 1 from public.stock_items where parent_stock_id=parent_id and (password_cipher<>'fixture-cipher' or panel_password_cipher<>'fixture-panel-cipher' or stock_kind<>'profile' or status<>'available')) then raise exception 'Lost credentials';end if;
  begin
    perform public.ma2_stock_convert_profiles(parent_id,null,3);
    raise exception 'Repeat conversion allowed';
  exception when raise_exception then
    if sqlerrm='Repeat conversion allowed' then raise;end if;
  end;
  if (select count(*) from public.stock_items where parent_stock_id=parent_id)<>3 then raise exception 'Repeat duplicated profiles';end if;
  select * into child from public.stock_items where parent_stock_id=parent_id limit 1;
  delete from public.stock_items where id=child.id;
  child.id := gen_random_uuid();
  insert into public.stock_items select child.*;
  if (select count(*) from public.stock_items where parent_stock_id=parent_id)<>3 then raise exception 'Deleted profile cannot be readded';end if;
  begin
    perform public.ma2_stock_convert_profiles(parent_id,gen_random_uuid(),2);
    raise exception 'Cross-business conversion allowed';
  exception when raise_exception then
    if sqlerrm='Cross-business conversion allowed' then raise;end if;
  end;
  begin
    perform public.ma2_stock_convert_profiles(parent_id,null,11);
    raise exception 'Invalid count allowed';
  exception when raise_exception then
    if sqlerrm='Invalid count allowed' then raise;end if;
  end;
end $$;
select 'Conversion, saved credentials, retry, deletion/re-add and business scope passed' result;
rollback;
