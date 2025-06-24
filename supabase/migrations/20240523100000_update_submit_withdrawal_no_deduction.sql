create or replace function submit_withdrawal_transaction(
    amount_to_withdraw numeric,
    withdrawal_method text,
    withdrawal_description text,
    p_saved_beneficiary_id integer,
    p_bank_name text,
    p_account_holder_name text,
    p_account_number text,
    p_routing_number text,
    p_swift_code text,
    p_bank_address text,
    p_crypto_currency text,
    p_crypto_wallet_address text
)
returns json
language plpgsql
security definer
as $$
declare
  current_user_id uuid := auth.uid();
  current_balance numeric;
  beneficiary_id_to_use integer;
  new_withdrawal_id uuid;
begin
  -- Lock the user's profile row to prevent race conditions when checking balance
  select cash_balance into current_balance from public.profiles
  where id = current_user_id for update;

  -- Check for sufficient balance
  if current_balance is null or current_balance < amount_to_withdraw then
    raise exception 'Insufficient balance to request withdrawal';
  end if;

  -- Handle withdrawal based on method
  if withdrawal_method = 'bank transfer' then
    if p_saved_beneficiary_id is not null then
      -- Use the provided beneficiary ID, ensuring it belongs to the current user
      select id into beneficiary_id_to_use from public.saved_beneficiaries
      where id = p_saved_beneficiary_id and user_id = current_user_id;

      if beneficiary_id_to_use is null then
        raise exception 'Invalid beneficiary ID provided.';
      end if;
    else
      -- Find or create a new beneficiary from the provided details
      if p_bank_name is null or p_account_holder_name is null or p_account_number is null then
          raise exception 'Missing required bank details for bank transfer.';
      end if;
      
      -- Check for an existing beneficiary to reuse to avoid duplicates
      select id into beneficiary_id_to_use from public.saved_beneficiaries
      where user_id = current_user_id
        and bank_name = p_bank_name
        and account_number = p_account_number
        and coalesce(swift_code, '') = coalesce(p_swift_code, '');

      -- If no beneficiary exists, create a new one
      if beneficiary_id_to_use is null then
        insert into public.saved_beneficiaries (user_id, bank_name, account_holder_name, account_number, routing_number, swift_code, bank_address)
        values (current_user_id, p_bank_name, p_account_holder_name, p_account_number, p_routing_number, p_swift_code, p_bank_address)
        returning id into beneficiary_id_to_use;
      end if;
    end if;

    -- Insert the bank withdrawal record
    insert into public.withdrawals (user_id, amount, method, beneficiary_id, description, status)
    values (current_user_id, amount_to_withdraw, 'bank transfer', beneficiary_id_to_use, withdrawal_description, 'pending')
    returning id into new_withdrawal_id;

  elsif withdrawal_method = 'crypto' then
    if p_crypto_currency is null or p_crypto_wallet_address is null then
        raise exception 'Missing currency or wallet address for crypto withdrawal.';
    end if;

    -- Insert the crypto withdrawal record
    insert into public.withdrawals (user_id, amount, method, crypto_currency, crypto_wallet_address, description, status)
    values (current_user_id, amount_to_withdraw, 'crypto', p_crypto_currency, p_crypto_wallet_address, withdrawal_description, 'pending')
    returning id into new_withdrawal_id;
  
  else
    raise exception 'Invalid withdrawal method specified.';
  end if;

  -- The balance is no longer deducted here. It will be handled by a trigger on status change.
  
  -- Return a success response with the new withdrawal ID
  return json_build_object('success', true, 'withdrawalId', new_withdrawal_id);
end;
$$; 