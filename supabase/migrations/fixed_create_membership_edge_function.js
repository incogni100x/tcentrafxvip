// Fixed create membership edge function - removes topup_mode parameter and always returns 200
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
    const { plan_id, amount, months } = await req.json();

    // Validate input
    if (!plan_id || typeof plan_id !== 'number') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Valid plan_id is required.'
      }), {
        status: 200, // Always return 200 to allow frontend to parse response
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Valid positive amount is required.'
      }), {
        status: 200, // Always return 200 to allow frontend to parse response
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!months || typeof months !== 'number' || months <= 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Valid duration (months) is required.'
      }), {
        status: 200, // Always return 200 to allow frontend to parse response
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
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

    const { data, error } = await supabase.rpc('create_user_membership_transaction', {
      plan_id_arg: plan_id,
      amount_arg: amount,
      months_arg: months
    });

    if (error) {
      console.error('RPC call failed:', error);
      return new Response(JSON.stringify({
        success: false,
        message: 'Failed to execute transaction.',
        error: error.message
      }), {
        status: 200, // Always return 200 to allow frontend to parse response
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Return the RPC response data (which includes success/failure status)
    return new Response(JSON.stringify(data), {
      status: 200, // Always return 200 to allow frontend to parse response
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (err) {
    console.error('Unexpected error:', err.message);
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal server error.',
      error: err.message
    }), {
      status: 200, // Always return 200 to allow frontend to parse response
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});