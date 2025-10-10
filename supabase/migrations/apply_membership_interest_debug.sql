-- Debug version of the interest application function with detailed logging
CREATE OR REPLACE FUNCTION apply_daily_interest_to_all_memberships_debug()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INT := 0;
  total_memberships INT := 0;
  active_memberships INT := 0;
  eligible_memberships INT := 0;
  membership_record RECORD;
  daily_interest_rate NUMERIC;
  days_since_last_update INT;
  interest_to_add NUMERIC;
  debug_info TEXT := '';
BEGIN
  -- Get basic counts first
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'active')
  INTO total_memberships, active_memberships
  FROM public.user_memberships;
  
  debug_info := debug_info || 'Total memberships: ' || total_memberships || ', Active: ' || active_memberships || E'\n';
  
  -- Count eligible memberships
  SELECT COUNT(*) INTO eligible_memberships
  FROM public.user_memberships um
  JOIN public.membership_plans mp ON um.plan_id = mp.id
  WHERE 
    um.status = 'active'
    AND mp.is_active = true
    AND um.last_interest_update::date < CURRENT_DATE
    AND CURRENT_DATE >= um.start_date
    AND CURRENT_DATE <= um.end_date;
    
  debug_info := debug_info || 'Eligible for interest: ' || eligible_memberships || E'\n';
  debug_info := debug_info || 'Current date: ' || CURRENT_DATE || E'\n';
  
  -- Loop through all active memberships that need interest updates
  FOR membership_record IN
    SELECT 
      um.id,
      um.user_id,
      um.amount,
      um.total_interest_earned,
      um.last_interest_update,
      um.topup_mode,
      um.start_date,
      um.end_date,
      mp.weekly_interest_rate,
      mp.plan_name
    FROM public.user_memberships um
    JOIN public.membership_plans mp ON um.plan_id = mp.id
    WHERE 
      um.status = 'active'
      AND mp.is_active = true
      AND um.last_interest_update::date < CURRENT_DATE
      AND CURRENT_DATE >= um.start_date
      AND CURRENT_DATE <= um.end_date
  LOOP
    -- Calculate daily interest rate (weekly rate / 7 days)
    daily_interest_rate := membership_record.weekly_interest_rate / 100 / 7;
    
    -- Calculate days since last update
    days_since_last_update := CURRENT_DATE - membership_record.last_interest_update::date;
    
    -- Ensure we don't go beyond the end date
    IF (membership_record.last_interest_update::date + days_since_last_update) > membership_record.end_date THEN
      days_since_last_update := membership_record.end_date - membership_record.last_interest_update::date;
    END IF;
    
    -- Calculate interest to add based on current amount and days
    interest_to_add := membership_record.amount * daily_interest_rate * days_since_last_update;
    
    debug_info := debug_info || 'Processing membership ' || membership_record.id || ' (' || membership_record.plan_name || ')' || E'\n';
    debug_info := debug_info || '  Amount: ' || membership_record.amount || ', Rate: ' || membership_record.weekly_interest_rate || '%' || E'\n';
    debug_info := debug_info || '  Days: ' || days_since_last_update || ', Interest: ' || interest_to_add || E'\n';
    
    -- Update the membership with new interest
    UPDATE public.user_memberships
    SET
      total_interest_earned = COALESCE(total_interest_earned, 0) + interest_to_add,
      last_interest_update = NOW()
    WHERE id = membership_record.id;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  debug_info := debug_info || 'Updated ' || updated_count || ' memberships' || E'\n';
  
  -- Check for memberships that have reached maturity
  WITH matured_memberships AS (
    UPDATE public.user_memberships
    SET 
      status = 'completed',
      final_amount_to_pay = amount + COALESCE(total_interest_earned, 0)
    WHERE 
      status = 'active'
      AND end_date <= CURRENT_DATE
      AND final_amount_to_pay IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM matured_memberships;
  
  debug_info := debug_info || 'Completed ' || updated_count || ' matured memberships' || E'\n';
  
  RETURN debug_info || 'Daily interest applied to ' || updated_count || ' active memberships.';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'apply_daily_interest_to_all_memberships_debug failed: %', SQLERRM;
    RETURN 'Error applying daily interest: ' || SQLERRM || E'\nDebug info: ' || debug_info;
END;
$$;

-- Test function to force interest application (ignores date checks)
CREATE OR REPLACE FUNCTION force_apply_interest_to_membership(membership_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  membership_record RECORD;
  daily_interest_rate NUMERIC;
  interest_to_add NUMERIC;
  result_text TEXT;
BEGIN
  -- Get membership details
  SELECT 
    um.id,
    um.amount,
    um.total_interest_earned,
    um.last_interest_update,
    um.start_date,
    um.end_date,
    mp.weekly_interest_rate,
    mp.plan_name
  INTO membership_record
  FROM public.user_memberships um
  JOIN public.membership_plans mp ON um.plan_id = mp.id
  WHERE um.id = membership_id_param;
  
  IF NOT FOUND THEN
    RETURN 'Membership not found: ' || membership_id_param;
  END IF;
  
  -- Calculate daily interest rate
  daily_interest_rate := membership_record.weekly_interest_rate / 100 / 7;
  
  -- Calculate interest for 1 day
  interest_to_add := membership_record.amount * daily_interest_rate;
  
  -- Update the membership
  UPDATE public.user_memberships
  SET
    total_interest_earned = COALESCE(total_interest_earned, 0) + interest_to_add,
    last_interest_update = NOW()
  WHERE id = membership_id_param;
  
  result_text := 'Force applied interest to membership ' || membership_id_param || E'\n';
  result_text := result_text || 'Plan: ' || membership_record.plan_name || E'\n';
  result_text := result_text || 'Amount: ' || membership_record.amount || E'\n';
  result_text := result_text || 'Daily rate: ' || (daily_interest_rate * 100) || '%' || E'\n';
  result_text := result_text || 'Interest added: ' || interest_to_add || E'\n';
  result_text := result_text || 'New total interest: ' || (COALESCE(membership_record.total_interest_earned, 0) + interest_to_add);
  
  RETURN result_text;
END;
$$;
