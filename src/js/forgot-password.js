import { supabase } from './client.js';
import Toastify from 'toastify-js';
import 'toastify-js/src/toastify.css';

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const emailForm = document.getElementById('email-form');
  const otpForm = document.getElementById('otp-form');
  const resetPasswordForm = document.getElementById('reset-password-form');

  const emailStep = document.getElementById('email-step');
  const otpStep = document.getElementById('otp-step');
  const resetPasswordStep = document.getElementById('reset-password-step');

  const emailInput = document.getElementById('email');
  const verificationEmailEl = document.getElementById('verification-email');
  const otpInputs = otpStep.querySelectorAll('.otp-input');
  
  const emailSubmitBtn = document.getElementById('email-submit-btn');
  const otpSubmitBtn = document.getElementById('otp-submit-btn');
  const resetSubmitBtn = document.getElementById('reset-submit-btn');
  const resendOtpBtn = document.getElementById('resend-otp-btn');
  
  let userEmail = '';

  // --- Helper Functions ---
  function toggleButtonLoading(button, isLoading) {
    const btnText = button.querySelector('.btn-text');
    const btnSpinner = button.querySelector('.btn-spinner');
    button.disabled = isLoading;
    if (btnText) btnText.classList.toggle('hidden', isLoading);
    if (btnSpinner) btnSpinner.classList.toggle('hidden', !isLoading);
  }

  function showStep(stepToShow) {
    emailStep.classList.add('hidden');
    otpStep.classList.add('hidden');
    resetPasswordStep.classList.add('hidden');
    stepToShow.classList.remove('hidden');
  }
  
  // --- Step 1: Send OTP ---
  emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    toggleButtonLoading(emailSubmitBtn, true);
    userEmail = emailInput.value;

    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        // Note: Supabase sends a link, but we'll use the contained OTP
        // for a same-page verification flow.
    });

    if (error) {
      Toastify({ text: error.message, className: 'toast-error' }).showToast();
    } else {
      verificationEmailEl.textContent = userEmail;
      Toastify({ text: 'A verification code has been sent to your email.', className: 'toast-success' }).showToast();
      showStep(otpStep);
    }
    toggleButtonLoading(emailSubmitBtn, false);
  });

  // --- Step 2: Verify OTP ---
  otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    toggleButtonLoading(otpSubmitBtn, true);
    const otp = Array.from(otpInputs).map(input => input.value).join('');

    if (otp.length !== 6) {
      Toastify({ text: 'Please enter a valid 6-digit OTP.', className: 'toast-error' }).showToast();
      toggleButtonLoading(otpSubmitBtn, false);
      return;
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email: userEmail,
      token: otp,
      type: 'recovery',
    });

    if (error || !data.session) {
      Toastify({ text: error?.message || "Invalid or expired OTP.", className: 'toast-error' }).showToast();
    } else {
      // OTP is correct, user is authenticated for password reset
      Toastify({ text: 'Verification successful. Please set a new password.', className: 'toast-success' }).showToast();
      showStep(resetPasswordStep);
    }
    toggleButtonLoading(otpSubmitBtn, false);
  });
  
  // --- Step 3: Reset Password ---
  resetPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
      Toastify({ text: 'Passwords do not match.', className: 'toast-error' }).showToast();
      return;
    }
    if (newPassword.length < 6) {
        Toastify({ text: 'Password should be at least 6 characters.', className: 'toast-error' }).showToast();
        return;
    }
    
    toggleButtonLoading(resetSubmitBtn, true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      Toastify({ text: error.message, className: 'toast-error' }).showToast();
    } else {
      Toastify({ text: 'Password has been reset successfully! Redirecting to login...', className: 'toast-success' }).showToast();
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 3000);
    }
    toggleButtonLoading(resetSubmitBtn, false);
  });

  // --- Resend OTP Logic ---
  resendOtpBtn.addEventListener('click', async () => {
    toggleButtonLoading(emailSubmitBtn, true); // Visually, it's like the first step again

    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        // Same call as the first step
    });
    
    toggleButtonLoading(emailSubmitBtn, false);

    if (error) {
        Toastify({ text: `Error resending code: ${error.message}`, className: "toast-error" }).showToast();
    } else {
        Toastify({ text: "A new verification code has been sent.", className: "toast-success" }).showToast();
        // Start cooldown timer
        resendOtpBtn.disabled = true;
        let seconds = 60;
        resendOtpBtn.textContent = `Resend in ${seconds}s`;
        const interval = setInterval(() => {
            seconds--;
            resendOtpBtn.textContent = `Resend in ${seconds}s`;
            if (seconds <= 0) {
                clearInterval(interval);
                resendOtpBtn.disabled = false;
                resendOtpBtn.textContent = 'Resend Code';
            }
        }, 1000);
    }
  });

  // --- OTP Input Logic ---
  otpInputs.forEach((input, index) => {
    input.addEventListener('input', () => {
      if (input.value.length === 1 && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && input.value.length === 0 && index > 0) {
        otpInputs[index - 1].focus();
      }
    });
  });
}); 