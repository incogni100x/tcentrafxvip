import { supabase } from './client.js';

export async function buyCrypto(crypto_symbol, units) {
  try {
    const { data, error } = await supabase.functions.invoke('buy-crypto', {
      body: { crypto_symbol, amount_to_buy: units },
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

    return data;
  } catch (err) {
    console.error('Unexpected error calling buy-crypto function:', err);
    return { success: false, message: 'An unexpected error occurred.' };
  }
} 