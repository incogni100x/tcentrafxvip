-- Debug function to check why no memberships are being updated
CREATE OR REPLACE FUNCTION debug_membership_interest()
RETURNS TABLE (
  membership_id UUID,
  user_id UUID,
  amount NUMERIC,
  status TEXT,
  plan_active BOOLEAN,
  start_date DATE,
  end_date DATE,
  current_date DATE,
  last_interest_update TIMESTAMP WITH TIME ZONE,
  last_update_date DATE,
  date_condition_met BOOLEAN,
  within_period BOOLEAN,
  should_update BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    um.id as membership_id,
    um.user_id,
    um.amount,
    um.status::TEXT,
    mp.is_active as plan_active,
    um.start_date,
    um.end_date,
    CURRENT_DATE as current_date,
    um.last_interest_update,
    um.last_interest_update::date as last_update_date,
    (um.last_interest_update::date < CURRENT_DATE) as date_condition_met,
    (CURRENT_DATE >= um.start_date AND CURRENT_DATE <= um.end_date) as within_period,
    (
      um.status = 'active'
      AND mp.is_active = true
      AND um.last_interest_update::date < CURRENT_DATE
      AND CURRENT_DATE >= um.start_date
      AND CURRENT_DATE <= um.end_date
    ) as should_update
  FROM public.user_memberships um
  JOIN public.membership_plans mp ON um.plan_id = mp.id
  ORDER BY um.created_at DESC;
END;
$$;

-- Check all memberships and their conditions
SELECT * FROM debug_membership_interest();

-- Also check if there are any memberships at all
SELECT 
  COUNT(*) as total_memberships,
  COUNT(*) FILTER (WHERE status = 'active') as active_memberships,
  COUNT(*) FILTER (WHERE status = 'active' AND start_date <= CURRENT_DATE) as active_started,
  COUNT(*) FILTER (WHERE status = 'active' AND end_date >= CURRENT_DATE) as active_not_expired
FROM public.user_memberships;

-- Check membership plans
SELECT 
  id,
  plan_name,
  is_active,
  weekly_interest_rate
FROM public.membership_plans
ORDER BY id;

-- Check specific membership details
SELECT 
  um.id,
  um.status,
  um.start_date,
  um.end_date,
  um.last_interest_update,
  um.amount,
  mp.plan_name,
  mp.weekly_interest_rate,
  mp.is_active as plan_active,
  CURRENT_DATE as today,
  (um.last_interest_update::date < CURRENT_DATE) as needs_update_by_date,
  (CURRENT_DATE >= um.start_date) as has_started,
  (CURRENT_DATE <= um.end_date) as not_expired
FROM public.user_memberships um
LEFT JOIN public.membership_plans mp ON um.plan_id = mp.id
ORDER BY um.created_at DESC
LIMIT 10;
