import { supabase } from './client.js';

export async function getUserWithProfile() {
    const cachedProfile = sessionStorage.getItem('userProfile');
    if (cachedProfile) {
        return JSON.parse(cachedProfile);
    }

    // A user must be logged in to get a profile.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return null;
    }

    try {
        const { data, error } = await supabase.functions.invoke('get-user-profile');

        if (error) {
            throw error;
        }

        if (data && data.profile) {
            sessionStorage.setItem('userProfile', JSON.stringify(data.profile));
            return data.profile;
        }
        return null;
    } catch (error) {
        console.error('Error fetching user profile:', error.message);
        // If the error is an auth error, sign out and redirect.
        if (error.context?.status === 401 || error.context?.status === 403) {
            await signOut(); // This will also clear storage
            window.location.href = '/';
        }
        return null;
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