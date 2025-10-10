# Membership Interest System Deployment Guide

This guide covers deploying the updated interest application system for the new membership structure.

## 📋 **Files Created:**

1. `apply_membership_interest_function.sql` - Main SQL function for applying daily interest
2. `apply_membership_interest_edge_function.js` - Edge function wrapper for cron jobs
3. `get_membership_data_edge_function.js` - Updated data fetching edge function
4. `get_membership_summary_function.sql` - SQL function for membership summaries
5. `setup_membership_cron_job.sql` - Cron job configuration

## 🚀 **Deployment Steps:**

### **Step 1: Deploy SQL Functions**
Run these in your Supabase SQL Editor:

```sql
-- 1. Create the main interest application function
-- Copy and run: apply_membership_interest_function.sql

-- 2. Create the membership summary function  
-- Copy and run: get_membership_summary_function.sql
```

### **Step 2: Deploy Edge Functions**

```bash
# Create the interest application edge function
mkdir -p supabase/functions/apply-membership-interest
cp apply_membership_interest_edge_function.js supabase/functions/apply-membership-interest/index.ts

# Create the membership data edge function
mkdir -p supabase/functions/get-membership-data
cp get_membership_data_edge_function.js supabase/functions/get-membership-data/index.ts

# Deploy both functions
supabase functions deploy apply-membership-interest
supabase functions deploy get-membership-data
```

### **Step 3: Setup Cron Job**
```sql
-- Run in Supabase SQL Editor:
-- Copy and run: setup_membership_cron_job.sql
-- Note: Replace 'your-project-ref' with your actual Supabase project reference
```

### **Step 4: Test the System**

```sql
-- Test the interest application function manually
SELECT apply_daily_interest_to_all_memberships();

-- Test the membership summary function
SELECT get_membership_summary();
```

## 🔧 **Key Features:**

### **Interest Calculation Logic:**
- **Daily Rate**: `weekly_interest_rate / 100 / 7`
- **Compound Interest**: Applied to current membership amount (including top-ups)
- **Date Boundaries**: Only applies interest within membership start/end dates
- **Top-up Handling**: Interest calculated on new total amount after top-ups

### **Top-up Mode Handling:**
- **Continue Mode**: Interest continues on existing timeline with increased amount
- **Reset Mode**: Timeline resets, interest calculated on combined amount from new start date

### **Automatic Maturity:**
- Memberships automatically marked as 'completed' when end_date is reached
- `final_amount_to_pay` calculated as `amount + total_interest_earned`

## 📊 **Interest Application Example:**

```sql
-- Example membership:
-- Amount: $5,000
-- Weekly Interest Rate: 2.1%
-- Daily Rate: 2.1% / 7 = 0.3% per day
-- Daily Interest: $5,000 × 0.003 = $15.00 per day

-- After 7 days: $5,000 + ($15 × 7) = $5,105.00
-- After 30 days: $5,000 + ($15 × 30) = $5,450.00
```

## 🔍 **Monitoring & Logging:**

### **Check Interest Application Logs:**
```sql
SELECT * FROM public.interest_application_log 
ORDER BY created_at DESC 
LIMIT 10;
```

### **View Active Memberships:**
```sql
SELECT 
  um.id,
  mp.plan_name,
  um.amount,
  um.total_interest_earned,
  um.last_interest_update,
  um.start_date,
  um.end_date
FROM user_memberships um
JOIN membership_plans mp ON um.plan_id = mp.id
WHERE um.status = 'active'
ORDER BY um.last_interest_update;
```

### **Check Cron Job Status:**
```sql
-- View scheduled cron jobs
SELECT * FROM cron.job WHERE jobname = 'apply-daily-membership-interest';

-- View cron job execution history
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'apply-daily-membership-interest')
ORDER BY start_time DESC 
LIMIT 10;
```

## ⚠️ **Important Notes:**

1. **Timezone**: Cron job runs at midnight UTC. Adjust if needed for your timezone.

2. **Service Role Key**: The cron job needs your service role key. Store it securely in Supabase settings.

3. **Edge Function URL**: Update the URL in the cron job setup with your actual project reference.

4. **Testing**: Test thoroughly in development before deploying to production.

5. **Backup**: Always backup your database before running migration scripts.

## 🔧 **Troubleshooting:**

### **Common Issues:**

1. **Cron Job Not Running:**
   - Check if pg_cron extension is enabled
   - Verify service role key is correct
   - Check cron job syntax

2. **Interest Not Applied:**
   - Verify membership status is 'active'
   - Check start_date and end_date boundaries
   - Ensure last_interest_update is properly set

3. **Edge Function Errors:**
   - Check function deployment status
   - Verify environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
   - Check function logs in Supabase dashboard

### **Manual Interest Application:**
If cron job fails, you can manually apply interest:

```sql
-- Apply interest manually
SELECT apply_daily_interest_to_all_memberships();

-- Or with logging
SELECT apply_daily_interest_to_all_memberships_with_logging();
```

## 📈 **Performance Considerations:**

- The function uses indexes for optimal performance
- Interest is calculated in batches to handle large numbers of memberships
- Logging is optional but recommended for monitoring

## 🎯 **Next Steps:**

1. Deploy all functions and edge functions
2. Set up the cron job
3. Test with a few sample memberships
4. Monitor the first few automated runs
5. Set up alerts for failed interest applications (optional)

This system ensures accurate daily interest calculation while handling all the complexities of top-ups, different membership modes, and automatic maturity processing.
