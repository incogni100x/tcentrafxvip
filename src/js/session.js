import { supabase } from './client.js';

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
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Error signing out:', error);
    }
    return !error;
} 