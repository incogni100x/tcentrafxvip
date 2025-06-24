import { supabase } from './client.js';

export async function getUserWithProfile() {
    const cachedProfile = sessionStorage.getItem('userProfile');
    if (cachedProfile) {
        try {
            return JSON.parse(cachedProfile);
        } catch (e) {
            sessionStorage.removeItem('userProfile');
        }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return null;
    }

    // Retry logic to handle the small delay between user creation in auth
    // and profile creation in the database via a trigger.
    for (let i = 0; i < 3; i++) {
        try {
            const { data, error, status } = await supabase.functions.invoke('get-user-profile');

            if (error) {
                // If we get a real auth error, sign out and redirect immediately.
                if (status === 401 || status === 403) {
                    throw new Error('User is not authorized.');
                }
                // For other errors, log them but allow a retry.
                console.warn(`Attempt ${i + 1} to fetch profile failed:`, error.message);
            }

            // If we get a profile, cache and return it.
            if (data && data.profile) {
                sessionStorage.setItem('userProfile', JSON.stringify(data.profile));
                return data.profile;
            }

            // If no profile was found yet, wait before retrying.
            if (i < 2) { // Don't wait after the last attempt.
                await new Promise(res => setTimeout(res, 500));
            }
        } catch (err) {
            console.error('Critical error fetching user profile:', err.message);
            await signOut(); // This will clear session storage and sign out from Supabase.
            window.location.href = '/'; // Force redirect.
            return null; // Stop execution.
        }
    }

    console.error('Failed to retrieve user profile after multiple attempts.');
    // If all retries fail, it's a genuine issue, so sign out.
    await signOut();
    window.location.href = '/';
    return null;
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