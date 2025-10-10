-- Fixed function to apply daily interest to all active user memberships
CREATE OR REPLACE FUNCTION apply_daily_interest_to_all_memberships()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INT := 0;
  completed_count INT := 0;
  membership_record RECORD;
  daily_interest_rate NUMERIC;
  days_since_last_update INT;
  interest_to_add NUMERIC;
BEGIN
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
      mp.weekly_interest_rate
    FROM public.user_memberships um
    JOIN public.membership_plans mp ON um.plan_id = mp.id
    WHERE 
      um.status = 'active'
      AND mp.is_active = true
      -- Fixed: Use DATE_TRUNC to compare dates properly
      AND DATE_TRUNC('day', um.last_interest_update) < DATE_TRUNC('day', NOW())
      -- Only apply interest if we're within the membership period
      AND CURRENT_DATE >= um.start_date
      AND CURRENT_DATE <= um.end_date
  LOOP
    -- Calculate daily interest rate (weekly rate / 7 days)
    daily_interest_rate := membership_record.weekly_interest_rate / 100.0 / 7.0;
    
    -- Calculate days since last update (minimum 1 day)
    days_since_last_update := GREATEST(1, CURRENT_DATE - DATE(membership_record.last_interest_update));
    
    -- Ensure we don't go beyond the end date
    IF (DATE(membership_record.last_interest_update) + days_since_last_update) > membership_record.end_date THEN
      days_since_last_update := membership_record.end_date - DATE(membership_record.last_interest_update);
    END IF;
    
    -- Only proceed if we have positive days
    IF days_since_last_update > 0 THEN
      -- Calculate interest to add based on current amount and days
      interest_to_add := membership_record.amount * daily_interest_rate * days_since_last_update;
      
      -- Update the membership with new interest
      UPDATE public.user_memberships
      SET
        total_interest_earned = COALESCE(total_interest_earned, 0) + interest_to_add,
        last_interest_update = NOW()
      WHERE id = membership_record.id;
      
      updated_count := updated_count + 1;
    END IF;
  END LOOP;
  
  -- Check for memberships that have reached maturity
  WITH matured AS (
    UPDATE public.user_memberships
    SET 
      status = 'completed',
      final_amount_to_pay = amount + COALESCE(total_interest_earned, 0)
    WHERE 
      status = 'active'
      AND end_date <= CURRENT_DATE
      AND (final_amount_to_pay IS NULL OR final_amount_to_pay = 0)
    RETURNING id
  )
  SELECT COUNT(*) INTO completed_count FROM matured;
  
  RETURN 'Daily interest applied to ' || updated_count || ' active memberships. Completed ' || completed_count || ' matured memberships.';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'apply_daily_interest_to_all_memberships failed: %', SQLERRM;
    RETURN 'Error applying daily interest: ' || SQLERRM;
END;
$$;

-- Also create a function to initialize interest for new memberships
CREATE OR REPLACE FUNCTION initialize_membership_interest()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INT := 0;
BEGIN
  -- Set last_interest_update to start_date for memberships that don't have it set
  UPDATE public.user_memberships
  SET last_interest_update = start_date::timestamp
  WHERE 
    status = 'active'
    AND (last_interest_update IS NULL OR last_interest_update < start_date::timestamp);
    
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN 'Initialized interest tracking for ' || updated_count || ' memberships.';
END;
$$;

-- Run initialization first
SELECT initialize_membership_interest();
