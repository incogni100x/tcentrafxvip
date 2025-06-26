import { supabase } from './client.js';
import { getUserWithProfile, signOut, getCurrentUser } from './session.js';

// Update Header UI
async function updateHeaderUI() {
    const user = await getCurrentUser();
    
    if (!user) {
        const path = window.location.pathname.split('/').pop();
        if (path !== '' && path !== 'index.html' && path !== 'register.html' && path !== 'login.html' && path !== 'forgot-password.html') {
            window.location.href = '/';
        }
        return;
    }

    // UNBLOCK PAGE LOAD: Dispatch the event immediately after confirming a user exists.
    const event = new CustomEvent('profile-loaded', { detail: { user: user } });
    document.dispatchEvent(event);
    
    // Set a quick, temporary name from the auth data.
    const tempFullName = user.user_metadata?.full_name || 'User';
    const tempInitials = tempFullName.split(' ').map(n => n[0]).join('').toUpperCase();
    document.querySelectorAll('#user-initials').forEach(el => {
        el.textContent = tempInitials;
    });

    // Now, fetch the full profile in the background to get the most up-to-date data.
    const userProfile = await getUserWithProfile();

    if (userProfile && userProfile.full_name) {
        const finalInitials = userProfile.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
        document.querySelectorAll('#user-initials').forEach(el => {
            el.textContent = finalInitials;
        });
    }
}

// Logout functionality
function initializeLogoutButtons() {
    document.querySelectorAll('#logout-button-desktop, #logout-button-mobile').forEach(button => {
        button.addEventListener('click', async () => {
            await signOut();
            window.location.href = '/';
        });
    });
}

// Sidebar functionality
function initializeSidebar() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileSidebar = document.getElementById('mobile-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (!mobileMenuBtn || !mobileSidebar || !sidebarOverlay) return;

    function openSidebar() {
        mobileSidebar.classList.remove('-translate-x-full');
        sidebarOverlay.classList.remove('opacity-0', 'pointer-events-none');
    }

    function closeSidebar() {
        mobileSidebar.classList.add('-translate-x-full');
        sidebarOverlay.classList.add('opacity-0', 'pointer-events-none');
    }

    mobileMenuBtn.addEventListener('click', openSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024) {
            closeSidebar();
        }
    });
}

// Main initialization function
async function initializeHeader() {
    // These are safe to run immediately as they only set up event listeners
    initializeLogoutButtons();
    initializeSidebar();

    // Get user and update UI immediately
    await updateHeaderUI();
    
    // Also listen for auth state changes for real-time updates
    supabase.auth.onAuthStateChange(async (event, session) => {
        // We only need to react to sign-out events here, as sign-in/refresh
        // will trigger a page load that runs updateHeaderUI anyway.
        if (event === 'SIGNED_OUT') {
            window.location.href = '/';
        }
    });
}

// This runs on every page that includes header.js, ensuring consistent behavior.
document.addEventListener('DOMContentLoaded', initializeHeader);

export { initializeHeader }; 