-- Function that handles early closure trigger for user_memberships
CREATE OR REPLACE FUNCTION handle_membership_early_closure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the status was changed TO 'closed_early'
  IF NEW.status = 'closed_early' AND OLD.status != 'closed_early' THEN
    -- Add the final payout amount to the user's cash balance
    UPDATE public.profiles
    SET cash_balance = cash_balance + NEW.final_amount_to_pay
    WHERE id = NEW.user_id;
    
    -- Log the closure for audit purposes
    RAISE NOTICE 'Early closure processed for membership %: User %, Amount %', 
      NEW.id, NEW.user_id, NEW.final_amount_to_pay;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger that attaches the function to the user_memberships table
DROP TRIGGER IF EXISTS on_membership_closed_early ON public.user_memberships;

CREATE TRIGGER on_membership_closed_early
  AFTER UPDATE ON public.user_memberships
  FOR EACH ROW
  EXECUTE FUNCTION handle_membership_early_closure();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_membership_early_closure() TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION handle_membership_early_closure() IS 
'Trigger function that automatically credits user cash balance when membership status changes to closed_early';
