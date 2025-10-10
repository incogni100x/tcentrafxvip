-- Function to apply daily interest to all active user memberships
CREATE OR REPLACE FUNCTION apply_daily_interest_to_all_memberships()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INT := 0;
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
      -- Only update if the calendar day has changed
      AND um.last_interest_update::date < CURRENT_DATE
      -- Only apply interest if we're within the membership period
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
    
    -- Update the membership with new interest
    UPDATE public.user_memberships
    SET
      total_interest_earned = COALESCE(total_interest_earned, 0) + interest_to_add,
      last_interest_update = NOW()
    WHERE id = membership_record.id;
    
    updated_count := updated_count + 1;
    
    -- Log the interest application for debugging
    RAISE NOTICE 'Applied interest to membership %: Amount=%, Days=%, Interest=%, Total Interest=%', 
      membership_record.id, 
      membership_record.amount, 
      days_since_last_update, 
      interest_to_add,
      COALESCE(membership_record.total_interest_earned, 0) + interest_to_add;
  END LOOP;
  
  -- Check for memberships that have reached maturity
  UPDATE public.user_memberships
  SET 
    status = 'completed',
    final_amount_to_pay = amount + COALESCE(total_interest_earned, 0)
  WHERE 
    status = 'active'
    AND end_date <= CURRENT_DATE
    AND final_amount_to_pay IS NULL;
  
  -- Get count of newly completed memberships
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN 'Daily interest applied to ' || updated_count || ' active memberships. Completed ' || updated_count || ' matured memberships.';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'apply_daily_interest_to_all_memberships failed: %', SQLERRM;
    RETURN 'Error applying daily interest: ' || SQLERRM;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION apply_daily_interest_to_all_memberships() TO service_role;

-- Create index for better performance on interest calculations
CREATE INDEX IF NOT EXISTS idx_user_memberships_interest_update 
ON public.user_memberships (status, last_interest_update, start_date, end_date) 
WHERE status = 'active';

-- Add comment for documentation
COMMENT ON FUNCTION apply_daily_interest_to_all_memberships() IS 
'Applies daily interest to all active user memberships. Calculates interest based on weekly rate divided by 7 days. Handles topup scenarios and membership maturity.';
