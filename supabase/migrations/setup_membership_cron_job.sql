-- Setup Supabase Cron Job for Daily Interest Application
-- This should be run in the Supabase SQL Editor to set up the automated daily interest calculation

-- Enable the pg_cron extension (if not already enabled)
-- Note: This may require superuser privileges and might need to be done by Supabase support
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the cron job to run daily at midnight UTC
-- This will call our edge function every day at 00:00 UTC
SELECT cron.schedule(
  'apply-daily-membership-interest',  -- Job name
  '0 0 * * *',                       -- Cron expression: daily at midnight UTC
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/apply-membership-interest',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}',
    body := '{}'
  ) as request_id;
  $$
);

-- Alternative: Direct SQL function call (if you prefer not to use edge functions)
-- SELECT cron.schedule(
--   'apply-daily-membership-interest-direct',
--   '0 0 * * *',
--   $$
--   SELECT apply_daily_interest_to_all_memberships();
--   $$
-- );

-- View all scheduled cron jobs
SELECT * FROM cron.job;

-- To delete a cron job (if needed):
-- SELECT cron.unschedule('apply-daily-membership-interest');

-- Grant necessary permissions for cron job execution
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT EXECUTE ON FUNCTION apply_daily_interest_to_all_memberships() TO postgres;

-- Create a log table to track interest applications (optional but recommended)
CREATE TABLE IF NOT EXISTS public.interest_application_log (
  id SERIAL PRIMARY KEY,
  application_date DATE NOT NULL DEFAULT CURRENT_DATE,
  memberships_updated INTEGER NOT NULL DEFAULT 0,
  total_interest_applied NUMERIC(18, 2) NOT NULL DEFAULT 0,
  execution_time_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for log table
CREATE INDEX IF NOT EXISTS idx_interest_log_date ON public.interest_application_log (application_date DESC);

-- Enhanced function that logs results
CREATE OR REPLACE FUNCTION apply_daily_interest_to_all_memberships_with_logging()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INT := 0;
  total_interest NUMERIC := 0;
  start_time TIMESTAMP := clock_timestamp();
  end_time TIMESTAMP;
  execution_ms INT;
  result_message TEXT;
BEGIN
  -- Call the main interest application function
  SELECT apply_daily_interest_to_all_memberships() INTO result_message;
  
  -- Calculate execution time
  end_time := clock_timestamp();
  execution_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
  
  -- Get statistics for logging
  SELECT COUNT(*), COALESCE(SUM(total_interest_earned), 0)
  INTO updated_count, total_interest
  FROM public.user_memberships
  WHERE status = 'active' AND last_interest_update::date = CURRENT_DATE;
  
  -- Log the execution
  INSERT INTO public.interest_application_log (
    application_date,
    memberships_updated,
    total_interest_applied,
    execution_time_ms,
    status
  ) VALUES (
    CURRENT_DATE,
    updated_count,
    total_interest,
    execution_ms,
    'success'
  );
  
  RETURN result_message || ' (Logged execution: ' || execution_ms || 'ms)';
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO public.interest_application_log (
      application_date,
      memberships_updated,
      total_interest_applied,
      execution_time_ms,
      status,
      error_message
    ) VALUES (
      CURRENT_DATE,
      0,
      0,
      EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000,
      'error',
      SQLERRM
    );
    
    RAISE;
END;
$$;
