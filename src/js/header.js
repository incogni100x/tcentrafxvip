import { supabase } from './client.js';

// Reusable function to get user profile and cache it
async function getUserProfile() {
    const cachedProfile = sessionStorage.getItem('userProfile');
    if (cachedProfile) {
        return JSON.parse(cachedProfile);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = '/';
        return null;
    }

    try {
        const { data, error, status } = await supabase.functions.invoke('get-user-profile', {
            method: 'POST',
            body: { userId: user.id }
        });

        if (error) {
            console.error('Error fetching user profile:', error);
            if (status === 401 || status === 403) {
                // Unauthorized, clear session and redirect to login
                await supabase.auth.signOut();
                sessionStorage.clear();
                window.location.href = '/';
            }
            return null;
        }

        if (data && data.profile) {
            sessionStorage.setItem('userProfile', JSON.stringify(data.profile));
            return data.profile;
        }

    } catch (e) {
        console.error('Exception fetching user profile:', e);
        return null;
    }
}

// Update Header UI
function updateHeaderUI(profile) {
    if (!profile) return;
    const { first_name, last_name } = profile;

    if (typeof first_name === 'string' && first_name.length > 0 && typeof last_name === 'string' && last_name.length > 0) {
        const initials = `${first_name.charAt(0)}${last_name.charAt(0)}`.toUpperCase();
        document.querySelectorAll('#user-initials').forEach(el => {
            el.textContent = initials;
        });
    } else {
        console.warn('User profile is incomplete, cannot generate initials.', profile);
        document.querySelectorAll('#user-initials').forEach(el => {
            el.textContent = '??';
        });
    }
}

// Logout functionality
async function logout() {
    await supabase.auth.signOut();
    sessionStorage.clear();
    window.location.href = '/';
}

function initializeLogoutButtons() {
    document.querySelectorAll('#logout-button-desktop, #logout-button-mobile').forEach(button => {
        button.addEventListener('click', logout);
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
    // Populate from cache first for speed
    const cachedProfile = sessionStorage.getItem('userProfile');
    if (cachedProfile) {
        updateHeaderUI(JSON.parse(cachedProfile));
    }
    
    // Then fetch fresh data
    const profile = await getUserProfile();
    if (profile) {
        updateHeaderUI(profile);
    }

    initializeLogoutButtons();
    initializeSidebar();
}

document.addEventListener('DOMContentLoaded', initializeHeader);

export { getUserProfile, updateHeaderUI, initializeHeader }; 