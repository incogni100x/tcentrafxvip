import { supabase } from './client.js';
import Toastify from 'toastify-js';
import './main.js';
import '../styles/input.css';

document.addEventListener('DOMContentLoaded', () => {
  const steps = document.querySelectorAll('.step-content');
  const stepIndicators = document.querySelectorAll('[data-step]');
  const stepLines = document.querySelectorAll('[data-step-line]');

  let currentStep = 1;
  let userEmail = '';

  function toggleButtonLoading(button, isLoading) {
    const btnText = button.querySelector('.btn-text');
    const btnSpinner = button.querySelector('.btn-spinner');

    if (isLoading) {
      button.disabled = true;
      btnText.classList.add('hidden');
      btnSpinner.classList.remove('hidden');
    } else {
      button.disabled = false;
      btnText.classList.remove('hidden');
      btnSpinner.classList.add('hidden');
    }
  }

  function updateStep(targetStep) {
    steps.forEach(step => step.classList.add('hidden'));
    document.getElementById(`step-${targetStep}`).classList.remove('hidden');

    stepIndicators.forEach(indicator => {
      const step = parseInt(indicator.getAttribute('data-step'), 10);
      const circle = indicator.querySelector('div');
      const text = indicator.querySelector('p');

      if (step < targetStep) {
        circle.classList.remove('bg-blue-600', 'bg-gray-700');
        circle.classList.add('bg-green-600');
        circle.innerHTML = `<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`;
        text.classList.remove('text-gray-500');
        text.classList.add('text-green-400');
      } else if (step === targetStep) {
        circle.classList.remove('bg-gray-700', 'bg-green-600');
        circle.classList.add('bg-blue-600');
        text.classList.remove('text-gray-500', 'text-green-400');
        text.classList.add('text-blue-400');
        circle.innerHTML = step;
      } else {
        circle.classList.remove('bg-blue-600', 'bg-green-600');
        circle.classList.add('bg-gray-700');
        text.classList.remove('text-blue-400', 'text-green-400');
        text.classList.add('text-gray-500');
        circle.innerHTML = step;
      }
    });

    stepLines.forEach(line => {
      const lineNum = parseInt(line.getAttribute('data-step-line'), 10);
      if (lineNum < targetStep) {
        line.classList.remove('bg-gray-600', 'bg-gray-700');
        line.classList.add('bg-green-600');
      } else {
        line.classList.remove('bg-green-600');
        line.classList.add('bg-gray-600');
      }
    });

    currentStep = targetStep;
  }

  document.getElementById('details-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('details-submit-btn');
    toggleButtonLoading(submitBtn, true);

    const form = e.target;
    const requiredInputs = Array.from(form.querySelectorAll('[required]'));
    let allFieldsFilled = true;

    requiredInputs.forEach(input => {
      if (input.type === 'checkbox') {
        if (!input.checked) {
          allFieldsFilled = false;
        }
      } else {
        if (!input.value.trim()) {
          allFieldsFilled = false;
        }
      }
    });

    if (!allFieldsFilled) {
      Toastify({ text: "Please fill out all required fields.", className: "toast-error" }).showToast();
      toggleButtonLoading(submitBtn, false);
      return;
    }

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm_password').value;
    const firstName = document.getElementById('first_name').value;
    const lastName = document.getElementById('last_name').value;
    const phoneNumber = document.getElementById('phone_number').value;

    if (password !== confirmPassword) {
      Toastify({ text: "Passwords do not match!", className: "toast-error" }).showToast();
      toggleButtonLoading(submitBtn, false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: `${firstName} ${lastName}`,
            phone_number: phoneNumber
          }
        }
      });

      if (error) {
        throw error;
      } else {
        userEmail = email;
        document.getElementById('verification-email').textContent = userEmail;
        updateStep(2);
        Toastify({ text: "A verification code has been sent to your email.", className: "toast-success" }).showToast();
      }
    } catch (error) {
      Toastify({ text: error.message, className: "toast-error" }).showToast();
    } finally {
      toggleButtonLoading(submitBtn, false);
    }
  });

  document.getElementById('otp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('otp-submit-btn');
    toggleButtonLoading(submitBtn, true);

    const otpInputs = document.querySelectorAll('.otp-input');
    const otp = Array.from(otpInputs).map(input => input.value).join('');

    if (otp.length !== 6) {
      Toastify({ text: "Please enter a valid 6-digit OTP.", className: "toast-error" }).showToast();
      toggleButtonLoading(submitBtn, false);
      return;
    }

    try {
      const { data: { user, session }, error } = await supabase.auth.verifyOtp({
        email: userEmail,
        token: otp,
        type: 'signup'
      });

      if (error) {
        throw error;
      }
      if (!session) {
        throw new Error("Could not verify OTP. Please try again.");
      }
      
      updateStep(3);
    } catch (error) {
      Toastify({ text: error.message, className: "toast-error" }).showToast();
    } finally {
      toggleButtonLoading(submitBtn, false);
    }
  });

  const referralForm = document.getElementById('referral-form');
  referralForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('referral-submit-btn');
    toggleButtonLoading(submitBtn, true);

    const referralCode = document.getElementById('referral_code').value;
    const referralError = document.getElementById('referral-error');
    referralError.classList.add('hidden');

    if (!referralCode.trim()) {
      Toastify({ text: "A referral code is required.", className: "toast-error" }).showToast();
      toggleButtonLoading(submitBtn, false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('User not authenticated.');

      const { error } = await supabase.functions.invoke('submit-referral-code', {
        body: { referral_code: referralCode },
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      updateStep(4);
    } catch (error) {
      referralError.textContent = error.message || 'Invalid referral code.';
      referralError.classList.remove('hidden');
    } finally {
      toggleButtonLoading(submitBtn, false);
    }
  });

  document.getElementById('documents-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('documents-submit-btn');
    toggleButtonLoading(submitBtn, true);

    const doc1 = document.getElementById('document1').files[0];
    const doc2 = document.getElementById('document2').files[0];
    const country = document.getElementById('country').value;

    if (!doc1 || !doc2 || !country) {
      Toastify({ text: "Please upload both documents and select a country.", className: "toast-error" }).showToast();
      toggleButtonLoading(submitBtn, false);
      return;
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session || !session.user) throw new Error('User not authenticated.');
      const user = session.user;

      // 1. Upload files
      const doc1Path = `${user.id}/document1_${Date.now()}`;
      const doc2Path = `${user.id}/document2_${Date.now()}`;

      const { error: uploadError1 } = await supabase.storage.from('documents').upload(doc1Path, doc1);
      if (uploadError1) throw uploadError1;

      const { error: uploadError2 } = await supabase.storage.from('documents').upload(doc2Path, doc2);
      if (uploadError2) throw uploadError2;

      // 2. Get public URLs
      const { data: doc1URLData } = supabase.storage.from('documents').getPublicUrl(doc1Path);
      const { data: doc2URLData } = supabase.storage.from('documents').getPublicUrl(doc2Path);

      // 3. Call Edge Function
      const { error: kycError } = await supabase.functions.invoke('submit-kyc', {
        body: {
          document_url_1: doc1URLData.publicUrl,
          document_url_2: doc2URLData.publicUrl,
          country: country,
        },
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (kycError) throw kycError;

      updateStep(5);
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 3000);
    } catch (error) {
      Toastify({ text: `Error: ${error.message}`, className: "toast-error" }).showToast();
    } finally {
      toggleButtonLoading(submitBtn, false);
    }
  });

  document.getElementById('resend-otp').addEventListener('click', async () => {
    const resendBtn = document.getElementById('resend-otp');
    
    try {
      // Disable button to prevent multiple clicks
      resendBtn.disabled = true;
      resendBtn.classList.add('text-gray-500', 'cursor-not-allowed');
      resendBtn.textContent = 'Sending...';

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
      });

      if (error) throw error;

      Toastify({ text: "A new verification code has been sent.", className: "toast-success" }).showToast();

      // Cooldown timer
      let seconds = 60;
      resendBtn.textContent = `Resend in ${seconds}s`;

      const interval = setInterval(() => {
        seconds--;
        resendBtn.textContent = `Resend in ${seconds}s`;
        if (seconds <= 0) {
          clearInterval(interval);
          resendBtn.disabled = false;
          resendBtn.classList.remove('text-gray-500', 'cursor-not-allowed');
          resendBtn.textContent = 'Resend Code';
        }
      }, 1000);

    } catch (error) {
      Toastify({ text: `Error resending code: ${error.message}`, className: "toast-error" }).showToast();
      resendBtn.disabled = false;
      resendBtn.classList.remove('text-gray-500', 'cursor-not-allowed');
      resendBtn.textContent = 'Resend Code';
    }
  });

  const otpInputs = document.querySelectorAll('.otp-input');

  // Handle pasting OTP
  if (otpInputs.length > 0) {
    otpInputs[0].addEventListener('paste', (e) => {
      e.preventDefault();
      const pastedText = (e.clipboardData || window.clipboardData).getData('text');
      const otpSubmitBtn = document.getElementById('otp-submit-btn');

      if (pastedText.length === 6 && /^\d{6}$/.test(pastedText)) {
        otpInputs.forEach((input, index) => {
          input.value = pastedText[index];
        });
        otpSubmitBtn.focus(); // Move focus to the button
        // Automatically submit the form
        otpSubmitBtn.click();
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

  // Password visibility toggle logic
  function setupPasswordToggle(toggleBtnId, passwordInputId, openIconId, closedIconId) {
    const toggleButton = document.getElementById(toggleBtnId);
    const passwordInput = document.getElementById(passwordInputId);
    const openIcon = document.getElementById(openIconId);
    const closedIcon = document.getElementById(closedIconId);

    if (toggleButton) {
      toggleButton.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        openIcon.classList.toggle('hidden', isPassword);
        closedIcon.classList.toggle('hidden', !isPassword);
      });
    }
  }

  setupPasswordToggle('toggle-password', 'password', 'eye-open', 'eye-closed');
  setupPasswordToggle('toggle-confirm-password', 'confirm_password', 'confirm-eye-open', 'confirm-eye-closed');
});
