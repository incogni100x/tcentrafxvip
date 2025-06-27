import { supabase } from './client.js';
import { getUserWithProfile, signOut, getCurrentUser } from './session.js';
import { getNotifications, markNotificationAsRead } from './notifications.js';

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

    if (userProfile && userProfile.profile && userProfile.profile.full_name) {
        const finalInitials = userProfile.profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
        document.querySelectorAll('#user-initials').forEach(el => {
            el.textContent = finalInitials;
        });
    }
    // Render notifications
    if (userProfile && userProfile.notifications) {
        renderNotifications(userProfile.notifications);
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

function initializeNotifications() {
    const notificationButton = document.getElementById('notification-button');
    const notificationPanel = document.getElementById('notification-panel');

    if (!notificationButton || !notificationPanel) return;

    notificationButton.addEventListener('click', (event) => {
        event.stopPropagation();
        const isHidden = notificationPanel.classList.contains('hidden');
        if (isHidden) {
            notificationPanel.classList.remove('hidden');
            // We could also mark notifications as read on open
        } else {
            notificationPanel.classList.add('hidden');
        }
    });

    // Close the panel if clicking outside
    document.addEventListener('click', (event) => {
        if (!notificationPanel.contains(event.target) && !notificationButton.contains(event.target)) {
            notificationPanel.classList.add('hidden');
        }
    });
    
}

function renderNotifications(notifications) {
    const notificationList = document.getElementById('notification-list');
    const notificationDot = document.getElementById('notification-dot');
    if (!notificationList || !notificationDot) return;

    notificationList.innerHTML = ''; // Clear previous notifications

    if (!notifications || notifications.length === 0) {
        notificationList.innerHTML = '<div class="p-4 text-center text-gray-400">You have no new notifications.</div>';
        notificationDot.classList.add('hidden');
        return;
    }

    const hasUnread = notifications.some(n => !n.is_read);
    if (hasUnread) {
        notificationDot.classList.remove('hidden');
    } else {
        notificationDot.classList.add('hidden');
    }

    notifications.forEach(notification => {
        const notificationElement = document.createElement('div');
        notificationElement.className = `p-4 border-b border-gray-700 ${!notification.is_read ? 'bg-gray-750' : ''}`;
        notificationElement.innerHTML = `
            <h4 class="font-semibold text-white">${notification.title}</h4>
            <p class="text-sm text-gray-300">${notification.message}</p>
            <div class="text-xs text-gray-400 mt-2">${new Date(notification.created_at).toLocaleString()}</div>
        `;
        notificationElement.addEventListener('click', async () => {
            if (!notification.is_read) {
                await markNotificationAsRead(notification.id);
                notificationElement.classList.remove('bg-gray-750');
                // Optimistically update the UI
                const remainingUnread = notifications.find(n => n.id !== notification.id && !n.is_read);
                if (!remainingUnread) {
                    notificationDot.classList.add('hidden');
                }
            }
        });
        notificationList.appendChild(notificationElement);
    });
}

// Main initialization function
async function initializeHeader() {
    // These are safe to run immediately as they only set up event listeners
    initializeLogoutButtons();
    initializeSidebar();
    initializeNotifications();

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