import { supabase } from './client.js';
import { getCurrentUser } from './session.js';
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
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-blue-600"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2"/><path d="M3 11h3c.8 0 1.6.3 2.1.9l1.1.9c1.6 1.6 4.1 1.6 5.7 0l1.1-.9c.5-.5 1.3-.9 2.1-.9H21"/></svg>
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
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-yellow-600"><path d="M19 5c-1.5 0-2.8 1-3.4 2.3C14.5 5.4 13.2 4 11.5 4c-1.7 0-3.2 1.4-3.5 3.2-1.4-.4-2.8.4-3.4 1.8"/><path d="m19 12-1.5-1.5a2.4 2.4 0 0 0-3.4 0L12 12.6V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.4c0-1.1-.9-2-2-2Z"/><path d="M4 17.2V11a2 2 0 0 1 2-2h2"/><path d="M2 9.5c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2"/><path d="M10 17v1"/><path d="m16 9.3-1.8 1.8c-.8.8-2 .8-2.8 0L9.6 9.3"/></svg>
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

// --- DATA FETCHING ---

async function fetchDashboardData() {
  const user = await getCurrentUser();
  if (!user) {
    // User not logged in, show error and stop
    Toastify({
      text: "Please log in to view your dashboard.",
      duration: 3000,
      close: true,
      gravity: "top",
      position: "center",
      style: {
        background: "linear-gradient(to right, #e74c3c, #c0392b)",
      }
    }).showToast();
    return null;
  }

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
    return null;
  }

  return data;
}

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Fetch the data
  const data = await fetchDashboardData();

  // 2. Render the actual data if it exists
  if (data) {
    renderCashBalanceCard(data.cash_balance);
    renderCryptoValueCard(data.total_crypto_value);
    renderLockedSavingsCard(data.total_locked_savings);
    renderTotalBalanceCard(data.cash_balance, data.total_crypto_value, data.total_locked_savings);
  } else {
    // Optionally, handle the error case visually, though toast is already shown
    document.getElementById('cash-balance-card').innerHTML = `<p class="text-red-400 text-center">Error loading data</p>`;
    document.getElementById('crypto-value-card').innerHTML = `<p class="text-red-400 text-center">Error loading data</p>`;
    document.getElementById('locked-savings-card').innerHTML = `<p class="text-red-400 text-center">Error loading data</p>`;
    document.getElementById('total-balance-card').innerHTML = `<p class="text-red-400 text-center">Error loading data</p>`;
  }
}); 