// Debug version of create membership edge function with better error handling
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
        message: 'Valid plan_id is required.'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return new Response(JSON.stringify({
        message: 'Valid positive amount is required.'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!months || typeof months !== 'number' || months <= 0) {
      return new Response(JSON.stringify({
        message: 'Valid duration (months) is required.'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'), {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')
        }
      }
    });

    // First, test user profile
    console.log('Testing user profile...');
    const { data: profileTest, error: profileError } = await supabase.rpc('test_user_profile');
    console.log('Profile test result:', profileTest);
    
    if (profileError) {
      console.error('Profile test failed:', profileError);
    }

    // Then try the main transaction
    console.log('Calling create_user_membership_transaction...');
    const { data, error } = await supabase.rpc('create_user_membership_transaction', {
      plan_id_arg: plan_id,
      amount_arg: amount,
      months_arg: months
    });

    console.log('RPC response:', { data, error });

    if (error) {
      console.error('RPC call failed:', error);
      return new Response(JSON.stringify({
        message: 'Failed to execute transaction.',
        error: error.message,
        details: error.details,
        hint: error.hint
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const responseData = data;
    return new Response(JSON.stringify(responseData), {
      status: responseData.success ? 200 : 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (err) {
    console.error('Unexpected error:', err.message);
    return new Response(JSON.stringify({
      message: 'Internal server error.',
      error: err.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
