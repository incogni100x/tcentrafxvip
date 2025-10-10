// Edge Function: apply-membership-interest
// Applies daily interest to all active user memberships
// Designed to be called by Supabase Cron job at midnight

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key for admin operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    console.log('Starting daily interest application for memberships...');

    // Call the SQL function to apply interest to all active memberships
    const { data, error } = await supabase.rpc('apply_daily_interest_to_all_memberships');

    if (error) {
      console.error('Error applying daily interest:', error);
      throw error;
    }

    console.log('Interest application completed:', data);

    // Optional: Get summary statistics for logging
    const { data: stats, error: statsError } = await supabase
      .from('user_memberships')
      .select('status, count(*)', { count: 'exact' })
      .eq('status', 'active');

    if (statsError) {
      console.warn('Could not fetch membership statistics:', statsError);
    }

    const response = {
      success: true,
      message: data,
      timestamp: new Date().toISOString(),
      active_memberships: stats ? stats.length : 'unknown'
    };

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });

  } catch (err) {
    console.error('Failed to apply daily interest:', err);
    
    const errorResponse = {
      success: false,
      message: `Failed to apply interest: ${err.message}`,
      timestamp: new Date().toISOString(),
      error: err.name
    };

    return new Response(JSON.stringify(errorResponse), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
