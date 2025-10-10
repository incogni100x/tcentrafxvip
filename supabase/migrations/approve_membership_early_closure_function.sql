-- Function to approve pending early closures (for admin use)
CREATE OR REPLACE FUNCTION approve_membership_early_closure(membership_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  membership_record RECORD;
  result_data JSON;
BEGIN
  -- Get membership details
  SELECT 
    um.id,
    um.user_id,
    um.amount,
    um.total_interest_earned,
    um.penalty_applied,
    um.final_amount_to_pay,
    um.status,
    mp.plan_name
  INTO membership_record
  FROM public.user_memberships um
  JOIN public.membership_plans mp ON um.plan_id = mp.id
  WHERE um.id = membership_id_param;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Membership not found.'
    );
  END IF;

  IF membership_record.status != 'pending_closure' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Membership is not pending closure.'
    );
  END IF;

  -- Update status to closed_early (this will trigger the cash balance update)
  UPDATE public.user_memberships
  SET 
    status = 'closed_early'
  WHERE id = membership_id_param;

  -- Build result data
  result_data := json_build_object(
    'success', true,
    'message', 'Early closure approved and processed.',
    'data', json_build_object(
      'membership_id', membership_record.id,
      'user_id', membership_record.user_id,
      'plan_name', membership_record.plan_name,
      'principal_amount', membership_record.amount,
      'interest_earned', membership_record.total_interest_earned,
      'penalty_applied', membership_record.penalty_applied,
      'final_payout', membership_record.final_amount_to_pay,
      'status', 'closed_early'
    )
  );

  RETURN result_data;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'approve_membership_early_closure failed: %', SQLERRM;
    RETURN json_build_object(
      'success', false,
      'message', 'Error processing early closure: ' || SQLERRM
    );
END;
$$;

-- Function to reject pending early closures (for admin use)
CREATE OR REPLACE FUNCTION reject_membership_early_closure(membership_id_param UUID, rejection_reason TEXT DEFAULT 'Rejected by admin')
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  membership_record RECORD;
BEGIN
  -- Get membership details
  SELECT id, status INTO membership_record
  FROM public.user_memberships
  WHERE id = membership_id_param;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Membership not found.'
    );
  END IF;

  IF membership_record.status != 'pending_closure' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Membership is not pending closure.'
    );
  END IF;

  -- Reset status back to active and clear penalty fields
  UPDATE public.user_memberships
  SET 
    status = 'active',
    penalty_applied = 0,
    final_amount_to_pay = 0
  WHERE id = membership_id_param;

  RETURN json_build_object(
    'success', true,
    'message', 'Early closure request rejected. Membership restored to active status.',
    'rejection_reason', rejection_reason
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'reject_membership_early_closure failed: %', SQLERRM;
    RETURN json_build_object(
      'success', false,
      'message', 'Error rejecting early closure: ' || SQLERRM
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION approve_membership_early_closure(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION reject_membership_early_closure(UUID, TEXT) TO service_role;

-- Add comments
COMMENT ON FUNCTION approve_membership_early_closure(UUID) IS 
'Approves a pending early closure request and processes the payout to user cash balance';

COMMENT ON FUNCTION reject_membership_early_closure(UUID, TEXT) IS 
'Rejects a pending early closure request and restores membership to active status';
