-- Dedicated top-up function that updates a specific membership by ID
CREATE OR REPLACE FUNCTION public.topup_membership(
  membership_id_arg UUID,
  amount_arg NUMERIC,
  topup_mode_arg TEXT DEFAULT 'continue'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  user_profile RECORD;
  existing_membership RECORD;
  plan RECORD;
  end_date_val DATE;
  updated_membership RECORD;
BEGIN
  -- 1. Check user profile & balance
  SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'User profile not found.');
  END IF;

  IF user_profile.cash_balance < amount_arg THEN
    RETURN json_build_object('success', false, 'message', 'Insufficient balance.');
  END IF;

  -- 2. Get the specific membership to top up
  SELECT * INTO existing_membership
  FROM public.user_memberships
  WHERE id = membership_id_arg AND user_id = current_user_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Membership not found or not active.');
  END IF;

  -- 3. Get plan details for validation
  SELECT * INTO plan
  FROM public.membership_plans
  WHERE id = existing_membership.plan_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Plan not found or inactive.');
  END IF;

  -- 4. Validate new total amount doesn't exceed plan maximum (if exists)
  IF plan.max_amount IS NOT NULL AND (existing_membership.amount + amount_arg) > plan.max_amount THEN
    RETURN json_build_object('success', false, 'message', 'Total amount would exceed plan maximum limit of ' || plan.max_amount);
  END IF;

  -- 5. Update the specific membership based on top-up mode
  IF topup_mode_arg = 'reset' THEN
    -- Reset mode: restart duration with combined capital
    end_date_val := CURRENT_DATE + (existing_membership.duration_months * INTERVAL '1 month');

    UPDATE public.user_memberships
    SET 
      amount = amount + amount_arg,
      total_topups = COALESCE(total_topups, 0) + amount_arg,
      start_date = CURRENT_DATE,
      end_date = end_date_val,
      last_topup_date = NOW(),
      topup_mode = 'reset'
    WHERE id = membership_id_arg
    RETURNING * INTO updated_membership;

  ELSE
    -- Continue mode: keep existing timeline, just add to balance
    UPDATE public.user_memberships
    SET 
      amount = amount + amount_arg,
      total_topups = COALESCE(total_topups, 0) + amount_arg,
      last_topup_date = NOW(),
      topup_mode = 'continue'
    WHERE id = membership_id_arg
    RETURNING * INTO updated_membership;
  END IF;

  -- 6. Deduct funds from user balance
  UPDATE public.profiles
  SET cash_balance = cash_balance - amount_arg
  WHERE id = current_user_id;

  -- 7. Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Membership topped up successfully.',
    'data', row_to_json(updated_membership),
    'topup_amount', amount_arg,
    'new_total', updated_membership.amount,
    'topup_mode', topup_mode_arg
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'topup_membership failed: %', SQLERRM;
    RETURN json_build_object('success', false, 'message', 'An internal error occurred: ' || SQLERRM);
END;
$$;
