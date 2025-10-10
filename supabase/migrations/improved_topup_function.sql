-- Improved top-up function that handles existing memberships correctly
CREATE OR REPLACE FUNCTION public.create_user_membership_transaction(
  plan_id_arg INT,
  amount_arg NUMERIC,
  months_arg INT,
  topup_mode_arg TEXT DEFAULT 'continue'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  plan RECORD;
  user_profile RECORD;
  existing_membership RECORD;
  start_date_val DATE;
  end_date_val DATE;
  new_membership RECORD;
  is_topup BOOLEAN := false;
BEGIN
  -- 1. Fetch plan details
  SELECT * INTO plan
  FROM public.membership_plans
  WHERE id = plan_id_arg AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Plan not found or inactive.');
  END IF;

  -- 2. Check user profile & balance first
  SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'User profile not found.');
  END IF;

  IF user_profile.cash_balance < amount_arg THEN
    RETURN json_build_object('success', false, 'message', 'Insufficient balance.');
  END IF;

  -- 3. Check for existing active membership for this plan
  SELECT * INTO existing_membership
  FROM public.user_memberships
  WHERE user_id = current_user_id AND plan_id = plan_id_arg AND status = 'active'
  LIMIT 1;

  IF existing_membership IS NOT NULL THEN
    -- This is a TOP-UP operation
    is_topup := true;
    
    -- For top-ups, we don't validate min_amount (since it's additional money)
    -- We only check max_amount if it exists
    IF plan.max_amount IS NOT NULL AND (existing_membership.amount + amount_arg) > plan.max_amount THEN
      RETURN json_build_object('success', false, 'message', 'Total amount would exceed plan maximum limit.');
    END IF;

    -- Handle top-up based on mode
    IF topup_mode_arg = 'reset' THEN
      -- Restart duration with combined capital
      end_date_val := CURRENT_DATE + (months_arg * INTERVAL '1 month');

      UPDATE public.user_memberships
      SET 
        amount = amount + amount_arg,
        total_topups = COALESCE(total_topups, 0) + amount_arg,
        start_date = CURRENT_DATE,
        end_date = end_date_val,
        duration_months = months_arg,
        last_topup_date = NOW(),
        topup_mode = 'reset'
      WHERE id = existing_membership.id
      RETURNING * INTO new_membership;

    ELSE
      -- Continue existing timeline, just add to balance
      UPDATE public.user_memberships
      SET 
        amount = amount + amount_arg,
        total_topups = COALESCE(total_topups, 0) + amount_arg,
        last_topup_date = NOW(),
        topup_mode = 'continue'
      WHERE id = existing_membership.id
      RETURNING * INTO new_membership;
    END IF;

  ELSE
    -- This is a NEW MEMBERSHIP operation
    is_topup := false;
    
    -- For new memberships, validate amount and duration normally
    IF amount_arg < plan.min_amount THEN
      RETURN json_build_object('success', false, 'message', 'Amount below minimum for this plan.');
    END IF;
    IF plan.max_amount IS NOT NULL AND amount_arg > plan.max_amount THEN
      RETURN json_build_object('success', false, 'message', 'Amount exceeds maximum for this plan.');
    END IF;
    IF months_arg < plan.min_months OR months_arg > plan.max_months THEN
      RETURN json_build_object('success', false, 'message', 'Invalid duration for this plan.');
    END IF;

    -- Create new membership
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
  END IF;

  -- 4. Deduct funds from user balance
  UPDATE public.profiles
  SET cash_balance = cash_balance - amount_arg
  WHERE id = current_user_id;

  -- 5. Return success with appropriate message
  IF is_topup THEN
    RETURN json_build_object(
      'success', true,
      'message', 'Membership topped up successfully.',
      'data', row_to_json(new_membership),
      'is_topup', true,
      'topup_amount', amount_arg
    );
  ELSE
    RETURN json_build_object(
      'success', true,
      'message', 'Membership created successfully.',
      'data', row_to_json(new_membership),
      'is_topup', false
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'create_user_membership_transaction failed: %', SQLERRM;
    RETURN json_build_object('success', false, 'message', 'An internal error occurred: ' || SQLERRM);
END;
$$;
