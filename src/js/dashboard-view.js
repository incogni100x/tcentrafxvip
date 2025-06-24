import { supabase } from './client.js';
import Toastify from 'toastify-js';

// Helper function to format currency
function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

// --- RENDER DATA FUNCTIONS ---

function renderCashBalanceCard(balance) {
  const container = document.getElementById('cash-balance-card');
  if (!container) return;
  container.innerHTML = `
    <div class="flex items-center gap-3 mb-3">
      <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-green-600"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
      </div>
      <div class="flex-1">
        <p class="text-sm text-gray-400">Cash Balance</p>
        <p class="text-2xl font-bold text-white">${formatCurrency(balance)}</p>
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
      <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-blue-600"><path d="M9 5v4"/><rect width="4" height="6" x="7" y="9" rx="1"/><path d="M9 15v2"/><path d="M17 3v2"/><rect width="4" height="8" x="15" y="5" rx="1"/><path d="M17 13v3"/><path d="M3 3v16a2 2 0 0 0 2 2h16"/></svg>
      </div>
      <div class="flex-1">
        <p class="text-sm text-gray-400">Crypto Value</p>
        <p class="text-2xl font-bold text-white">${formatCurrency(value)}</p>
      </div>
    </div>
    <p class="text-xs text-gray-400">Current market value</p>
  `;
}

function renderLockedSavingsCard(value) {
  const container = document.getElementById('locked-savings-card');
  if (!container) return;
  container.innerHTML = `
    <div class="flex items-center gap-3 mb-3">
      <div class="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-yellow-600"><path d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z"/><path d="M16 10h.01"/><path d="M2 8v1a2 2 0 0 0 2 2h1"/></svg>
      </div>
      <div class="flex-1">
        <p class="text-sm text-gray-400">Locked Savings</p>
        <p class="text-2xl font-bold text-white">${formatCurrency(value)}</p>
      </div>
    </div>
    <p class="text-xs text-gray-400">Currently earning interest</p>
  `;
}

function renderTotalBalanceCard(cash, crypto, savings) {
  const container = document.getElementById('total-balance-card');
  if (!container) return;
  const total = (cash || 0) + (crypto || 0) + (savings || 0);
  container.innerHTML = `
    <div class="flex items-center gap-3 mb-3">
      <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-purple-600"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
      </div>
      <div class="flex-1">
        <p class="text-sm text-gray-400">Total Balance</p>
        <p class="text-2xl font-bold text-white">${formatCurrency(total)}</p>
      </div>
    </div>
    <p class="text-xs text-gray-400">Entire portfolio value</p>
  `;
}

// --- DATA FETCHING & RENDERING ---

async function initializeDashboardView() {
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
    renderLockedSavingsCard(data.total_locked_savings);
    renderTotalBalanceCard(data.cash_balance, data.total_crypto_value, data.total_locked_savings);
  }
}

// --- INITIALIZATION ---

let hasInitialized = false;
// Wait for the auth state to be confirmed before fetching data.
supabase.auth.onAuthStateChange((event, session) => {
    if (session && !hasInitialized) {
        hasInitialized = true;
        initializeDashboardView();
    }
}); 