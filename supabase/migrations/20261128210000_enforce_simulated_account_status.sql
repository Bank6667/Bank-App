create or replace function public.simulate_transfer(
  p_user_id uuid,
  p_amount numeric,
  p_description text,
  p_demo_pin text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_account_id uuid;
  v_balance numeric;
  v_hash text;
  v_tx_id uuid;
  v_transfer_config jsonb;
  v_account_status text;
begin
  if p_user_id is null then raise exception 'User is required'; end if;
  select value into v_transfer_config from public.app_settings where key = 'transfer_config';
  if coalesce((v_transfer_config ->> 'enabled')::boolean, false) is not true then
    raise exception 'Simulated transfers are currently paused by the administrator';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000000 then
    raise exception 'Enter a valid simulated amount';
  end if;
  if p_description is null or length(trim(p_description)) < 2 or length(p_description) > 160 then
    raise exception 'Enter a valid recipient or transfer description';
  end if;
  select demo_pin_hash into v_hash from public.profiles where id = p_user_id;
  if v_hash is null or p_demo_pin is null or extensions.crypt(p_demo_pin, v_hash) <> v_hash then
    raise exception 'Incorrect simulator PIN';
  end if;
  select id, simulated_balance, account_status
    into v_account_id, v_balance, v_account_status
    from public.demo_accounts where user_id = p_user_id for update;
  if v_account_id is null then raise exception 'No simulator account is assigned to this customer'; end if;
  if upper(coalesce(v_account_status, 'ACTIVE')) <> 'ACTIVE' then
    raise exception 'This simulator account is not active. Contact the administrator';
  end if;
  if v_balance < p_amount then raise exception 'Insufficient simulated balance'; end if;
  update public.demo_accounts set simulated_balance = simulated_balance - p_amount where id = v_account_id;
  insert into public.demo_transactions(account_id, description, amount, direction, status)
    values (v_account_id, 'Simulated transfer: ' || trim(p_description), p_amount, 'out', 'Simulated')
    returning id into v_tx_id;
  insert into public.notifications(user_id, title, body, kind)
    values (p_user_id, 'Transfer simulated', 'A simulated transfer record was added. No real payment occurred.', 'transaction');
  return jsonb_build_object('success', true, 'transaction_id', v_tx_id,
    'simulated_balance', v_balance - p_amount, 'status', 'Simulated', 'real_payment_sent', false);
end;
$function$;
