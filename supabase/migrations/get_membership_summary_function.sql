-- Function to get membership summary data (replaces get_locked_savings_summary)
CREATE OR REPLACE FUNCTION get_membership_summary()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  summary_data JSON;
BEGIN
  -- Build comprehensive summary data
  SELECT json_build_object(
    'total_principal', COALESCE(SUM(CASE WHEN um.status = 'active' THEN um.amount ELSE 0 END), 0),
    'total_interest_earned', COALESCE(SUM(CASE WHEN um.status = 'active' THEN um.total_interest_earned ELSE 0 END), 0),
    'active_deposits_count', COALESCE(COUNT(*) FILTER (WHERE um.status = 'active'), 0),
    'active_memberships', (
      SELECT COALESCE(json_agg(s), '[]'::json)
      FROM (
        SELECT 
          um.id,
          um.amount,
          um.start_date,
          um.end_date,
          um.duration_months,
          um.status,
          um.total_interest_earned,
          um.total_topups,
          um.last_topup_date,
          um.topup_mode,
          mp.plan_name,
          mp.weekly_interest_rate,
          mp.id as plan_id
        FROM public.user_memberships um
        JOIN public.membership_plans mp ON um.plan_id = mp.id
        WHERE um.user_id = current_user_id 
          AND um.status = 'active'
        ORDER BY um.start_date DESC
      ) AS s
    ),
    'historical_memberships', (
      SELECT COALESCE(json_agg(h), '[]'::json)
      FROM (
        SELECT 
          um.id,
          um.amount,
          um.start_date,
          um.end_date,
          um.duration_months,
          um.status,
          um.total_interest_earned,
          um.penalty_applied,
          um.final_amount_to_pay,
          um.total_topups,
          mp.plan_name,
          mp.weekly_interest_rate
        FROM public.user_memberships um
        JOIN public.membership_plans mp ON um.plan_id = mp.id
        WHERE um.user_id = current_user_id 
          AND um.status IN ('pending_closure', 'closed_early', 'completed', 'cancelled')
        ORDER BY um.end_date DESC
      ) AS h
    )
  ) INTO summary_data
  FROM public.user_memberships um
  WHERE um.user_id = current_user_id;

  -- Return default structure if no data found
  IF summary_data IS NULL OR summary_data->>'total_principal' IS NULL THEN
    RETURN json_build_object(
      'total_principal', 0,
      'total_interest_earned', 0,
      'active_deposits_count', 0,
      'active_memberships', '[]'::json,
      'historical_memberships', '[]'::json
    );
  END IF;

  RETURN summary_data;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'get_membership_summary failed: %', SQLERRM;
    RETURN json_build_object(
      'total_principal', 0,
      'total_interest_earned', 0,
      'active_deposits_count', 0,
      'active_memberships', '[]'::json,
      'historical_memberships', '[]'::json
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_membership_summary() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_membership_summary() IS 
'Returns comprehensive membership summary including active and historical memberships for the authenticated user.';
