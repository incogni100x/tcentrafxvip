import { supabase } from './client.js';
import { getCurrentUser } from './session.js';
import Toastify from 'toastify-js';

// Helper to get initials from a name
function getInitials(name) {
  if (!name) return '??';
  const names = name.split(' ');
  if (names.length > 1) {
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Function to populate all user data across the page
function populateUserData(profile) {
  if (!profile) return;

  // Use full name for header and initials, fallback to email if name is not set
  const displayName = profile.full_name || profile.email;
  const initials = getInitials(displayName);
  const email = profile.email || 'N/A';

  // Header elements
  const userInitialsElements = document.querySelectorAll('#user-initials');
  userInitialsElements.forEach(el => el.textContent = initials);
  
  // Profile card elements
  const userNameElement = document.getElementById('user-name');
  if (userNameElement) userNameElement.textContent = displayName;
  
  const userEmailElement = document.getElementById('user-email');
  if (userEmailElement) userEmailElement.textContent = email;

  // Form fields
  const fullNameInput = document.getElementById('full-name');
  if (fullNameInput) fullNameInput.value = profile.full_name || '';

  const emailInput = document.getElementById('email');
  if (emailInput) emailInput.value = profile.email || '';

  const phoneInput = document.getElementById('phone-number');
  if (phoneInput) phoneInput.value = profile.phone_number || '';

  const countryInput = document.getElementById('country');
  if (countryInput) {
    // Handle mapping from common full names to the dropdown's value attribute
    countryInput.value = profile.country || '';
  }
}

// Function to fetch the user's profile
async function fetchUserProfile() {
  const user = await getCurrentUser();
  if (!user) {
    Toastify({
      text: "You must be logged in to view your profile.",
      duration: 3000,
      gravity: "top",
      position: "center",
      style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
    }).showToast();
    // Redirect to login page after a short delay
    setTimeout(() => window.location.href = '/login', 3000);
    return;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // PGRST116 means no rows were found, which is a valid state for a new user.
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching profile:', error);
    Toastify({
      text: "Could not load your profile data.",
      duration: 3000,
      gravity: "top",
      position: "center",
      style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
    }).showToast();
  } else {
    // If profile is null (new user), create a default object to populate fields
    const userProfile = profile || { full_name: '', phone_number: '', country: '' };
    // Combine with auth data which is the source of truth for email
    populateUserData({ ...userProfile, email: user.email });
  }
}

// Function to handle profile updates
async function handleProfileUpdate(event) {
  event.preventDefault();
  const saveButton = event.target.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  saveButton.textContent = 'Saving...';

  const user = await getCurrentUser();
  if (!user) {
    Toastify({ text: "Authentication error. Please log in again.", duration: 3000, style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }}).showToast();
    saveButton.disabled = false;
    saveButton.textContent = 'Save Changes';
    return;
  }

  // Get data from form
  const fullName = document.getElementById('full-name').value;
  const phoneNumber = document.getElementById('phone-number').value;

  const { error } = await supabase
    .from('profiles')
    .upsert({ 
      id: user.id, // Included for upsert to find or create the row
      full_name: fullName,
      phone_number: phoneNumber,
      updated_at: new Date()
    })
    .eq('id', user.id);
  
  if (error) {
    console.error('Error updating profile:', error);
    Toastify({
      text: `Error: ${error.message}`,
      duration: 3000,
      gravity: "top",
      position: "center",
      style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
    }).showToast();
  } else {
    Toastify({
      text: "Profile updated successfully!",
      duration: 3000,
      gravity: "top",
      position: "center",
      style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
    }).showToast();
    // Repopulate headers with new name
    const userInitialsElements = document.querySelectorAll('#user-initials');
    userInitialsElements.forEach(el => el.textContent = getInitials(fullName));
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) userNameElement.textContent = fullName;
  }

  saveButton.disabled = false;
  saveButton.textContent = 'Save Changes';
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  fetchUserProfile();

  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', handleProfileUpdate);
  }
});