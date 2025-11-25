import { supabase } from './client.js';
import { getCurrentUser } from './session.js';
import Toastify from 'toastify-js';
import 'toastify-js/src/toastify.css';

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

  const phoneInput = document.getElementById('phone_number');
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
    Toastify({ text: "You must be logged in to view your profile.", className: 'toast-error' }).showToast();
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
    Toastify({ text: "Could not load your profile data.", className: 'toast-error' }).showToast();
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
    Toastify({ text: "Authentication error. Please log in again.", className: 'toast-error' }).showToast();
    saveButton.disabled = false;
    saveButton.textContent = 'Save Changes';
    return;
  }

  // Get data from form
  const fullName = document.getElementById('full-name').value;
  const phoneNumber = document.getElementById('phone_number').value;

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
    Toastify({ text: `Error: ${error.message}`, className: 'toast-error' }).showToast();
  } else {
    Toastify({ text: "Profile updated successfully!", className: 'toast-success' }).showToast();
    // Repopulate headers with new name
    const userInitialsElements = document.querySelectorAll('#user-initials');
    userInitialsElements.forEach(el => el.textContent = getInitials(fullName));
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) userNameElement.textContent = fullName;
  }

  saveButton.disabled = false;
  saveButton.textContent = 'Save Changes';
}

// Function to handle password updates
async function handlePasswordUpdate(event) {
  event.preventDefault();
  const submitButton = event.target.querySelector('button[type="submit"]');
  const loadingSpinner = submitButton.querySelector('.loading-spinner');
  const buttonText = submitButton.querySelector('.button-text');
  
  // Show loading state
  submitButton.disabled = true;
  if (loadingSpinner) loadingSpinner.classList.remove('hidden');
  if (buttonText) buttonText.textContent = 'Updating...';

  const user = await getCurrentUser();
  if (!user) {
    Toastify({ text: "Authentication error. Please log in again.", className: 'toast-error' }).showToast();
    submitButton.disabled = false;
    if (loadingSpinner) loadingSpinner.classList.add('hidden');
    if (buttonText) buttonText.textContent = 'Update Password';
    return;
  }

  // Get form values
  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  // Validate inputs
  if (!currentPassword || !newPassword || !confirmPassword) {
    Toastify({ text: "Please fill in all password fields.", className: 'toast-error' }).showToast();
    submitButton.disabled = false;
    if (loadingSpinner) loadingSpinner.classList.add('hidden');
    if (buttonText) buttonText.textContent = 'Update Password';
    return;
  }

  // Validate password match
  if (newPassword !== confirmPassword) {
    Toastify({ text: "New passwords do not match.", className: 'toast-error' }).showToast();
    submitButton.disabled = false;
    if (loadingSpinner) loadingSpinner.classList.add('hidden');
    if (buttonText) buttonText.textContent = 'Update Password';
    return;
  }

  // Validate password strength (matching the UI requirements)
  const hasLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

  if (!hasLength || !hasUppercase || !hasNumber || !hasSpecial) {
    Toastify({ text: "Password does not meet strength requirements. Please check all criteria.", className: 'toast-error' }).showToast();
    submitButton.disabled = false;
    if (loadingSpinner) loadingSpinner.classList.add('hidden');
    if (buttonText) buttonText.textContent = 'Update Password';
    return;
  }

  // Verify current password by attempting to sign in
  // Use the user email we already have from getCurrentUser()
  if (!user.email) {
    Toastify({ text: "Could not retrieve user information.", className: 'toast-error' }).showToast();
    submitButton.disabled = false;
    if (loadingSpinner) loadingSpinner.classList.add('hidden');
    if (buttonText) buttonText.textContent = 'Update Password';
    return;
  }

  // Verify current password by attempting to sign in
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword
  });

  if (verifyError) {
    Toastify({ text: "Current password is incorrect.", className: 'toast-error' }).showToast();
    submitButton.disabled = false;
    if (loadingSpinner) loadingSpinner.classList.add('hidden');
    if (buttonText) buttonText.textContent = 'Update Password';
    // Clear current password field
    document.getElementById('current-password').value = '';
    return;
  }

  // Current password is correct, now update to new password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (updateError) {
    console.error('Error updating password:', updateError);
    Toastify({ text: `Error updating password: ${updateError.message}`, className: 'toast-error' }).showToast();
  } else {
    Toastify({ text: "Password updated successfully!", className: 'toast-success' }).showToast();
    
    // Clear form
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
    
    // Reset password strength indicator
    const strengthBar = document.getElementById('password-strength-bar');
    if (strengthBar) {
      strengthBar.style.width = '0%';
      strengthBar.className = 'h-full bg-yellow-500 rounded-full transition-all duration-300';
    }
    
    // Reset checkmarks
    const checks = ['length-check', 'uppercase-check', 'number-check', 'special-check'];
    checks.forEach(checkId => {
      const checkElement = document.getElementById(checkId);
      if (checkElement) {
        const icon = checkElement.querySelector('svg');
        if (icon) {
          icon.innerHTML = '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';
          icon.classList.remove('text-green-500');
          icon.classList.add('text-gray-500');
        }
      }
    });
  }

  submitButton.disabled = false;
  if (loadingSpinner) loadingSpinner.classList.add('hidden');
  if (buttonText) buttonText.textContent = 'Update Password';
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  fetchUserProfile();

  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', handleProfileUpdate);
  }

  const passwordForm = document.getElementById('password-form');
  if (passwordForm) {
    passwordForm.addEventListener('submit', handlePasswordUpdate);
  }
});