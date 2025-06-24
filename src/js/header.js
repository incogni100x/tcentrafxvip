import { supabase } from './client.js';
import { getCurrentUser, signOut } from './session.js';

// Update Header UI
async function updateHeaderUI() {
    const user = await getCurrentUser();
    
    if (!user) {
        const path = window.location.pathname.split('/').pop();
        if (path !== '' && path !== 'index.html' && path !== 'signup.html') {
            window.location.href = '/';
        }
        return;
    }

    // Get initials from auth metadata (same as deposit.js)
    const fullName = user.user_metadata?.full_name || 'User';
    const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase();
    
    document.querySelectorAll('#user-initials').forEach(el => {
        el.textContent = initials;
    });

    // Still fire the event for compatibility with dashboard pages
    const event = new CustomEvent('profile-loaded', { detail: { user } });
    document.dispatchEvent(event);
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
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            await updateHeaderUI();
        } else if (event === 'SIGNED_OUT') {
            window.location.href = '/';
        }
    });
}

// This runs on every page that includes header.js, ensuring consistent behavior.
document.addEventListener('DOMContentLoaded', initializeHeader);

export { initializeHeader }; 