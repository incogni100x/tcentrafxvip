import { supabase } from './client.js';

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
            return { ...user, profile: JSON.parse(cachedProfile) };
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

        if (profileData) {
            // Store the fetched profile in sessionStorage for next time
            sessionStorage.setItem(cachedProfileKey, JSON.stringify(profileData));
            return { ...user, profile: profileData };
        } else {
             // User is authenticated but has no profile in the DB yet.
             console.warn("User authenticated but no profile found in database.");
             return user; // Return the user object without a profile.
        }

    } catch (dbError) {
        console.error("Database error fetching profile:", dbError.message);
        // Even if the profile fetch fails, we have an authenticated user.
        // Return the user object so the app doesn't think they are logged out.
        return user;
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