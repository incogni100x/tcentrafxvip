// Edge Function: get-locked-savings-data
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: req.headers.get('Authorization') } } }
    );

    const { data, error } = await supabase.rpc('get_locked_savings_summary');
    
    if (error) {
      console.error('Error fetching locked savings summary:', error);
      throw error;
    }

    // Ensure we always return an object with the expected keys, even if the function returns null
    const responseData = data || {
      total_principal: 0,
      total_interest_earned: 0,
      active_deposits_count: 0,
      active_savings: [],
      historical_savings: []
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
}); 