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

    // First, get the authenticated user from Supabase. This is the source of truth.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.log("No authenticated user found.");
        return null;
    }

    // Now, try to get the profile from the database.
    // This might fail if the profile is new, but the user is still valid.
    try {
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError && profileError.code !== 'PGRST116') {
            // PGRST116 means no rows found, which is a valid case for a new user.
            // We only throw for other, unexpected errors.
            throw profileError;
        }

        if (profileData) {
            const userWithProfile = { ...user, profile: profileData };
            sessionStorage.setItem('userProfile', JSON.stringify(userWithProfile));
            return userWithProfile;
        }

    } catch (dbError) {
        console.error("Database error fetching profile:", dbError.message);
        // Don't kill the session for a DB error. Return the user without a profile.
    }

    // If we are here, it means the user is authenticated but has no profile yet,
    // or there was a non-critical DB error.
    // Return the core user object so the app knows someone is logged in.
    console.warn("User is authenticated, but profile data is not available. Returning user object without profile.");
    return user;
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