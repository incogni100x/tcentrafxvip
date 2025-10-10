// Edge Function: topup-membership
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    const { membership_id, amount, topup_mode } = await req.json();

    // Validate input
    if (!membership_id || typeof membership_id !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Valid membership_id is required.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Valid positive amount is required.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (topup_mode && !['continue', 'reset'].includes(topup_mode)) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Invalid topup_mode. Must be "continue" or "reset".'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'), 
      Deno.env.get('SUPABASE_ANON_KEY'), 
      {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization')
          }
        }
      }
    );

    const { data, error } = await supabase.rpc('topup_membership', {
      membership_id_arg: membership_id,
      amount_arg: amount,
      topup_mode_arg: topup_mode || 'continue'
    });

    if (error) {
      console.error('RPC call failed:', error);
      return new Response(JSON.stringify({
        success: false,
        message: 'Failed to execute top-up transaction.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const responseData = data;
    return new Response(JSON.stringify(responseData), {
      status: responseData.success ? 200 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Unexpected error:', err.message);
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal server error.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
