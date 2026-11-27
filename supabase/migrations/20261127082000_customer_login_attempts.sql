create function public.ma2_customer_login_attempt(p_key text) returns integer
language sql security invoker set search_path=public,pg_temp as $$
  insert into public.ma2_customer_limits as limits (key, attempts)
  values (p_key, 1)
  on conflict (key) do update
    set attempts = least(limits.attempts + 1, 6)
  returning attempts;
$$;

revoke all on function public.ma2_customer_login_attempt(text) from public,anon,authenticated;
grant execute on function public.ma2_customer_login_attempt(text) to service_role;
notify pgrst, 'reload schema';
