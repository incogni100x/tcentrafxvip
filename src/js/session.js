import { supabase } from './client.js';
import { getNotifications } from './notifications.js';

export async function getUserWithProfile() {
    // 1. Get the session from Supabase. This is the source of truth for auth state
    // and will handle automatic token refreshing.
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
        console.error("Error getting session:", sessionError.message);
        return null;
    }

    if (!session) {
        // No user is signed in.
        sessionStorage.removeItem('userProfile'); // Clean up old cache just in case
        return null;
    }

    const user = session.user;

    // 2. We have a valid session. Now, let's get the profile, using a cache to be efficient.
    const cachedProfileKey = `userProfile_${user.id}`;
    const cachedProfile = sessionStorage.getItem(cachedProfileKey);

    if (cachedProfile) {
        try {
            // Combine the fresh session user with the cached profile
            const profile = JSON.parse(cachedProfile);
            const notifications = await getNotifications();
            return { ...user, profile, notifications };
        } catch (e) {
            // If parsing fails, remove the bad item and fetch from DB
            sessionStorage.removeItem(cachedProfileKey);
        }
    }

    // 3. Profile not in cache, so fetch from the database.
    try {
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError && profileError.code !== 'PGRST116') {
            // PGRST116 means no rows were found, which can happen for new users.
            // We only want to throw for other, unexpected database errors.
            throw profileError;
        }

        const notifications = await getNotifications();

        if (profileData) {
            // Store the fetched profile in sessionStorage for next time
            sessionStorage.setItem(cachedProfileKey, JSON.stringify(profileData));
            return { ...user, profile: profileData, notifications };
        } else {
             // User is authenticated but has no profile in the DB yet.
             console.warn("User authenticated but no profile found in database.");
             return { ...user, notifications }; // Return the user object without a profile.
        }

    } catch (dbError) {
        console.error("Database error fetching profile:", dbError.message);
        // Even if the profile fetch fails, we have an authenticated user.
        // Return the user object so the app doesn't think they are logged out.
        const notifications = await getNotifications();
        return { ...user, notifications };
    }
}

export async function getCurrentUser() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  return session?.user || null;
}

export function onAuthStateChange(callback) {
  supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });
}

export async function signOut() {
    sessionStorage.clear(); // Clear our custom cache
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Error signing out:', error);
    }
    return !error;
}

// --- CURRENCY UTILITIES ---

/**
 * Get the user's preferred currency from their cached profile
 * @returns {Promise<string>} Currency code (e.g., 'USD', 'EUR', 'GBP')
 */
export async function getUserCurrency() {
  const user = await getCurrentUser();
  if (!user) {
    console.log('getUserCurrency: No user found, returning USD');
    return 'USD';
  }
  
  const cachedProfileKey = `userProfile_${user.id}`;
  const cachedProfile = sessionStorage.getItem(cachedProfileKey);
  
  console.log('getUserCurrency: Cached profile key:', cachedProfileKey);
  console.log('getUserCurrency: Cached profile exists:', !!cachedProfile);
  
  if (cachedProfile) {
    try {
      const profile = JSON.parse(cachedProfile);
      console.log('getUserCurrency: Profile currency_code:', profile.currency_code);
      return profile.currency_code || 'USD';
    } catch (e) {
      console.warn('Failed to parse cached profile for currency:', e);
      return 'USD';
    }
  }
  
  console.log('getUserCurrency: No cached profile, returning USD');
  return 'USD';
}

/**
 * Format a number as currency using the user's preferred currency
 * @param {number} amount - The amount to format
 * @param {string} currencyCode - Optional currency code override
 * @returns {Promise<string>} Formatted currency string
 */
export async function formatCurrency(amount, currencyCode = null) {
  const currency = currencyCode || await getUserCurrency();
  const symbol = getCurrencySymbol(currency);
  
  // Format number with proper decimal places
  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
  
  // Return formatted currency with our custom symbol
  return `${symbol}${formattedNumber}`;
}

/**
 * Get currency symbol for the user's preferred currency
 * @param {string} currencyCode - Optional currency code override
 * @returns {string} Currency symbol (e.g., '$', '€', '£')
 */
export function getCurrencySymbol(currencyCode = null) {
  const currency = currencyCode || getUserCurrency();
  
  // Common currency symbols for better UX (using English symbols, not native)
  const currencySymbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CAD': 'CA$',
    'AUD': 'AU$',
    'CHF': 'CHF',
    'CNY': 'CN¥',
    'SEK': 'Skr',
    'NOK': 'Nkr',
    'DKK': 'Dkr',
    'PLN': 'zł',
    'CZK': 'Kč',
    'HUF': 'Ft',
    'RUB': 'RUB',
    'INR': '₹',
    'KRW': '₩',
    'SGD': 'S$',
    'HKD': 'HK$',
    'NZD': 'NZ$',
    'MXN': 'MX$',
    'BRL': 'R$',
    'ZAR': 'R',
    'TRY': 'TL',
    'AED': 'AED',
    'SAR': 'SR',
    'QAR': 'QR',
    'KWD': 'KD',
    'BHD': 'BD',
    'OMR': 'OMR',
    'JOD': 'JD',
    'LBP': 'LB£',
    'EGP': 'EGP',
    'MAD': 'MAD',
    'TND': 'DT',
    'DZD': 'DA',
    'LYD': 'LD',
    'NGN': '₦',
    'GHS': 'GH₵',
    'KES': 'Ksh',
    'UGX': 'USh',
    'TZS': 'TSh',
    'ETB': 'Br',
    'ZMK': 'ZK',
    'BWP': 'BWP',
    'ZWL': 'ZWL$',
    'XAF': 'FCFA',
    'XOF': 'CFA'
  };
  
  return currencySymbols[currency] || '$';
} 