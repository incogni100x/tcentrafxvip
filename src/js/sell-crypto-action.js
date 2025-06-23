import { supabase } from './client.js';

export async function sellCrypto(crypto_symbol, units) {
  try {
    const { data, error } = await supabase.functions.invoke('sell-crypto', {
      body: { crypto_symbol, amount_to_sell: units },
    });

    if (error) {
      let errorMessage = 'An error occurred during the transaction.';
      if (error.context && typeof error.context.json === 'function') {
        try {
          const errorBody = await error.context.json();
          if (errorBody && errorBody.message) {
            errorMessage = errorBody.message;
          }
        } catch (e) {
          // Fallback if body is not JSON
          errorMessage = error.message || 'An unknown error occurred.';
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      return { success: false, message: errorMessage };
    }

    // The data from a successful RPC call is the return value of the function itself
    return data;
  } catch (err) {
    console.error('Unexpected error calling sell-crypto function:', err);
    return { success: false, message: 'An unexpected error occurred.' };
  }
} 