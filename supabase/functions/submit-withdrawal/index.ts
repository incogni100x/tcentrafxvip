import { createClient } from 'https://esm.sh/@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { 
      amount, 
      method, 
      description, 
      saved_beneficiary_id,
      bank_name, 
      account_holder_name, 
      account_number, 
      routing_number, 
      swift_code, 
      bank_address, 
      crypto_currency, 
      crypto_wallet_address 
    } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') },
        },
      }
    );

    const { data, error } = await supabase.rpc('submit_withdrawal_transaction', {
      amount_to_withdraw: amount,
      withdrawal_method: method,
      withdrawal_description: description,
      p_saved_beneficiary_id: saved_beneficiary_id,
      p_bank_name: bank_name,
      p_account_holder_name: account_holder_name,
      p_account_number: account_number,
      p_routing_number: routing_number,
      p_swift_code: swift_code,
      p_bank_address: bank_address,
      p_crypto_currency: crypto_currency,
      p_crypto_wallet_address: crypto_wallet_address,
    });

    if (error) {
      console.error('Database error:', error);
      throw new Error(error.message);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
}); 