import { supabase } from './client.js';
import { getCurrentUser } from './session.js';

/**
 * Fetches notifications for the current user.
 * This includes personal notifications and unexpired global notifications.
 * @returns {Promise<Array|null>} A promise that resolves to an array of notifications or null if no user is logged in or on error.
 */
export async function getNotifications() {
    const user = await getCurrentUser();

    // For logged-out users, only fetch active global notifications
    if (!user) {
         try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('type', 'global')
                .or('expires_at.is.null,expires_at.gt.now()');

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching global notifications:', error.message);
            return null;
        }
    }

    // For logged-in users, fetch their personal notifications + active global notifications
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .or(`user_id.eq.${user.id},type.eq.global`)
            .or('expires_at.is.null,expires_at.gt.now()');


        if (error) {
            console.error('Error fetching notifications:', error.message);
            throw error;
        }
        return data;
    } catch (dbError) {
        console.error("Database error fetching notifications:", dbError.message);
        return null;
    }
}

/**
 * Marks a notification as read.
 * @param {string} notificationId The ID of the notification to mark as read.
 * @returns {Promise<boolean>} A promise that resolves to true on success, false on failure.
 */
export async function markNotificationAsRead(notificationId) {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error marking notification as read:', error.message);
        return false;
    }
} 