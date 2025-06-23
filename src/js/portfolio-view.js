import { supabase } from './client.js';
import Toastify from 'toastify-js';
import { getCurrentUser } from './session.js';

async function fetchPortfolioData() {
  const user = await getCurrentUser();
  if (!user) {
    Toastify({
      text: "You must be logged in to view your portfolio.",
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
    return null;
  }

  const { data, error } = await supabase.functions.invoke('buy-crypto-portfolio');

  if (error) {
    Toastify({
      text: `Failed to load portfolio data: ${error.message}`,
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
    return null;
  }
  return data;
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

function renderSummarySkeleton() {
  const investmentContainer = document.getElementById('summary-total-investment-container');
  const valueContainer = document.getElementById('summary-current-value-container');
  const fundsContainer = document.getElementById('summary-active-funds-container');

  const skeletonContent = `
    <div class="flex items-center gap-3 mb-3">
        <div class="skeleton w-10 h-10 rounded-lg shrink-0"></div>
        <div class="flex-1 space-y-2">
            <div class="skeleton h-4 w-24"></div>
            <div class="skeleton h-6 w-32"></div>
        </div>
    </div>
    <div class="skeleton h-3 w-40"></div>
  `;
  
  if(investmentContainer) investmentContainer.innerHTML = skeletonContent;
  if(valueContainer) valueContainer.innerHTML = skeletonContent;
  if(fundsContainer) fundsContainer.innerHTML = skeletonContent;
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
  
  // Render 3 skeleton items
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
    const iconUrl = `assets/icons/crypto/${fund.crypto_symbol.toUpperCase()}.svg`;
    let iconHtml = `<div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold">${fund.crypto_symbol.charAt(0)}</div>`; // Fallback to initial

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
    
    const desktopRow = `
      <tr class="border-b border-gray-700">
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
      <div class="bg-gray-700 rounded-lg p-4">
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

document.addEventListener('DOMContentLoaded', async () => {
  renderSummarySkeleton();
  renderActiveFundsSkeleton();

  const portfolioData = await fetchPortfolioData();
  console.log('Portfolio Data Received:', portfolioData);
  
  if (portfolioData) {
    renderSummary(portfolioData.active_funds);
    await renderActiveFunds(portfolioData.active_funds);
    renderTransactionHistory(portfolioData.transaction_history);
    renderSoldHistory(portfolioData.sold_history);
  } else {
    // Handle case where data fetching fails or returns nothing
    renderSummary([]); // Render empty summary
    const desktopBody = document.getElementById('active-funds-tbody-desktop');
    const mobileContainer = document.getElementById('active-funds-cards');
    if (desktopBody) desktopBody.innerHTML = '<tr><td colspan="8" class="text-center p-4 text-gray-500">Could not load portfolio data.</td></tr>';
    if (mobileContainer) mobileContainer.innerHTML = '<div class="text-center p-4 text-gray-500">Could not load portfolio data.</div>';
  }
}); 