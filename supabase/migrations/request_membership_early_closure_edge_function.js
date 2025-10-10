// Edge Function: request-membership-early-closure
// Updated for user_memberships table schema

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const PENALTY_PERCENT = 0.10; // 10% penalty on interest earned

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('OK', { headers: corsHeaders });
  }

  try {
    const { membership_id } = await req.json();

    if (!membership_id) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Invalid input: membership_id is required.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create Supabase client with service role for admin operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Authorization header required.'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Unauthorized.'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get membership details
    const { data: membership, error: membershipError } = await supabase
      .from('user_memberships')
      .select(`
        id, 
        user_id, 
        amount, 
        total_interest_earned, 
        status,
        start_date,
        end_date,
        plan_id,
        membership_plans!inner(plan_name, weekly_interest_rate)
      `)
      .eq('id', membership_id)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Membership not found or does not belong to user.'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (membership.status !== 'active') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Cannot request closure for this membership as it is not active.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calculate penalty and final amount
    const interestEarned = membership.total_interest_earned || 0;
    const penaltyAmount = interestEarned * PENALTY_PERCENT;
    const finalAmount = membership.amount + interestEarned - penaltyAmount;

    console.log('Early closure calculation:', {
      membership_id: membership.id,
      principal: membership.amount,
      interest_earned: interestEarned,
      penalty_amount: penaltyAmount,
      final_amount: finalAmount
    });

    // Update membership status to pending_closure
    const { error: updateError } = await supabase
      .from('user_memberships')
      .update({
        status: 'pending_closure',
        penalty_applied: penaltyAmount,
        final_amount_to_pay: finalAmount
      })
      .eq('id', membership.id);

    if (updateError) {
      console.error(`Failed to update membership ${membership.id}:`, updateError);
      return new Response(JSON.stringify({
        success: false,
        message: 'Failed to request early closure.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Early closure requested successfully.',
      data: {
        membership_id: membership.id,
        plan_name: membership.membership_plans.plan_name,
        principal_amount: membership.amount,
        interest_earned: interestEarned,
        penalty_applied: penaltyAmount,
        final_amount_to_pay: finalAmount,
        status: 'pending_closure'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Error in request-membership-early-closure:', err);
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal server error.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
