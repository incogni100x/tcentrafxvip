import { supabase } from './client.js';
import { getCurrentUser, formatCurrency, getCurrencySymbol } from './session.js';
import Toastify from 'toastify-js';

document.addEventListener('DOMContentLoaded', async () => {
  // --- Helper Functions ---
  function toggleButtonLoading(button, isLoading) {
    if (!button) return;
    const spinner = button.querySelector('svg');
    const originalText = button.querySelector('.btn-text');
    const submittingText = button.querySelector('.submitting-text');

    button.disabled = isLoading;
    button.classList.toggle('btn-loading', isLoading);
    
    if (isLoading) {
      if (spinner) spinner.classList.remove('hidden');
      if (originalText) originalText.classList.add('hidden');
      if (submittingText) submittingText.classList.remove('hidden');
    } else {
      if (spinner) spinner.classList.add('hidden');
      if (originalText) originalText.classList.remove('hidden');
      if (submittingText) submittingText.classList.add('hidden');
    }
  }

  // --- DOM Element Selectors ---
  const userInitialsEl = document.getElementById('user-initials');
  const depositForm = document.getElementById('deposit-form');
  const confirmationScreen = document.getElementById('confirmation-screen');
  const generateDepositBtn = document.getElementById('generate-deposit');
  const cryptoOptions = document.getElementById('crypto-options');
  const bankOptions = document.getElementById('bank-options');
  const bankAmountInput = document.getElementById('bank-amount');
  const cryptoAmountInput = document.getElementById('crypto-amount');
  const cryptoCurrencySelect = document.getElementById('crypto-currency');
  
  // --- Overlay elements ---
  const depositOverlay = document.getElementById('deposit-overlay');
  const closeOverlayBtn = document.getElementById('close-overlay');
  const overlayDepositCompleteBtn = document.getElementById('overlay-deposit-complete');
  const overlayCopyAddressBtn = document.getElementById('overlay-copy-address');

  // --- State Management ---
  let user = null;
  let depositMethods = [];

  // --- Initialization ---
  async function initializePage() {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      window.location.href = '/login.html';
      return;
    }
    user = currentUser;

    // Display user initials
    const fullName = user.user_metadata?.full_name || 'User';
    const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase();
    if (userInitialsEl) userInitialsEl.textContent = initials;
    
    await loadDepositMethods();
    await updateCurrencyDisplay();
    setupEventListeners();
  }

  // --- Currency Display Updates ---
  async function updateCurrencyDisplay() {
    const minDeposit = 10;
    const minDepositText = await formatCurrency(minDeposit);
    const currencySymbol = await getCurrencySymbol();
    
    // Update crypto currency symbol
    const cryptoCurrencySymbol = document.getElementById('crypto-currency-symbol');
    if (cryptoCurrencySymbol) {
      cryptoCurrencySymbol.textContent = currencySymbol;
    }
    
    // Update minimum deposit text
    const minDepositTextEl = document.getElementById('min-deposit-text');
    if (minDepositTextEl) {
      minDepositTextEl.textContent = `Minimum deposit: ${minDepositText}`;
    }
    
    // Update minimum amount warning
    const minAmountWarning = document.getElementById('min-amount-warning');
    if (minAmountWarning) {
      minAmountWarning.textContent = `Minimum deposit: ${minDepositText}`;
    }
    
    // Update bank transfer input symbol
    const bankInputSymbol = document.getElementById('bank-currency-symbol');
    if (bankInputSymbol) {
      bankInputSymbol.textContent = currencySymbol;
    }
    
    // Update bank transfer minimum deposit text
    const bankMinDepositText = document.getElementById('bank-min-deposit-text');
    if (bankMinDepositText) {
      bankMinDepositText.textContent = `Minimum deposit: ${minDepositText}`;
    }
    
    // Update bank important information minimum deposit
    const bankImportantMinDeposit = document.getElementById('bank-important-min-deposit');
    if (bankImportantMinDeposit) {
      bankImportantMinDeposit.textContent = `Minimum deposit: ${minDepositText}`;
    }
  }

  // --- Data Fetching ---
  async function loadDepositMethods() {
    // Check session storage for cached data
    const cachedData = sessionStorage.getItem('depositMethods');
    const cacheTimestamp = sessionStorage.getItem('depositMethodsTimestamp');
    const FIVE_MINUTES = 5 * 60 * 1000;

    if (cachedData && cacheTimestamp && (Date.now() - Number(cacheTimestamp) < FIVE_MINUTES)) {
      depositMethods = JSON.parse(cachedData);
      populateCryptoDropdown();
      return;
    }

    try {
      const { data, error } = await supabase
        .from('deposit_methods')
        .select('*')
        .eq('is_active', true);
      
      if (error) throw error;
      depositMethods = data;
      
      // Cache the data
      sessionStorage.setItem('depositMethods', JSON.stringify(data));
      sessionStorage.setItem('depositMethodsTimestamp', Date.now().toString());

      populateCryptoDropdown();
    } catch (error) {
      Toastify({ text: `Error loading deposit methods: ${error.message}`, className: 'toast-error', gravity: "top", position: "center" }).showToast();
    }
  }

  // --- UI Update Functions ---
  function handleCryptoChange() {
    const selectedOption = cryptoCurrencySelect.options[cryptoCurrencySelect.selectedIndex];
    const warningEl = document.getElementById('send-only-warning');

    if (selectedOption && selectedOption.value) {
      const selectedMethod = depositMethods.find(m => m.id == selectedOption.value);
      if (selectedMethod && warningEl) {
        warningEl.textContent = `Send only ${selectedMethod.name} to this address`;
      }
    }
    validateAmount();
  }

  // --- UI Population ---
  function populateCryptoDropdown() {
    const cryptoMethods = depositMethods.filter(m => m.type === 'crypto' && m.details);
    cryptoCurrencySelect.innerHTML = ''; // Clear existing options
    if (cryptoMethods.length > 0) {
      cryptoMethods.forEach(method => {
        const option = document.createElement('option');
        option.value = method.id;
        option.textContent = method.name;
        cryptoCurrencySelect.appendChild(option);
      });
    } else {
        const option = document.createElement('option');
        option.textContent = 'No crypto options available';
        option.disabled = true;
        cryptoCurrencySelect.appendChild(option);
    }
    handleCryptoChange();
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    document.querySelectorAll('input[name="deposit_method_option"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const isCrypto = e.target.value === 'crypto';
        cryptoOptions.classList.toggle('hidden', !isCrypto);
        bankOptions.classList.toggle('hidden', isCrypto);
        generateDepositBtn.querySelector('.btn-text').textContent = isCrypto ? 'Get Deposit Address' : 'Generate Deposit';
        validateAmount();
      });
    });

    [bankAmountInput, cryptoAmountInput].forEach(input => {
      input.addEventListener('input', validateAmount);
    });
    
    cryptoCurrencySelect.addEventListener('change', handleCryptoChange);

    generateDepositBtn.addEventListener('click', handleDepositSubmit);
    
    // Overlay listeners
    closeOverlayBtn.addEventListener('click', () => depositOverlay.classList.add('hidden'));
    overlayDepositCompleteBtn.addEventListener('click', handleCryptoDepositCompletion);
    overlayCopyAddressBtn.addEventListener('click', copyWalletAddress);
  }

  function validateAmount() {
    const selectedMethodType = document.querySelector('input[name="deposit_method_option"]:checked').value;
    const isCrypto = selectedMethodType === 'crypto';
    const minDeposit = 10;
    let isAmountValid = false;

    if (isCrypto) {
      const cryptoAmount = parseFloat(cryptoAmountInput.value);
      isAmountValid = cryptoAmount && cryptoAmount >= minDeposit;
      const method_id = cryptoCurrencySelect.value;
      const cryptoMethodExists = depositMethods.some(m => m.id == method_id && m.type === 'crypto');
      generateDepositBtn.disabled = !(isAmountValid && cryptoMethodExists);
    } else { // Bank Transfer
      const bankAmount = parseFloat(bankAmountInput.value);
      isAmountValid = bankAmount && bankAmount >= minDeposit;
      generateDepositBtn.disabled = !isAmountValid;
    }
  }

  // --- Address Copy Function ---
  function copyWalletAddress() {
    const walletAddressInput = document.getElementById('overlay-wallet-address');
    navigator.clipboard.writeText(walletAddressInput.value).then(() => {
        Toastify({ text: "Address copied to clipboard!", className: 'toast-success', gravity: "top", position: "center" }).showToast();
    }).catch(err => {
        Toastify({ text: "Failed to copy address.", className: 'toast-error', gravity: "top", position: "center" }).showToast();
        console.error('Failed to copy text: ', err);
    });
  }

  // --- Main Logic ---
  async function handleDepositSubmit(e) {
    e.preventDefault();
    toggleButtonLoading(generateDepositBtn, true);

    const isCrypto = document.getElementById('deposit-method-crypto').checked;
    const amount = parseFloat(isCrypto ? cryptoAmountInput.value : bankAmountInput.value);

    // --- Crypto Flow ---
    if (isCrypto) {
      const method_id = cryptoCurrencySelect.value;
      const selectedMethod = depositMethods.find(m => m.id == method_id);
      
      if (!selectedMethod) {
        Toastify({ text: "Please select a valid cryptocurrency.", className: 'toast-error', gravity: "top", position: "center" }).showToast();
        toggleButtonLoading(generateDepositBtn, false);
        return;
      }
      
      await showCryptoOverlay(selectedMethod, amount, generateDepositBtn);
      return;
    }

    // --- Bank Transfer Flow ---
    const bankMethod = depositMethods.find(m => m.type === 'bank transfer');
    if (!bankMethod) {
      Toastify({ text: "Bank transfer method not available.", className: 'toast-error', gravity: "top", position: "center" }).showToast();
      toggleButtonLoading(generateDepositBtn, false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('submit-deposit', {
        body: { method_id: bankMethod.id, amount, deposit_type: 'bank transfer' },
      });

      if (error) throw error;
      if(data.error) throw new Error(data.error);

      await showConfirmationScreen(data.deposit_id, bankMethod.name, amount, 'bank transfer');
      
      bankAmountInput.value = '';
      cryptoAmountInput.value = '';
      validateAmount();
      
    } catch (error) {
       Toastify({ text: `Deposit submission failed: ${error.message}`, className: 'toast-error', gravity: "top", position: "center" }).showToast();
    } finally {
      toggleButtonLoading(generateDepositBtn, false);
    }
  }

  async function handleCryptoDepositCompletion() {
      const method_id = depositOverlay.dataset.methodId;
      const amount = parseFloat(depositOverlay.dataset.amount);
      const methodName = depositOverlay.dataset.methodName;

      if (!method_id || !amount || !methodName) {
          Toastify({ text: "An error occurred. Please try again.", className: 'toast-error', gravity: "top", position: "center" }).showToast();
          return;
      }

      toggleButtonLoading(overlayDepositCompleteBtn, true);

      try {
          const { data, error } = await supabase.functions.invoke('submit-deposit', {
              body: { method_id: Number(method_id), amount, deposit_type: 'crypto' },
          });

          if (error) throw error;
          if (data.error) throw new Error(data.error);

          depositOverlay.classList.add('hidden');
          await showConfirmationScreen(data.deposit_id, methodName, amount, 'crypto');
          
          bankAmountInput.value = '';
          cryptoAmountInput.value = '';
          validateAmount();

      } catch (error) {
          Toastify({ text: `Deposit submission failed: ${error.message}`, className: 'toast-error', gravity: "top", position: "center" }).showToast();
      } finally {
          toggleButtonLoading(overlayDepositCompleteBtn, false);
      }
  }

  async function showCryptoOverlay(method, amount, buttonToToggle) {
    // Store data on the overlay for the completion step
    depositOverlay.dataset.methodId = method.id;
    depositOverlay.dataset.amount = amount;
    depositOverlay.dataset.methodName = method.name;

    document.getElementById('overlay-title').textContent = `Deposit ${method.name}`;
    
    const walletAddressInput = document.getElementById('overlay-wallet-address');
    walletAddressInput.value = method.details;

    const qrCodeImage = document.getElementById('overlay-qr-code');
    const qrSpinner = document.getElementById('qr-spinner');

    // Show spinner and hide image
    qrSpinner.classList.remove('hidden');
    qrCodeImage.classList.add('hidden');
    qrCodeImage.src = '';

    // Show the overlay now
    depositOverlay.classList.remove('hidden');

    qrCodeImage.onload = () => {
        qrSpinner.classList.add('hidden');
        qrCodeImage.classList.remove('hidden');
        if (buttonToToggle) toggleButtonLoading(buttonToToggle, false);
    };
    qrCodeImage.onerror = () => {
        qrSpinner.classList.add('hidden');
        const container = document.getElementById('qr-code-container');
        container.innerHTML = `<span class="text-xs text-center p-2 text-red-400">Could not load QR code.</span>`;
        console.error("QR Code image failed to load.");
        if (buttonToToggle) toggleButtonLoading(buttonToToggle, false);
    };

    if (method.details) {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${encodeURIComponent(method.details)}&bgcolor=374151&color=ffffff&qzone=1`;
      qrCodeImage.src = qrApiUrl;
    } else {
      qrSpinner.classList.add('hidden');
      const container = document.getElementById('qr-code-container');
      container.innerHTML = `<span class="text-xs text-center p-2">No address available.</span>`;
      console.error('No deposit address provided for QR code generation.');
    }
    
    const minDeposit = 10;
    const minDepositText = await formatCurrency(minDeposit);
    document.getElementById('overlay-instructions').textContent = `Send at least ${minDepositText} of ${method.name} to this address.`;
    document.getElementById('overlay-min-amount').textContent = `Minimum deposit: ${minDepositText}`;
    document.getElementById('overlay-send-only').textContent = `Send only ${method.name} to this address`;
  }
  
  async function showConfirmationScreen(depositId, methodName, amount, depositType) {
    depositForm.classList.add('hidden');
    confirmationScreen.classList.remove('hidden');
    
    document.getElementById('reference-id').textContent = depositId.slice(0, 12).toUpperCase();
    document.getElementById('deposit-method-confirm').textContent = methodName;
    document.getElementById('deposit-amount').textContent = await formatCurrency(amount);
    
    const bankInfo = document.getElementById('bank-contact-info');
    if (depositType === 'bank transfer') {
      bankInfo.classList.remove('hidden');
    } else {
      bankInfo.classList.add('hidden');
    }

    // Reset button
    const newDepositBtn = document.getElementById('new-deposit');
    newDepositBtn.addEventListener('click', () => {
        confirmationScreen.classList.add('hidden');
        depositForm.classList.remove('hidden');
    }, { once: true });

    const goToDashboardBtn = document.getElementById('go-to-dashboard');
    goToDashboardBtn.addEventListener('click', () => {
        window.location.href = '/dashboard.html';
    });
  }

  // --- Execution ---
  initializePage();
});