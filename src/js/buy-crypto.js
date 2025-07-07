import { supabase } from './client.js';
import { cryptoTokens } from './crypto-tokens.js';
import { buyCrypto, sellCrypto } from './crypto-actions.js';
import { getCurrentUser } from './session.js';
import Toastify from 'toastify-js';

// --- GLOBAL STATE ---
let user = null;

// --- AVAILABLE CRYPTOS LOGIC (from buy-crypto-view.js) ---
function renderCryptoCardSkeletons() {
    const container = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3');
    if (!container) return;
    container.innerHTML = ''; 

    const skeletonCard = `
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 fund-card">
        <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2 w-full">
                <div class="skeleton w-10 h-10 rounded-full shrink-0"></div>
                <div class="space-y-2 w-full">
                    <div class="skeleton h-4 w-3/4"></div>
                    <div class="skeleton h-3 w-1/4"></div>
                </div>
            </div>
            <div class="space-y-2 w-20 shrink-0 ml-2">
                <div class="skeleton h-5 w-full"></div>
            </div>
        </div>
        <div class="mb-4">
            <div class="flex justify-between items-center mb-1">
                <div class="skeleton h-3 w-28"></div>
                <div class="skeleton h-4 w-12"></div>
            </div>
            <div class="skeleton h-2 w-full rounded-full"></div>
        </div>
        <div class="flex gap-2">
            <div class="skeleton h-9 w-full rounded-md"></div>
            <div class="skeleton h-9 w-full rounded-md"></div>
        </div>
    </div>
    `;
    for (let i = 0; i < 6; i++) {
        container.insertAdjacentHTML('beforeend', skeletonCard);
    }
}

async function fetchAndRenderAvailableCryptos() {
    const availableCryptosContainer = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3');
    if (!availableCryptosContainer) return;

    try {
        const { data, error } = await supabase
            .from('crypto_tokens')
            .select('crypto_symbol, static_price, interest_rate');

        if (error) {
            console.error('Error fetching crypto data:', error);
            availableCryptosContainer.innerHTML = `<p class="text-red-400 col-span-full">Error loading cryptos.</p>`;
            return;
        }

        availableCryptosContainer.innerHTML = ''; // Clear skeletons

        const cardPromises = cryptoTokens.map(token => {
            const backendData = data.find(d => d.crypto_symbol === token.symbol);
            if (!backendData) return null;
            return createCryptoCard(token, backendData);
        }).filter(Boolean);

        const cards = await Promise.all(cardPromises);
        cards.forEach(card => {
            if (card) availableCryptosContainer.appendChild(card);
        });

    } catch (error) {
        console.error('An error occurred fetching available cryptos:', error);
        availableCryptosContainer.innerHTML = `<p class="text-red-400 col-span-full">An error occurred.</p>`;
    }
}

async function createCryptoCard(token, backendData) {
    const { symbol, name } = token;
    const { static_price, interest_rate } = backendData;
    
    const iconUrl = `/assets/icons/crypto/${symbol.toUpperCase()}.svg`;
    let iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 text-gray-400"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`; // Fallback
    
    try {
        const response = await fetch(iconUrl);
        if (response.ok) {
            const svgText = await response.text();
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = svgText.trim();
            const svgElement = tempDiv.firstChild;
            if (svgElement && svgElement.tagName && svgElement.tagName.toLowerCase() === 'svg') {
                svgElement.setAttribute('class', 'w-6 h-6');
                iconSvg = svgElement.outerHTML;
            }
        }
    } catch (e) {
        console.warn(`Could not load icon for ${symbol}:`, e.message);
    }
    
    const card = document.createElement('div');
    card.className = 'bg-gray-800 border border-gray-700 rounded-lg p-4 fund-card';
    card.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
                <div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                    ${iconSvg}
                </div>
                <div>
                    <h3 class="font-semibold text-white text-base">${name}</h3>
                    <div class="text-xs text-gray-400">${symbol}</div>
                </div>
            </div>
            <div class="text-right">
                <div class="text-lg font-semibold text-white">$${Number(static_price).toFixed(2)}</div>
            </div>
        </div>
        <div class="mb-4">
            <div class="flex justify-between items-center mb-1">
                <span class="text-xs text-gray-400">Guaranteed Interest Rate</span>
                <span class="text-sm font-semibold text-green-400">${interest_rate}%</span>
            </div>
            <div class="w-full bg-gray-700 rounded-full h-2">
                <div class="bg-green-500 h-2 rounded-full" style="width: ${interest_rate}%"></div>
            </div>
        </div>
        <div class="flex gap-2">
            <button class="flex-1 bg-blue-600 text-white py-2.5 sm:py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">Buy</button>
            <button class="flex-1 border border-gray-600 text-white py-2.5 sm:py-2 rounded-md hover:bg-gray-700 transition-colors text-sm font-medium">Sell</button>
        </div>
    `;
    return card;
}


// --- PORTFOLIO LOGIC (from portfolio-view.js) ---
async function fetchAndRenderPortfolio() {
    renderActiveFundsSkeleton();
    try {
        const { data: portfolioData, error } = await supabase.functions.invoke('buy-crypto-portfolio');
        
        if (error) {
            throw error;
        }

        if (portfolioData) {
            renderSummary(portfolioData.active_funds);
            await renderActiveFunds(portfolioData.active_funds);
            renderTransactionHistory(portfolioData.transaction_history);
            renderSoldHistory(portfolioData.sold_history);
        } else {
            throw new Error("No data returned from portfolio function.");
        }
    } catch(error) {
        console.error("Failed to load portfolio data:", error);
        Toastify({ text: `Failed to load portfolio data: ${error.message}`, duration: 3000, close: true, gravity: "top", position: "center" }).showToast();
        renderSummary([]); 
        const desktopBody = document.getElementById('active-funds-tbody-desktop');
        const mobileContainer = document.getElementById('active-funds-cards');
        if (desktopBody) desktopBody.innerHTML = '<tr><td colspan="8" class="text-center p-4 text-gray-500">Could not load portfolio data.</td></tr>';
        if (mobileContainer) mobileContainer.innerHTML = '<div class="text-center p-4 text-gray-500">Could not load portfolio data.</div>';
    }
}

function formatCurrency(value) {
  return (value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function renderSummary(activeFunds) {
  const totalInvestment = activeFunds.reduce((acc, fund) => acc + (fund.total_investment || 0), 0);
  const currentValue = activeFunds.reduce((acc, fund) => acc + (fund.current_market_value || 0), 0);
  const absoluteGain = currentValue - totalInvestment;
  const overallReturn = totalInvestment > 0 ? (absoluteGain / totalInvestment) * 100 : 0;

  const investmentContainer = document.getElementById('summary-total-investment-container');
  const valueContainer = document.getElementById('summary-current-value-container');
  const fundsContainer = document.getElementById('summary-active-funds-container');

  if (investmentContainer) {
    investmentContainer.innerHTML = `
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-blue-600"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
        </div>
        <div class="flex-1">
          <p class="text-sm text-gray-400">Total Investment</p>
          <p class="text-2xl font-bold text-white">${formatCurrency(totalInvestment)}</p>
        </div>
      </div>
      <p class="text-xs ${overallReturn >= 0 ? 'text-blue-400' : 'text-red-400'}">${overallReturn.toFixed(2)}% overall return</p>
    `;
  }
  
  if (valueContainer) {
    valueContainer.innerHTML = `
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-green-600"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <div class="flex-1">
          <p class="text-sm text-gray-400">Current Value</p>
          <p class="text-2xl font-bold text-white">${formatCurrency(currentValue)}</p>
        </div>
      </div>
      <p class="text-xs ${absoluteGain >= 0 ? 'text-green-400' : 'text-red-400'}">${absoluteGain >= 0 ? '+' : ''}${formatCurrency(absoluteGain)} absolute gain</p>
    `;
  }

  if (fundsContainer) {
    fundsContainer.innerHTML = `
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-purple-600"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
        </div>
        <div class="flex-1">
          <p class="text-sm text-gray-400">Active Funds</p>
          <p class="text-2xl font-bold text-white">${activeFunds.length}</p>
        </div>
      </div>
      <p class="text-xs text-gray-400">View details below</p>
    `;
  }
}

function renderActiveFundsSkeleton() {
  const desktopBody = document.getElementById('active-funds-tbody-desktop');
  const mobileContainer = document.getElementById('active-funds-cards');
  if (!desktopBody || !mobileContainer) return;

  desktopBody.innerHTML = '';
  mobileContainer.innerHTML = '';

  const skeletonDesktopRow = `
    <tr class="skeleton-row">
      <td class="px-3 py-4 align-middle">
        <div class="flex items-center gap-3">
          <div class="skeleton w-10 h-10 rounded-full shrink-0"></div>
          <div class="space-y-2 w-full">
            <div class="skeleton h-4 w-24"></div>
            <div class="skeleton h-3 w-16"></div>
          </div>
        </div>
      </td>
      <td class="px-3 py-4 align-middle"><div class="skeleton h-4 w-12"></div></td>
      <td class="px-3 py-4 align-middle"><div class="skeleton h-4 w-20"></div></td>
      <td class="px-3 py-4 align-middle"><div class="skeleton h-4 w-20"></div></td>
      <td class="px-3 py-4 align-middle"><div class="skeleton h-4 w-24"></div></td>
      <td class="px-3 py-4 align-middle"><div class="skeleton h-4 w-16"></div></td>
      <td class="px-3 py-4 align-middle"><div class="skeleton h-4 w-12"></div></td>
      <td class="px-3 py-4 align-middle"><div class="skeleton h-8 w-16 rounded-md"></div></td>
    </tr>
  `;

  const skeletonMobileCard = `
    <div class="bg-gray-700 rounded-lg p-4">
        <div class="flex justify-between items-start mb-4">
            <div class="flex items-center gap-3 w-full">
                <div class="skeleton w-10 h-10 rounded-full shrink-0"></div>
                <div class="space-y-2 w-full">
                    <div class="skeleton h-4 w-3/4"></div>
                    <div class="skeleton h-3 w-1/2"></div>
                </div>
            </div>
        </div>
        <div class="border-t border-gray-600 pt-4 grid grid-cols-2 gap-4">
            <div class="space-y-2"><div class="skeleton h-3 w-16"></div><div class="skeleton h-4 w-20"></div></div>
            <div class="space-y-2"><div class="skeleton h-3 w-12"></div><div class="skeleton h-4 w-16"></div></div>
            <div class="space-y-2"><div class="skeleton h-3 w-20"></div><div class="skeleton h-4 w-24"></div></div>
            <div class="space-y-2"><div class="skeleton h-3 w-24"></div><div class="skeleton h-4 w-28"></div></div>
        </div>
    </div>
  `;
  
  for (let i = 0; i < 3; i++) {
    desktopBody.insertAdjacentHTML('beforeend', skeletonDesktopRow);
    mobileContainer.insertAdjacentHTML('beforeend', skeletonMobileCard);
  }
}

async function renderActiveFunds(funds) {
  const desktopBody = document.getElementById('active-funds-tbody-desktop');
  const mobileContainer = document.getElementById('active-funds-cards');
  if (!desktopBody || !mobileContainer) return;

  desktopBody.innerHTML = '';
  mobileContainer.innerHTML = '';

  if (funds.length === 0) {
    const emptyRow = `<tr><td colspan="8" class="text-center p-4 text-gray-500">You have no active funds.</td></tr>`;
    desktopBody.innerHTML = emptyRow;
    mobileContainer.innerHTML = `<div class="text-center p-4 text-gray-500">You have no active funds.</div>`;
    return;
  }

  const fundPromises = funds.map(async (fund) => {
    const iconUrl = `/assets/icons/crypto/${fund.crypto_symbol.toUpperCase()}.svg`;
    let iconHtml = `<div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold">${fund.crypto_symbol.charAt(0)}</div>`;

    try {
      const response = await fetch(iconUrl);
      if (response.ok) {
        const svgText = await response.text();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = svgText.trim();
        const svgElement = tempDiv.firstChild;
        if (svgElement && svgElement.tagName && svgElement.tagName.toLowerCase() === 'svg') {
          svgElement.setAttribute('class', 'w-6 h-6');
          iconHtml = `<div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">${svgElement.outerHTML}</div>`;
        }
      }
    } catch (e) {
      console.warn(`Could not load icon for ${fund.crypto_symbol}`, e);
    }

    const gainLossClass = fund.gain_loss >= 0 ? 'text-green-400' : 'text-red-400';
    const gainLossSign = fund.gain_loss >= 0 ? '+' : '';
    const currentPrice = fund.units_held > 0 ? fund.current_market_value / fund.units_held : 0;
    
    const desktopRow = `
      <tr class="border-b border-gray-700" 
          data-name="${fund.fund_name}" 
          data-symbol="${fund.crypto_symbol}" 
          data-price="${currentPrice}"
          data-interest="${fund.interest_rate}"
          data-units-held="${fund.units_held}">
        <td class="px-3 py-4">
          <div class="flex items-center gap-3">
            ${iconHtml}
            <div>
              <div class="font-semibold text-white text-sm">${fund.fund_name}</div>
              <div class="text-xs text-gray-400">${fund.crypto_symbol}</div>
            </div>
          </div>
        </td>
        <td class="px-3 py-4 text-sm text-white">${fund.units_held.toFixed(4)}</td>
        <td class="px-3 py-4 text-sm text-white">${formatCurrency(fund.avg_purchase_price)}</td>
        <td class="px-3 py-4 text-sm text-white">${formatCurrency(fund.total_investment)}</td>
        <td class="px-3 py-4 text-sm text-white">${formatCurrency(fund.current_market_value)}</td>
        <td class="px-3 py-4 text-sm ${gainLossClass}">${gainLossSign}${formatCurrency(fund.gain_loss)}</td>
        <td class="px-3 py-4 text-sm text-green-400">${fund.interest_rate}%</td>
        <td class="px-3 py-4">
          <button class="text-blue-400 hover:text-blue-300 text-sm font-medium">Sell</button>
        </td>
      </tr>
    `;

    const mobileCard = `
      <div class="bg-gray-700 rounded-lg p-4"
          data-name="${fund.fund_name}" 
          data-symbol="${fund.crypto_symbol}" 
          data-price="${currentPrice}"
          data-interest="${fund.interest_rate}"
          data-units-held="${fund.units_held}">
        <div class="flex justify-between items-start mb-3">
          <div class="flex items-center gap-3">
            ${iconHtml}
            <div>
              <div class="font-semibold text-white text-base">${fund.fund_name}</div>
              <div class="text-xs text-gray-400">${fund.crypto_symbol}</div>
            </div>
          </div>
          <button class="text-blue-400 hover:text-blue-300 text-sm font-medium flex-shrink-0 ml-4">Sell</button>
        </div>
        <div class="border-t border-gray-600 pt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div><div class="text-xs text-gray-400">Units Held</div><div class="text-sm text-white font-medium">${fund.units_held.toFixed(4)}</div></div>
          <div><div class="text-xs text-gray-400">Avg. Price</div><div class="text-sm text-white font-medium">${formatCurrency(fund.avg_purchase_price)}</div></div>
          <div><div class="text-xs text-gray-400">Investment</div><div class="text-sm text-white font-medium">${formatCurrency(fund.total_investment)}</div></div>
          <div><div class="text-xs text-gray-400">Current Value</div><div class="text-sm text-white font-medium">${formatCurrency(fund.current_market_value)}</div></div>
          <div><div class="text-xs text-gray-400">Gain/Loss</div><div class="text-sm ${gainLossClass} font-medium">${gainLossSign}${formatCurrency(fund.gain_loss)}</div></div>
          <div><div class="text-xs text-gray-400">Interest Rate</div><div class="text-sm text-green-400 font-medium">${fund.interest_rate}%</div></div>
        </div>
      </div>
    `;
    
    return { desktopRow, mobileCard };
  });

  const allHtml = await Promise.all(fundPromises);

  allHtml.forEach(html => {
    desktopBody.insertAdjacentHTML('beforeend', html.desktopRow);
    mobileContainer.insertAdjacentHTML('beforeend', html.mobileCard);
  });
}

function renderTransactionHistory(history) {
    const desktopBody = document.getElementById('transaction-history-tbody-desktop');
    const mobileContainer = document.getElementById('transaction-history-cards');
    if (!desktopBody || !mobileContainer) return;

    desktopBody.innerHTML = '';
    mobileContainer.innerHTML = '';
    
    if (history.length === 0) {
        const emptyRow = `<tr><td colspan="6" class="text-center p-4 text-gray-500">No transaction history.</td></tr>`;
        desktopBody.innerHTML = emptyRow;
        mobileContainer.innerHTML = `<div class="text-center p-4 text-gray-500">No transaction history.</div>`;
        return;
    }
    
    history.forEach(tx => {
        const typeClass = tx.type === 'Buy' ? 'text-green-400' : 'text-red-400';
        const row = `
            <tr class="border-b border-gray-700">
                <td class="px-3 py-4 text-sm text-white">${new Date(tx.date).toLocaleDateString()}</td>
                <td class="px-3 py-4 text-sm text-white">${tx.fund_name}</td>
                <td class="px-3 py-4 text-sm ${typeClass}">${tx.type}</td>
                <td class="px-3 py-4 text-sm text-white">${tx.units.toFixed(4)}</td>
                <td class="px-3 py-4 text-sm text-white">${formatCurrency(tx.price_at_transaction)}</td>
                <td class="px-3 py-4 text-sm text-white">${formatCurrency(tx.total_amount)}</td>
            </tr>
        `;
        desktopBody.insertAdjacentHTML('beforeend', row);
    });
}

function renderSoldHistory(history) {
    const desktopBody = document.getElementById('sold-history-tbody');
    if (!desktopBody) return;
    desktopBody.innerHTML = '';
    
    if (history.length === 0) {
        const emptyRow = `<tr><td colspan="2" class="text-center p-4 text-gray-500">No sold history.</td></tr>`;
        desktopBody.innerHTML = emptyRow;
        return;
    }

    history.forEach(tx => {
        const row = `
            <tr class="border-b border-gray-700">
                <td class="px-3 py-4 text-sm text-white">${tx.fund_name}</td>
                <td class="px-3 py-4 text-sm text-white">${new Date(tx.date).toLocaleDateString()}</td>
            </tr>
        `;
        desktopBody.insertAdjacentHTML('beforeend', row);
    });
}

// --- INTERACTIVE LOGIC (from buy-crypto-interactive.js) ---
async function initializePage() {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      window.location.href = '/login.html';
      return false;
    }
    user = currentUser;

    const userInitialsEl = document.getElementById('user-initials');
    const fullName = user.user_metadata?.full_name || 'User';
    const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase();
    if (userInitialsEl) userInitialsEl.textContent = initials;
    return true;
}

function setupEventListeners() {
    // Mobile sidebar
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileSidebar = document.getElementById('mobile-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileSidebar.classList.remove('-translate-x-full');
            sidebarOverlay.classList.remove('opacity-0', 'pointer-events-none');
        });
        sidebarOverlay.addEventListener('click', () => {
            mobileSidebar.classList.add('-translate-x-full');
            sidebarOverlay.classList.add('opacity-0', 'pointer-events-none');
        });
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 1024) {
                mobileSidebar.classList.add('-translate-x-full');
                sidebarOverlay.classList.add('opacity-0', 'pointer-events-none');
            }
        });
    }

    // Tabs
    const tabButtons = document.querySelectorAll('[id^="tab-"]');
    const tableContainers = document.querySelectorAll('[id$="-table-container"]');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(tab => tab.classList.remove('border-blue-400', 'text-blue-400'));
            button.classList.add('border-blue-400', 'text-blue-400');
            tableContainers.forEach(container => container.classList.add('hidden'));
            const tabId = button.id.replace('tab-', '');
            document.getElementById(`${tabId}-table-container`)?.classList.remove('hidden');
        });
    });

    // Modal
    const modal = document.getElementById('transaction-modal');
    const processingOverlay = document.getElementById('processing-overlay');
    const successOverlay = document.getElementById('success-overlay');
    const closeModalBtn = document.getElementById('close-modal');
    const cancelTransactionBtn = document.getElementById('cancel-transaction');
    const successDoneBtn = document.getElementById('success-done-btn');

    document.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const buttonText = button.textContent.trim();
        if (buttonText === 'Buy' || buttonText === 'Sell') {
            e.preventDefault();
            const fundCard = button.closest('.fund-card, .border-b.border-gray-700, .bg-gray-700.rounded-lg');
            if (fundCard) openTransactionModal(fundCard, buttonText);
        }
    });

    if(modal) {
        const closeActions = () => {
            modal.classList.add('hidden');
            const availableUnitsSpan = document.getElementById('modal-available-units');
            if (availableUnitsSpan) {
                availableUnitsSpan.parentElement.classList.add('hidden');
            }
            delete modal.dataset.maxUnits;
        };
        closeModalBtn.addEventListener('click', closeActions);
        cancelTransactionBtn.addEventListener('click', closeActions);
        modal.addEventListener('click', e => { if (e.target === modal) closeActions(); });
    }

    if(successDoneBtn) {
        successDoneBtn.addEventListener('click', () => {
            successOverlay.classList.add('hidden');
            window.location.reload();
        });
    }

    // Form logic
    const transactionForm = document.getElementById('transaction-form');
    if(transactionForm) transactionForm.addEventListener('submit', handleTransactionSubmit);
    
    document.querySelectorAll('input[name="investment-type"]').forEach(radio => radio.addEventListener('change', updateCalculations));
    document.getElementById('amount-input')?.addEventListener('input', updateCalculations);
    document.getElementById('units-input')?.addEventListener('input', updateCalculations);
    document.querySelectorAll('input[name="transaction-type"]').forEach(radio => {
        radio.addEventListener('change', () => {
            updateCalculations();
            toggleMaxButtons();
        });
    });

    const maxAmountBtn = document.getElementById('max-amount-btn');
    const maxUnitsBtn = document.getElementById('max-units-btn');
    const amountInput = document.getElementById('amount-input');
    const unitsInput = document.getElementById('units-input');

    if (maxAmountBtn) {
        maxAmountBtn.addEventListener('click', () => {
            const maxUnits = parseFloat(modal.dataset.maxUnits) || 0;
            const price = parseFloat(document.getElementById('fund-price').textContent.replace(/[^0-9.]/g, '')) || 0;
            if (maxUnits > 0 && price > 0) {
                const maxAmount = maxUnits * price;
                amountInput.value = maxAmount.toFixed(2);
                updateCalculations();
            }
        });
    }

    if (maxUnitsBtn) {
        maxUnitsBtn.addEventListener('click', () => {
            const maxUnits = parseFloat(modal.dataset.maxUnits) || 0;
            if (maxUnits > 0) {
                unitsInput.value = maxUnits;
                updateCalculations();
            }
        });
    }
}

function toggleMaxButtons() {
    const transactionType = document.querySelector('input[name="transaction-type"]:checked').value;
    const maxAmountBtn = document.getElementById('max-amount-btn');
    const maxUnitsBtn = document.getElementById('max-units-btn');
    const shouldShow = transactionType === 'sell';

    if (maxAmountBtn) maxAmountBtn.classList.toggle('hidden', !shouldShow);
    if (maxAmountBtn) maxAmountBtn.classList.toggle('flex', shouldShow);
    if (maxUnitsBtn) maxUnitsBtn.classList.toggle('hidden', !shouldShow);
    if (maxUnitsBtn) maxUnitsBtn.classList.toggle('flex', shouldShow);
}

function openTransactionModal(fundCard, transactionType) {
    let fundName, fundCode, fundPrice, fundInterest, iconSvg;

    const isPortfolioItem = fundCard.dataset.name;

    if (isPortfolioItem) { // It's a portfolio item with data attributes
        fundName = fundCard.dataset.name;
        fundCode = fundCard.dataset.symbol;
        const price = parseFloat(fundCard.dataset.price);
        fundPrice = `$${price.toFixed(2)}`;
        fundInterest = `${fundCard.dataset.interest}%`;
        const iconContainer = fundCard.querySelector('.w-10.h-10.rounded-full');
        if (iconContainer) iconSvg = iconContainer.innerHTML;
    } else { // It's an available crypto card, use old logic
        const nameEl = fundCard.querySelector('h3.font-semibold, .font-semibold.text-white.text-sm, .font-semibold.text-white.text-base');
        const codeEl = fundCard.querySelector('.text-xs.text-gray-400');
        const priceEl = fundCard.querySelector('.text-right .text-lg.font-semibold');
        const interestEl = fundCard.querySelector('.text-sm.font-semibold.text-green-400, .text-sm.text-green-400');
        const iconEl = fundCard.querySelector('.w-10.h-10.rounded-full svg, .w-10.h-10.rounded-full .w-6.h-6');

        if (nameEl) fundName = nameEl.textContent.trim();
        if (codeEl) fundCode = codeEl.textContent.trim();
        if (priceEl) fundPrice = priceEl.textContent.trim();
        if (interestEl) fundInterest = interestEl.textContent.trim();
        if (iconEl) iconSvg = iconEl.outerHTML;
    }
    
    fundName = fundName || 'Unknown Fund';
    fundCode = fundCode || 'N/A';
    fundPrice = fundPrice || '$0.00';
    fundInterest = fundInterest || '0%';
    iconSvg = iconSvg || `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 text-gray-400"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

    const modal = document.getElementById('transaction-modal');
    const availableUnits = fundCard.dataset.unitsHeld;
    const availableUnitsSpan = document.getElementById('modal-available-units');

    if (transactionType === 'Sell' && availableUnits) {
        modal.dataset.maxUnits = availableUnits;
        if (availableUnitsSpan) {
            availableUnitsSpan.textContent = `Available: ${parseFloat(availableUnits).toFixed(4)} ${fundCode}`;
            availableUnitsSpan.parentElement.classList.remove('hidden');
        }
    } else {
        delete modal.dataset.maxUnits;
        if (availableUnitsSpan) {
            availableUnitsSpan.parentElement.classList.add('hidden');
        }
    }

    document.getElementById('fund-name').textContent = fundName;
    document.getElementById('fund-code').textContent = fundCode;
    document.getElementById('fund-price').textContent = fundPrice;
    document.getElementById('fund-interest').textContent = fundInterest;
    document.getElementById('units-input').placeholder = `Enter ${fundCode} units`;
    document.getElementById('modal-fund-icon').innerHTML = iconSvg;
    
    document.getElementById('modal-title').textContent = `${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)} Crypto`;
    const radioButton = document.querySelector(`input[name="transaction-type"][value="${transactionType.toLowerCase()}"]`);
    if (radioButton) radioButton.checked = true;
    
    toggleMaxButtons();
    updateCalculations();
    document.getElementById('transaction-modal').classList.remove('hidden');
}


async function handleTransactionSubmit(e) {
    e.preventDefault();
    const processingOverlay = document.getElementById('processing-overlay');
    const transactionType = document.querySelector('input[name="transaction-type"]:checked').value;
    
    document.getElementById('processing-message').textContent = `Please wait while we process your ${transactionType} transaction...`;
    processingOverlay.classList.remove('hidden');

    const cryptoSymbol = document.getElementById('fund-code').textContent.trim();
    const price = parseFloat(document.getElementById('fund-price').textContent.replace(/[^0-9.]/g, '')) || 0;
    const investmentType = document.querySelector('input[name="investment-type"]:checked').value;
    
    let units;
    if (investmentType === 'amount') {
        const amount = parseFloat(document.getElementById('amount-input').value) || 0;
        units = (price > 0) ? amount / price : 0;
    } else {
        units = parseFloat(document.getElementById('units-input').value) || 0;
    }

    if (!cryptoSymbol || cryptoSymbol === 'N/A' || !units || units <= 0) {
        Toastify({ text: 'Invalid input. Please check the crypto and amount.', className: 'toast-error' }).showToast();
        processingOverlay.classList.add('hidden');
        return;
    }

    const result = transactionType === 'buy' ? await buyCrypto(cryptoSymbol, units) : await sellCrypto(cryptoSymbol, units);
    
    processingOverlay.classList.add('hidden');
    
    if (result.success) {
        document.getElementById('transaction-modal').classList.add('hidden');
        const availableUnitsSpan = document.getElementById('modal-available-units');
        if (availableUnitsSpan) {
            availableUnitsSpan.parentElement.classList.add('hidden');
        }
        e.target.reset();
        showSuccessModal(transactionType, cryptoSymbol, units, result);
    } else {
        Toastify({ text: result.message, duration: 3000, className: 'toast-error' }).showToast();
    }
}

function showSuccessModal(type, symbol, units, result) {
    const unitsFormatted = `${units.toFixed(4)} ${symbol}`;
    if (type === 'buy') {
        document.getElementById('success-title').textContent = 'Purchase Successful!';
        document.getElementById('success-message').innerHTML = `You have successfully purchased <strong class="text-white">${unitsFormatted}</strong>.`;
        document.getElementById('summary-amount-label').textContent = 'Amount Purchased:';
        document.getElementById('summary-price-label').textContent = 'Price per Token:';
        document.getElementById('summary-cost-label').textContent = 'Total Cost:';
        document.getElementById('summary-amount').textContent = unitsFormatted;
        document.getElementById('summary-price').textContent = `$${result.purchase_price.toFixed(2)}`;
        document.getElementById('summary-cost').textContent = `$${result.fiat_spent.toFixed(2)}`;
    } else {
        document.getElementById('success-title').textContent = 'Sale Successful!';
        document.getElementById('success-message').innerHTML = `You have successfully sold <strong class="text-white">${unitsFormatted}</strong>.`;
        document.getElementById('summary-amount-label').textContent = 'Amount Sold:';
        document.getElementById('summary-price-label').textContent = 'Price per Token:';
        document.getElementById('summary-cost-label').textContent = 'Total Received:';
        document.getElementById('summary-amount').textContent = unitsFormatted;
        document.getElementById('summary-price').textContent = `$${result.sell_price.toFixed(2)}`;
        document.getElementById('summary-cost').textContent = `$${result.fiat_received.toFixed(2)}`;
    }
    document.getElementById('success-overlay').classList.remove('hidden');
}


function updateCalculations() {
    const price = parseFloat(document.getElementById('fund-price').textContent.replace(/[^0-9.]/g, '')) || 0;
    const cryptoSymbol = document.getElementById('fund-code').textContent.trim();
    const investmentType = document.querySelector('input[name="investment-type"]:checked').value;
    const transactionType = document.querySelector('input[name="transaction-type"]:checked').value;
    const modal = document.getElementById('transaction-modal');
    const maxUnits = parseFloat(modal.dataset.maxUnits) || 0;
    
    let units = 0, amount = 0;
    const amountInput = document.getElementById('amount-input');
    const unitsInput = document.getElementById('units-input');

    if (investmentType === 'amount') {
        document.getElementById('amount-input-container').classList.remove('hidden');
        document.getElementById('units-input-container').classList.add('hidden');
        amount = parseFloat(amountInput.value) || 0;
        units = (price > 0) ? amount / price : 0;
        
        if (transactionType === 'sell' && maxUnits > 0 && units > maxUnits) {
            units = maxUnits;
            amount = units * price;
            amountInput.value = amount.toFixed(2);
        }

    } else { // units
        document.getElementById('units-input-container').classList.remove('hidden');
        document.getElementById('amount-input-container').classList.add('hidden');
        units = parseFloat(unitsInput.value) || 0;

        if (transactionType === 'sell' && maxUnits > 0 && units > maxUnits) {
            units = maxUnits;
            unitsInput.value = units;
        }
        amount = units * price;
    }

    document.getElementById('estimated-units').textContent = `${units.toFixed(8)} ${cryptoSymbol}`;
    document.getElementById('total-amount').textContent = `$${amount.toFixed(2)}`;
    
    if (transactionType === 'buy') {
        document.getElementById('estimated-units-label').textContent = 'You will get:';
        document.getElementById('total-amount-label').textContent = 'You will spend:';
    } else {
        document.getElementById('estimated-units-label').textContent = 'You will sell:';
        document.getElementById('total-amount-label').textContent = 'You will receive:';
    }
}

// --- MAIN INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    const loggedIn = await initializePage();
    if (!loggedIn) return;

    setupEventListeners();
    
    renderCryptoCardSkeletons();
    
    // Fetch data in parallel
    await Promise.all([
        fetchAndRenderAvailableCryptos(),
        fetchAndRenderPortfolio()
    ]);
}); 