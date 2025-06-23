import { supabase } from './client.js';
import Toastify from 'toastify-js';
import './main.js';
import '../styles/input.css';

document.addEventListener('DOMContentLoaded', () => {
  const emailStep = document.getElementById('email-step');
  const otpStep = document.getElementById('otp-step');
  const loginForm = document.getElementById('login-form');
  const otpForm = document.getElementById('otp-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const verificationEmail = document.getElementById('verification-email');
  const backToEmailBtn = document.getElementById('back-to-email');
  const togglePassword = document.getElementById('toggle-password');
  const eyeOpen = document.getElementById('eye-open');
  const eyeClosed = document.getElementById('eye-closed');
  
  let userEmail = '';

  function toggleButtonLoading(button, isLoading) {
    const btnText = button.querySelector('.btn-text');
    const btnSpinner = button.querySelector('.btn-spinner');
    button.disabled = isLoading;
    if (btnText) btnText.classList.toggle('hidden', isLoading);
    if (btnSpinner) btnSpinner.classList.toggle('hidden', !isLoading);
  }

  function showStep(stepToShow) {
    emailStep.classList.toggle('hidden', stepToShow !== 'email');
    otpStep.classList.toggle('hidden', stepToShow !== 'otp');
  }

  if (togglePassword) {
    togglePassword.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      eyeOpen.classList.toggle('hidden', !isPassword);
      eyeClosed.classList.toggle('hidden', isPassword);
    });
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('login-submit-btn');
    toggleButtonLoading(submitBtn, true);

    userEmail = emailInput.value;
    const password = passwordInput.value;

    try {
      // Step 1: Verify password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: password,
      });

      if (signInError) throw signInError;
      
      // Step 2: Send OTP for 2FA
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: userEmail,
      });

      if (otpError) throw otpError;

      verificationEmail.textContent = userEmail;
      showStep('otp');
      Toastify({ text: 'A verification code has been sent to your email.', className: 'toast-success' }).showToast();
    } catch (error) {
      Toastify({ text: error.message, className: 'toast-error' }).showToast();
    } finally {
      toggleButtonLoading(submitBtn, false);
    }
  });
  
  otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('otp-submit-btn');
    toggleButtonLoading(submitBtn, true);

    const otpInputs = otpStep.querySelectorAll('.otp-input');
    const otp = Array.from(otpInputs).map(input => input.value).join('');

    if (otp.length !== 6) {
      Toastify({ text: 'Please enter a valid 6-digit OTP.', className: 'toast-error' }).showToast();
      toggleButtonLoading(submitBtn, false);
      return;
    }

    try {
      const { data: { session }, error } = await supabase.auth.verifyOtp({
        email: userEmail,
        token: otp,
        type: 'email'
      });
      
      if (error) throw error;
      if (!session) throw new Error("Couldn't verify OTP. Please try again.");

      window.location.href = '/dashboard.html';
    } catch (error) {
      Toastify({ text: error.message, className: 'toast-error' }).showToast();
    } finally {
      toggleButtonLoading(submitBtn, false);
    }
  });

  backToEmailBtn.addEventListener('click', () => {
    showStep('email');
    // Clear password field when going back
    passwordInput.value = '';
  });

  const otpInputs = document.querySelectorAll('.otp-input');
  if (otpInputs.length > 0) {
    otpInputs[0].addEventListener('paste', (e) => {
      e.preventDefault();
      const pastedText = (e.clipboardData || window.clipboardData).getData('text');
      if (pastedText.length === 6 && /^\d{6}$/.test(pastedText)) {
        otpInputs.forEach((input, index) => input.value = pastedText[index]);
        document.getElementById('otp-submit-btn').focus();
        document.getElementById('otp-submit-btn').click();
      }
    });
  }

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
