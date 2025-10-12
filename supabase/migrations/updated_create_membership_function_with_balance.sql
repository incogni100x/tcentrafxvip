-- Updated create membership function to return current balance information
CREATE OR REPLACE FUNCTION public.create_user_membership_transaction(
  plan_id_arg INT,
  amount_arg NUMERIC,
  months_arg INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  plan RECORD;
  user_profile RECORD;
  start_date_val DATE;
  end_date_val DATE;
  new_membership RECORD;
  updated_balance NUMERIC;
BEGIN
  -- 1. Fetch plan details
  SELECT * INTO plan
  FROM public.membership_plans
  WHERE id = plan_id_arg AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Plan not found or inactive.');
  END IF;

  -- 2. Check user profile & balance (use LIMIT 1 to avoid PGRST116)
  SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'User profile not found.');
  END IF;

  IF user_profile.cash_balance < amount_arg THEN
    RETURN json_build_object(
      'success', false, 
      'message', 'Insufficient balance.',
      'current_balance', user_profile.cash_balance,
      'required_amount', amount_arg,
      'shortfall', amount_arg - user_profile.cash_balance
    );
  END IF;

  -- 3. Validate amount and duration for new membership
  IF amount_arg < plan.min_amount THEN
    RETURN json_build_object('success', false, 'message', 'Amount below minimum for this plan.');
  END IF;
  IF plan.max_amount IS NOT NULL AND amount_arg > plan.max_amount THEN
    RETURN json_build_object('success', false, 'message', 'Amount exceeds maximum for this plan.');
  END IF;
  IF months_arg < plan.min_months OR months_arg > plan.max_months THEN
    RETURN json_build_object('success', false, 'message', 'Invalid duration for this plan.');
  END IF;

  -- 4. Create new membership (users can have multiple memberships for same plan)
  start_date_val := CURRENT_DATE;
  end_date_val := CURRENT_DATE + (months_arg * INTERVAL '1 month');

  INSERT INTO public.user_memberships (
    user_id, plan_id, amount, duration_months,
    start_date, end_date, status, total_topups
  )
  VALUES (
    current_user_id, plan_id_arg, amount_arg, months_arg,
    start_date_val, end_date_val, 'active', 0
  )
  RETURNING * INTO new_membership;

  -- 5. Deduct funds from user balance and get updated balance
  UPDATE public.profiles
  SET cash_balance = cash_balance - amount_arg
  WHERE id = current_user_id
  RETURNING cash_balance INTO updated_balance;

  -- 6. Return success with updated balance
  RETURN json_build_object(
    'success', true,
    'message', 'Membership created successfully.',
    'data', row_to_json(new_membership),
    'updated_balance', updated_balance
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'create_user_membership_transaction failed: %', SQLERRM;
    RETURN json_build_object('success', false, 'message', 'An internal error occurred: ' || SQLERRM);
END;
$$;
