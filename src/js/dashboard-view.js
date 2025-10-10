import { supabase } from './client.js';
import Toastify from 'toastify-js';

let userCurrency = 'USD';

// Helper function to format currency with user's preferred currency
function formatCurrency(value, currencyCode = userCurrency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(value || 0);
}

// --- RENDER DATA FUNCTIONS ---

function renderCashBalanceCard(balance) {
  const container = document.getElementById('cash-balance-card');
  if (!container) return;
  container.innerHTML = `
    <div class="flex items-center gap-3 mb-3">
      <div class="w-10 h-10 lg:w-8 lg:h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 lg:w-4 lg:h-4 text-green-600"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
      </div>
      <div class="flex-1">
        <p class="text-sm text-gray-400">Cash Balance</p>
        <p class="text-2xl lg:text-xl font-bold text-white">${formatCurrency(balance)}</p>
      </div>
    </div>
    <p class="text-xs text-gray-400">Available for trading</p>
  `;
}

function renderCryptoValueCard(value) {
  const container = document.getElementById('crypto-value-card');
  if (!container) return;
  container.innerHTML = `
    <div class="flex items-center gap-3 mb-3">
      <div class="w-10 h-10 lg:w-8 lg:h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 lg:w-4 lg:h-4 text-blue-600"><path d="M9 5v4"/><rect width="4" height="6" x="7" y="9" rx="1"/><path d="M9 15v2"/><path d="M17 3v2"/><rect width="4" height="8" x="15" y="5" rx="1"/><path d="M17 13v3"/><path d="M3 3v16a2 2 0 0 0 2 2h16"/></svg>
      </div>
      <div class="flex-1">
        <p class="text-sm text-gray-400">Crypto Value</p>
        <p class="text-2xl lg:text-xl font-bold text-white">${formatCurrency(value)}</p>
      </div>
    </div>
    <p class="text-xs text-gray-400">Current market value</p>
  `;
}

function renderMembershipCard(value, membershipSummary) {
  const container = document.getElementById('locked-savings-card');
  if (!container) return;
  
  const activeCount = membershipSummary?.active_deposits_count || 0;
  const totalInterest = membershipSummary?.total_interest_earned || 0;
  
  container.innerHTML = `
    <div class="flex items-center gap-3 mb-3">
      <div class="w-10 h-10 lg:w-8 lg:h-8 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 lg:w-4 lg:h-4 text-yellow-600"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
      </div>
      <div class="flex-1">
        <p class="text-sm text-gray-400">Membership Plans</p>
        <p class="text-2xl lg:text-xl font-bold text-white">${formatCurrency(value)}</p>
      </div>
    </div>
    <p class="text-xs text-gray-400">${activeCount} active • ${formatCurrency(totalInterest)} earned</p>
  `;
}

function renderTotalBalanceCard(cash, crypto, savings) {
  const container = document.getElementById('total-balance-card');
  if (!container) return;
  const total = (cash || 0) + (crypto || 0) + (savings || 0);
  container.innerHTML = `
    <div class="flex items-center gap-3 mb-3">
      <div class="w-10 h-10 lg:w-8 lg:h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 lg:w-4 lg:h-4 text-purple-600"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
      </div>
      <div class="flex-1">
        <p class="text-sm text-gray-400">Total Balance</p>
        <p class="text-2xl lg:text-xl font-bold text-white">${formatCurrency(total)}</p>
      </div>
    </div>
    <p class="text-xs text-gray-400">Entire portfolio value</p>
  `;
}

// --- DATA FETCHING & RENDERING ---

async function initializeDashboardView() {
  try {
    // Get user's currency preference first
    const { data: profile } = await supabase.from('profiles').select('currency_code').single();
    if (profile?.currency_code) {
      userCurrency = profile.currency_code;
    }

    // Get dashboard data
    const { data, error } = await supabase.functions.invoke('get-dashboard-data');

    if (error) {
      console.error('Failed to load dashboard data:', error);
      Toastify({
        text: "Failed to load dashboard data: " + error.message,
        duration: 3000,
        close: true,
        gravity: "top",
        position: "center",
        style: {
          background: "linear-gradient(to right, #e74c3c, #c0392b)",
        }
      }).showToast();
      
      // Show error state in cards
      document.getElementById('cash-balance-card').innerHTML = `<p class="text-red-400 text-center">Error loading data</p>`;
      document.getElementById('crypto-value-card').innerHTML = `<p class="text-red-400 text-center">Error loading data</p>`;
      document.getElementById('locked-savings-card').innerHTML = `<p class="text-red-400 text-center">Error loading data</p>`;
      document.getElementById('total-balance-card').innerHTML = `<p class="text-red-400 text-center">Error loading data</p>`;
      return;
    }

    if (data) {
      renderCashBalanceCard(data.cash_balance);
      renderCryptoValueCard(data.total_crypto_value);
      renderMembershipCard(data.total_locked_savings, data.membership_summary);
      renderTotalBalanceCard(data.cash_balance, data.total_crypto_value, data.total_locked_savings);
    }
  } catch (err) {
    console.error('Error initializing dashboard:', err);
    Toastify({
      text: "Failed to load dashboard",
      duration: 3000,
      gravity: "top",
      position: "center",
      style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
    }).showToast();
  }
}

// --- INITIALIZATION ---

// The header script now handles auth checks and fires this event.
document.addEventListener('profile-loaded', () => {
    initializeDashboardView();
}); 