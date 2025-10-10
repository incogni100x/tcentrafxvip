-- Drop the existing function first
DROP FUNCTION IF EXISTS get_dashboard_data();

-- Create the updated dashboard data function for membership system
CREATE OR REPLACE FUNCTION get_dashboard_data()
RETURNS TABLE (
    cash_balance NUMERIC,
    total_crypto_value NUMERIC,
    total_membership_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    auth_user_id UUID;
BEGIN
    auth_user_id := auth.uid();

    RETURN QUERY
    SELECT
        -- Gets the user's cash balance
        COALESCE((SELECT p.cash_balance FROM public.profiles p WHERE p.id = auth_user_id), 0) as cash_balance,

        -- Calculates the total value of all crypto holdings from the transaction history
        COALESCE((
            WITH units_held_summary AS (
                 SELECT
                    t.crypto_symbol,
                    SUM(CASE WHEN t.transaction_type = 'buy' THEN t.quantity ELSE -t.quantity END) as units_held
                FROM (
                    SELECT crypto_symbol, amount_purchased as quantity, 'buy' as transaction_type FROM public.crypto_purchases WHERE user_id = auth_user_id
                    UNION ALL
                    SELECT crypto_symbol, amount_sold as quantity, 'sell' as transaction_type FROM public.crypto_sales WHERE user_id = auth_user_id
                ) t
                GROUP BY t.crypto_symbol
            )
            SELECT SUM(
                (uhs.units_held * ct.static_price) + COALESCE(cb.accrued_interest, 0)
            )
            FROM units_held_summary uhs
            JOIN public.crypto_tokens ct ON uhs.crypto_symbol = ct.crypto_symbol
            LEFT JOIN public.crypto_balances cb ON uhs.crypto_symbol = cb.crypto_symbol AND cb.user_id = auth_user_id
            WHERE uhs.units_held > 0.000001 -- Threshold for floating point safety
        ), 0) as total_crypto_value,

        -- Calculates the total value (principal + interest) of active memberships
        COALESCE((
            SELECT SUM(um.amount + COALESCE(um.total_interest_earned, 0))
            FROM public.user_memberships um
            WHERE um.user_id = auth_user_id AND um.status = 'active'
        ), 0) as total_membership_value;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_dashboard_data() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_dashboard_data() IS 
'Returns dashboard summary data including cash balance, crypto value, and total membership value for the authenticated user';
