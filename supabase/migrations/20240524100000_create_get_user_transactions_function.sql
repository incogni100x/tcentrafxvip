CREATE OR REPLACE FUNCTION get_user_transactions()
RETURNS TABLE (
    transaction_id UUID,
    transaction_type TEXT,
    transaction_date TIMESTAMPTZ,
    status TEXT,
    amount NUMERIC,
    details TEXT
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id as transaction_id,
        'Deposit' as transaction_type,
        d.created_at as transaction_date,
        d.status::TEXT as status,
        d.amount,
        d.deposit_type as details
    FROM
        public.deposits d
    WHERE
        d.user_id = auth.uid()

    UNION ALL

    SELECT
        w.id as transaction_id,
        'Withdrawal' as transaction_type,
        w.requested_at as transaction_date,
        w.status::TEXT as status,
        w.amount,
        w.method as details
    FROM
        public.withdrawals w
    WHERE
        w.user_id = auth.uid()

    ORDER BY
        transaction_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 