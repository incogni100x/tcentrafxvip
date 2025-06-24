import { buyCrypto } from './buy-crypto-action.js';
import { sellCrypto } from './sell-crypto-action.js';
import { getCurrentUser } from './session.js';
import Toastify from 'toastify-js';

document.addEventListener('DOMContentLoaded', async () => {
  let user = null;

  // --- Initialization ---
  async function initializePage() {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      window.location.href = '/login.html';
      return;
    }
    user = currentUser;

    // Display user initials
    const userInitialsEl = document.getElementById('user-initials');
    const fullName = user.user_metadata?.full_name || 'User';
    const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase();
    if (userInitialsEl) userInitialsEl.textContent = initials;
  }


  // Mobile sidebar functionality
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileSidebar = document.getElementById('mobile-sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  if (mobileMenuBtn) {
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

    // Close sidebar on window resize
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 1024) {
        closeSidebar();
      }
    });
  }


  // Tab functionality
  const tabButtons = document.querySelectorAll('[id^="tab-"]');
  const tableContainers = document.querySelectorAll('[id$="-table-container"]');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active state from all tabs
      tabButtons.forEach(tab => {
        tab.classList.remove('border-blue-400', 'text-blue-400');
        tab.classList.add('border-transparent', 'text-gray-400');
      });

      // Add active state to clicked tab
      button.classList.remove('border-transparent', 'text-gray-400');
      button.classList.add('border-blue-400', 'text-blue-400');

      // Hide all table containers
      tableContainers.forEach(container => {
        container.classList.add('hidden');
      });

      // Show corresponding table container
      const tabId = button.id.replace('tab-', '');
      const container = document.getElementById(`${tabId}-table-container`);
      if (container) {
        container.classList.remove('hidden');
      }
    });
  });

  // Modal functionality
  const modal = document.getElementById('transaction-modal');
  const processingOverlay = document.getElementById('processing-overlay');
  const successOverlay = document.getElementById('success-overlay');
  const closeModal = document.getElementById('close-modal');
  const cancelTransaction = document.getElementById('cancel-transaction');
  const transactionForm = document.getElementById('transaction-form');
  const amountInput = document.getElementById('amount-input');
  const unitsInput = document.getElementById('units-input');

  // Improved Buy/Sell button event listeners
  document.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (button && (button.textContent.trim() === 'Buy' || button.textContent.trim() === 'Sell')) {
      e.preventDefault();
      
      const fundCard = button.closest('.fund-card');
      if (!fundCard) return;

      let fundName = 'Unknown Fund';
      let fundCode = 'N/A';
      let fundPrice = '$0.00';
      let fundInterest = '0%';
      let iconSvg = '';
      
      const nameElement = fundCard.querySelector('h3.font-semibold');
      const codeElement = fundCard.querySelector('.text-xs.text-gray-400');
      const priceElement = fundCard.querySelector('.text-right .text-lg.font-semibold');
      const interestElement = fundCard.querySelector('.text-sm.font-semibold.text-green-400');
      const iconElement = fundCard.querySelector('.w-10.h-10.rounded-full svg');

      
      if (nameElement) fundName = nameElement.textContent.trim();
      if (codeElement) fundCode = codeElement.textContent.trim();
      if (priceElement) fundPrice = priceElement.textContent.trim();
      if (interestElement) {
        fundInterest = interestElement.textContent.trim();
      }
       if (iconElement) {
        iconSvg = iconElement.outerHTML;
      }
      
      document.getElementById('fund-name').textContent = fundName;
      document.getElementById('fund-code').textContent = fundCode;
      document.getElementById('fund-price').textContent = fundPrice;
      document.getElementById('fund-interest').textContent = fundInterest;
      
      const unitsInputEl = document.getElementById('units-input');
      if (unitsInputEl) {
        unitsInputEl.placeholder = `Enter ${fundCode} units`;
      }

      const modalIconContainer = document.getElementById('modal-fund-icon');
      if (modalIconContainer) {
        modalIconContainer.innerHTML = iconSvg;
      }
      
      const transactionType = button.textContent.trim().toLowerCase();
      document.getElementById('modal-title').textContent = `${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)} Crypto`;
      
      const radioButton = document.querySelector(`input[name="transaction-type"][value="${transactionType}"]`);
      if (radioButton) radioButton.checked = true;
      
      updateCalculations();
      modal.classList.remove('hidden');
    }
  });

  if (modal) {
    closeModal.addEventListener('click', () => modal.classList.add('hidden'));
    cancelTransaction.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  }

  // Investment type toggle
  const investmentTypeRadios = document.querySelectorAll('input[name="investment-type"]');
  const amountContainer = document.getElementById('amount-input-container');
  const unitsContainer = document.getElementById('units-input-container');

  investmentTypeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'amount') {
        amountContainer.classList.remove('hidden');
        unitsContainer.classList.add('hidden');
      } else {
        amountContainer.classList.add('hidden');
        unitsContainer.classList.remove('hidden');
      }
      updateCalculations();
    });
  });

  // Form submission with processing overlay
  if (transactionForm) {
    transactionForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const transactionType = document.querySelector('input[name="transaction-type"]:checked').value;
      const processingMessage = document.getElementById('processing-message');
      
      if (processingMessage) {
        if (transactionType === 'buy') {
          processingMessage.textContent = 'Please wait while we process your Buy Crypto transaction...';
        } else {
          processingMessage.textContent = 'Please wait while we process your Sell Crypto transaction...';
        }
      }
      
      processingOverlay.classList.remove('hidden');

      const cryptoSymbol = document.getElementById('fund-code').textContent.trim();
      const investmentType = document.querySelector('input[name="investment-type"]:checked').value;
      const priceText = document.getElementById('fund-price').textContent;
      const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;

      let units, result;

      if (investmentType === 'amount') {
        const amount = parseFloat(amountInput.value) || 0;
        units = (price > 0) ? amount / price : 0;
      } else {
        units = parseFloat(unitsInput.value) || 0;
      }

      if (!cryptoSymbol || cryptoSymbol === 'N/A' || !units || units <= 0) {
        Toastify({ text: 'Invalid input. Please check the crypto and amount.', className: 'toast-error', gravity: "top", position: "center" }).showToast();
        processingOverlay.classList.add('hidden');
        return;
      }

      if (transactionType === 'buy') {
        result = await buyCrypto(cryptoSymbol, units);
      } else {
        result = await sellCrypto(cryptoSymbol, units);
      }
      
      processingOverlay.classList.add('hidden');
      
      if (result.success) {
        modal.classList.add('hidden');
        transactionForm.reset();

        // Populate and show success modal
        const unitsFormatted = `${units.toFixed(4)} ${cryptoSymbol}`;
        if (transactionType === 'buy') {
          document.getElementById('success-title').textContent = 'Purchase Successful!';
          document.getElementById('success-message').innerHTML = `You have successfully purchased <strong class="text-white">${unitsFormatted}</strong>.`;
          document.getElementById('summary-amount-label').textContent = 'Amount Purchased:';
          document.getElementById('summary-price-label').textContent = 'Price per Token:';
          document.getElementById('summary-cost-label').textContent = 'Total Cost:';
          document.getElementById('summary-amount').textContent = unitsFormatted;
          document.getElementById('summary-price').textContent = `$${result.purchase_price.toFixed(2)}`;
          document.getElementById('summary-cost').textContent = `$${result.fiat_spent.toFixed(2)}`;
        } else { // sell
          document.getElementById('success-title').textContent = 'Sale Successful!';
          document.getElementById('success-message').innerHTML = `You have successfully sold <strong class="text-white">${unitsFormatted}</strong>.`;
          document.getElementById('summary-amount-label').textContent = 'Amount Sold:';
          document.getElementById('summary-price-label').textContent = 'Price per Token:';
          document.getElementById('summary-cost-label').textContent = 'Total Received:';
          document.getElementById('summary-amount').textContent = unitsFormatted;
          document.getElementById('summary-price').textContent = `$${result.sell_price.toFixed(2)}`;
          document.getElementById('summary-cost').textContent = `$${result.fiat_received.toFixed(2)}`;
        }
        
        successOverlay.classList.remove('hidden');

      } else {
        Toastify({
          text: result.message,
          duration: 3000,
          close: true,
          gravity: "top",
          position: "center",
          stopOnFocus: true,
          style: {
            background: "linear-gradient(to right, #e74c3c, #c0392b)",
            borderRadius: "8px",
            boxShadow: "0 4px 12px 0 rgba(0,0,0,0.2)"
          }
        }).showToast();
      }
    });

    const successDoneBtn = document.getElementById('success-done-btn');
    if (successDoneBtn) {
      successDoneBtn.addEventListener('click', () => {
        successOverlay.classList.add('hidden');
        window.location.reload();
      });
    }
  }

  // Real-time calculation
  const estimatedUnits = document.getElementById('estimated-units');
  const totalAmount = document.getElementById('total-amount');
  const estimatedUnitsLabel = document.getElementById('estimated-units-label');
  const totalAmountLabel = document.getElementById('total-amount-label');
  const transactionTypeRadios = document.querySelectorAll('input[name="transaction-type"]');

  function updateCalculations() {
    const priceText = document.getElementById('fund-price').textContent;
    const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
    const cryptoSymbol = document.getElementById('fund-code').textContent.trim();
    
    const investmentType = document.querySelector('input[name="investment-type"]:checked').value;
    const transactionType = document.querySelector('input[name="transaction-type"]:checked').value;
    
    let units = 0;
    let amount = 0;

    if (investmentType === 'amount') {
      const amount = parseFloat(amountInput.value) || 0;
      units = (price > 0) ? amount / price : 0;
    } else {
      units = parseFloat(unitsInput.value) || 0;
      amount = units * price;
    }

    if (estimatedUnits) estimatedUnits.textContent = `${units.toFixed(4)} ${cryptoSymbol}`;
    if (totalAmount) totalAmount.textContent = `$${amount.toFixed(2)}`;
    
    if(transactionType === 'buy') {
      if (estimatedUnitsLabel) estimatedUnitsLabel.textContent = 'You will get:';
      if (totalAmountLabel) totalAmountLabel.textContent = 'You will spend:';
    } else { // sell
      if (estimatedUnitsLabel) estimatedUnitsLabel.textContent = 'You will sell:';
      if (totalAmountLabel) totalAmountLabel.textContent = 'You will receive:';
    }
  }
  
  if (amountInput) amountInput.addEventListener('input', updateCalculations);
  if (unitsInput) unitsInput.addEventListener('input', updateCalculations);
  transactionTypeRadios.forEach(radio => radio.addEventListener('change', updateCalculations));
  
  await initializePage();
}); 