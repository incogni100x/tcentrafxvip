// Edge Function: get-dashboard-data
// Updated for membership system instead of locked savings

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create a new Supabase client for each request,
    // authenticated with the user's JWT.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization')
          }
        }
      }
    );

    // Call the database function to get all dashboard data.
    const { data, error } = await supabaseClient.rpc('get_dashboard_data');

    if (error) {
      console.error('Error fetching dashboard data:', error);
      return new Response(JSON.stringify({
        success: false,
        message: error.message
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // The function returns a single object in an array, so we return the first element
    // But also include additional membership summary data
    const dashboardData = data[0];
    
    // Get additional membership summary for more detailed info
    const { data: membershipSummary, error: membershipError } = await supabaseClient.rpc('get_membership_summary');
    
    if (membershipError) {
      console.warn('Could not fetch membership summary:', membershipError);
    }

    // Combine dashboard data with membership summary
    const responseData = {
      ...dashboardData,
      // Rename for consistency with frontend
      total_locked_savings: dashboardData.total_membership_value,
      // Add membership details if available
      membership_summary: membershipSummary || {
        total_principal: 0,
        total_interest_earned: 0,
        active_deposits_count: 0
      }
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (err) {
    // This catches other errors, like an invalid auth header.
    console.error('Unexpected error in get-dashboard-data:', err);
    return new Response(JSON.stringify({
      success: false,
      message: `An unexpected error occurred: ${err.message}`
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
