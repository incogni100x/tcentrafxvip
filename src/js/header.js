import { supabase } from './client.js';
import { getUserWithProfile, signOut } from './session.js';

// Update Header UI
function updateHeaderUI(profile) {
    if (!profile) {
        const path = window.location.pathname.split('/').pop();
        if (path !== '' && path !== 'index.html' && path !== 'signup.html') {
            window.location.href = '/';
        }
        return;
    }

    let initials = '??';
    
    // Attempt 1: Use first_name and last_name
    if (typeof profile.first_name === 'string' && profile.first_name.length > 0 && typeof profile.last_name === 'string' && profile.last_name.length > 0) {
        initials = `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase();
    } 
    // Attempt 2: Use a 'name' or 'full_name' field
    else {
        const fullName = profile.name || profile.full_name;
        if (typeof fullName === 'string' && fullName.length > 0) {
            const nameParts = fullName.split(' ').filter(Boolean);
            if (nameParts.length > 1) {
                initials = `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase();
            } else if (nameParts.length === 1) {
                initials = `${nameParts[0].slice(0, 2)}`.toUpperCase();
            }
        } else {
             console.warn('User profile is incomplete, cannot generate initials.', profile);
        }
    }

    document.querySelectorAll('#user-initials').forEach(el => {
        el.textContent = initials;
    });
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
function initializeHeader() {
    // These are safe to run immediately as they only set up event listeners
    initializeLogoutButtons();
    initializeSidebar();

    // Listen for auth state changes. This will fire once on page load
    // and correctly handle the timing of post-login session availability.
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            // User is signed in. We can now safely get their profile.
            const profile = await getUserWithProfile();
            updateHeaderUI(profile);
        } else {
            // User is signed out. Let updateHeaderUI handle redirects.
            updateHeaderUI(null);
        }
    });
}

// This runs on every page that includes header.js, ensuring consistent behavior.
document.addEventListener('DOMContentLoaded', initializeHeader);

export { initializeHeader }; 