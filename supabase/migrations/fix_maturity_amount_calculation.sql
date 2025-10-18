-- Fix function overload issue by dropping the old function first
-- Drop the old function that has topup_mode_arg parameter
DROP FUNCTION IF EXISTS public.create_user_membership_transaction(INT, NUMERIC, INT, TEXT);

-- Now create the new function without topup_mode_arg and with maturity amount calculation
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
  maturity_amount NUMERIC;
  total_weeks INTEGER;
  weekly_interest_amount NUMERIC;
BEGIN
  -- Debug: Log the current user ID
  RAISE NOTICE 'Current user ID: %', current_user_id;
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false, 
      'message', 'User not authenticated.',
      'debug_info', 'auth.uid() returned NULL'
    );
  END IF;

  -- 1. Fetch plan details
  SELECT * INTO plan
  FROM public.membership_plans
  WHERE id = plan_id_arg AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Plan not found or inactive.');
  END IF;

  -- 2. Check user profile & balance with better error handling
  SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id LIMIT 1;
  
  -- Debug: Log profile query result
  IF user_profile IS NULL THEN
    RAISE NOTICE 'No profile found for user ID: %', current_user_id;
    
    -- Check if user exists in auth.users
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = current_user_id) THEN
      RETURN json_build_object(
        'success', false, 
        'message', 'User profile not found. Please complete your profile setup.',
        'debug_info', 'User exists in auth.users but not in profiles table'
      );
    ELSE
      RETURN json_build_object(
        'success', false, 
        'message', 'User not found in system.',
        'debug_info', 'User does not exist in auth.users'
      );
    END IF;
  END IF;

  -- Debug: Log profile data
  RAISE NOTICE 'Profile found - Balance: %, Email: %', user_profile.cash_balance, user_profile.email;

  -- Check balance
  IF user_profile.cash_balance < amount_arg THEN
    RETURN json_build_object(
      'success', false, 
      'message', 'Insufficient balance.',
      'current_balance', user_profile.cash_balance,
      'required_amount', amount_arg,
      'shortfall', amount_arg - user_profile.cash_balance,
      'debug_info', json_build_object(
        'user_id', current_user_id,
        'profile_id', user_profile.id,
        'balance', user_profile.cash_balance
      )
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

  -- 4. Calculate maturity amount
  total_weeks := months_arg * 4; -- Approximate weeks in months
  weekly_interest_amount := amount_arg * (plan.weekly_interest_rate / 100);
  maturity_amount := amount_arg + (weekly_interest_amount * total_weeks);

  -- 5. Create new membership (users can have multiple memberships for same plan)
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

  -- 6. Deduct funds from user balance and get updated balance
  UPDATE public.profiles
  SET cash_balance = cash_balance - amount_arg
  WHERE id = current_user_id
  RETURNING cash_balance INTO updated_balance;

  -- 7. Return success with updated balance and maturity amount
  RETURN json_build_object(
    'success', true,
    'message', 'Membership created successfully.',
    'data', row_to_json(new_membership),
    'updated_balance', updated_balance,
    'maturity_amount', maturity_amount,
    'weekly_interest_rate', plan.weekly_interest_rate,
    'total_weeks', total_weeks,
    'weekly_interest_amount', weekly_interest_amount
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'create_user_membership_transaction failed: %', SQLERRM;
    RETURN json_build_object(
      'success', false, 
      'message', 'An internal error occurred: ' || SQLERRM,
      'debug_info', json_build_object(
        'user_id', current_user_id,
        'error', SQLERRM
      )
    );
END;
$$;
