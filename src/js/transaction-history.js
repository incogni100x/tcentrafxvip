import { supabase } from './client.js';
import { formatCurrency } from './session.js';

// --- CONFIGURATION --- //
const DESKTOP_TBODY_ID = 'transactions-tbody-desktop';
const MOBILE_CARDS_ID = 'transactions-cards';
const SKELETON_ID = 'skeleton-loader';
const NO_TRANSACTIONS_ID = 'no-transactions-message';
const PAGINATION_ID = 'pagination-container';
const COUNT_CONTAINER_ID = 'transaction-count-container';

// --- STATE --- //
let allTransactions = [];
let filteredTransactions = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 10;

// --- HELPERS --- //

/**
 * Truncates a string to show the start and end, with ellipses in the middle.
 * @param {string} id The string to truncate.
 * @returns {string} The truncated ID.
 */
function truncateId(id) {
    if (typeof id !== 'string' || id.length <= 10) {
        return id;
    }
    return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

/**
 * Capitalizes specific words in the details string.
 * @param {string} details The details string.
 * @returns {string} The formatted string.
 */
function formatDetails(details) {
    if (typeof details !== 'string') return details;
    return details
        .replace(/bank transfer/gi, 'Bank Transfer')
        .replace(/crypto/gi, 'Crypto');
}

/**
 * Returns Tailwind CSS classes and an icon for a given transaction status.
 * @param {string} status - The transaction status (e.g., 'approved', 'pending').
 * @returns {{badge: string, text: string}}
 */
function getStatusLook(status) {
    status = status.toLowerCase();
    switch (status) {
        case 'approved':
            return { badge: 'bg-green-100 text-green-800', text: 'text-green-400' };
        case 'pending':
            return { badge: 'bg-yellow-100 text-yellow-800', text: 'text-yellow-400' };
        case 'declined':
            return { badge: 'bg-red-100 text-red-800', text: 'text-red-400' };
        default:
            return { badge: 'bg-gray-200 text-gray-800', text: 'text-gray-400' };
    }
}

/**
 * Returns the HTML for a transaction type icon.
 * @param {string} type - The transaction type ('deposit' or 'withdrawal').
 * @returns {string} HTML string for the icon.
 */
function getTypeIcon(type) {
    const iconStyles = 'width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    if (type.toLowerCase() === 'deposit') {
        return `<div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">
                  <svg ${iconStyles}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                </div>`;
    }
    if (type.toLowerCase() === 'withdrawal') {
         return `<div class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
                  <svg ${iconStyles}><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                </div>`;
    }
    return `<div class="w-8 h-8 rounded-full bg-gray-100"></div>`;
}

/**
 * Capitalizes the first letter of a string.
 * @param {string} s The string to capitalize.
 * @returns {string}
 */
function capitalize(s) {
    if (typeof s !== 'string') return ''
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

// --- DOM RENDERING --- //

/**
 * Renders a single page of transactions.
 */
async function renderPage() {
    const desktopTbody = document.getElementById(DESKTOP_TBODY_ID);
    const mobileContainer = document.getElementById(MOBILE_CARDS_ID);
    const skeleton = document.getElementById(SKELETON_ID);
    const noTransactionsMessage = document.getElementById(NO_TRANSACTIONS_ID);
    const paginationContainer = document.getElementById(PAGINATION_ID);
    const countContainer = document.getElementById(COUNT_CONTAINER_ID);

    skeleton.classList.add('hidden');

    if (filteredTransactions.length === 0) {
        noTransactionsMessage.classList.remove('hidden');
        desktopTbody.innerHTML = '';
        mobileContainer.innerHTML = '';
        paginationContainer.classList.add('hidden');
        countContainer.classList.add('hidden');
        return;
    }

    noTransactionsMessage.classList.add('hidden');
    desktopTbody.innerHTML = '';
    mobileContainer.innerHTML = '';

    const paginatedItems = filteredTransactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    for (const tx of paginatedItems) {
        const { badge, text: amountColor } = getStatusLook(tx.status);
        const typeIcon = getTypeIcon(tx.transaction_type);
        
        const txDate = new Date(tx.transaction_date);
        const displayDate = txDate.toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
        const time = txDate.toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true
        });

        const isDeposit = tx.transaction_type.toLowerCase() === 'deposit';
        const formattedAmount = `${isDeposit ? '+' : '-'}${await formatCurrency(Math.abs(Number(tx.amount)))}`;
        const truncatedId = truncateId(tx.transaction_id.toUpperCase());
        const formattedDetails = formatDetails(tx.details);
        const displayType = capitalize(tx.transaction_type);

        // Create Desktop Row
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-700 hover:bg-gray-700/50 transition-colors';
        row.innerHTML = `
            <td class="px-6 py-4"><div class="font-medium text-white">${truncatedId}</div></td>
            <td class="px-6 py-4"><div class="flex items-center gap-2">${typeIcon.replace(/w-8 h-8/, 'w-6 h-6')} <span class="text-white">${displayType}</span></div></td>
            <td class="px-6 py-4 text-gray-300">${formattedDetails}</td>
            <td class="px-6 py-4"><div class="text-white">${displayDate}</div><div class="text-xs text-gray-400">${time}</div></td>
            <td class="px-6 py-4"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge}">${tx.status}</span></td>
            <td class="px-6 py-4"><div class="font-medium ${isDeposit ? 'text-green-400' : 'text-red-400'}">${formattedAmount}</div></td>
            <td class="px-6 py-4"><button class="text-blue-400 hover:text-blue-300 text-sm font-medium">View Details</button></td>
        `;
        desktopTbody.appendChild(row);

        // Create Mobile Card
        const card = document.createElement('div');
        card.className = 'bg-gray-700 rounded-lg p-4';
        card.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-3">
                    ${typeIcon}
                    <div>
                        <div class="font-semibold text-white text-base">${displayType}</div>
                        <div class="text-xs text-gray-400">${truncatedId}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-lg font-semibold ${isDeposit ? 'text-green-400' : 'text-red-400'}">${formattedAmount}</div>
                    <span class="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium ${badge}">${tx.status}</span>
                </div>
            </div>
            <div class="border-t border-gray-600 pt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                    <div class="text-xs text-gray-400">${tx.transaction_type.toLowerCase() === 'withdrawal' ? 'Beneficiary' : 'Method'}</div>
                    <div class="text-sm text-white font-medium">${formattedDetails}</div>
                </div>
                <div>
                    <div class="text-xs text-gray-400">Date</div>
                    <div class="text-sm text-white font-medium">${displayDate}</div>
                </div>
            </div>
        `;
        mobileContainer.appendChild(card);
    }

    renderPagination(countContainer, paginationContainer);
}

/**
 * Renders pagination controls.
 */
function renderPagination(countContainer, paginationContainer) {
    countContainer.classList.remove('hidden');
    paginationContainer.classList.remove('hidden');
    const totalItems = filteredTransactions.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

    countContainer.innerHTML = `
        <span>Showing</span>
        <span class="text-white font-medium">${startItem}-${endItem}</span>
        <span>of</span>
        <span class="text-white font-medium">${totalItems}</span>
        <span>transactions</span>
    `;

    paginationContainer.innerHTML = `
        <div class="text-sm text-gray-400 lg:hidden">
            Showing <span class="text-white font-medium">${startItem}</span> to <span class="text-white font-medium">${endItem}</span> of <span class="text-white font-medium">${totalItems}</span> results
        </div>
        <div class="flex items-center gap-2">
            <button id="prev-page" class="px-3 py-2 text-sm border border-gray-600 text-gray-400 rounded-md hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${currentPage === 1 ? 'disabled' : ''}>
                Previous
            </button>
            <span class="text-sm text-gray-400 hidden sm:inline">Page ${currentPage} of ${totalPages}</span>
            <button id="next-page" class="px-3 py-2 text-sm border border-gray-600 text-gray-400 rounded-md hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${currentPage === totalPages ? 'disabled' : ''}>
                Next
            </button>
        </div>
    `;

    document.getElementById('prev-page')?.addEventListener('click', async () => {
        if (currentPage > 1) {
            currentPage--;
            await renderPage();
        }
    });

    document.getElementById('next-page')?.addEventListener('click', async () => {
        if (currentPage < totalPages) {
            currentPage++;
            await renderPage();
        }
    });
}

/**
 * Filters transactions based on form input.
 */
async function applyFilters() {
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;
    const type = document.getElementById('type-select').value;
    const status = document.getElementById('status-select').value;
    const search = document.getElementById('search-input').value.toLowerCase();

    filteredTransactions = allTransactions.filter(tx => {
        const txDate = new Date(tx.transaction_date);
        const fromDate = dateFrom ? new Date(dateFrom) : null;
        const toDate = dateTo ? new Date(dateTo) : null;
        if(fromDate) fromDate.setHours(0,0,0,0);
        if(toDate) toDate.setHours(23,59,59,999);

        return (!fromDate || txDate >= fromDate) &&
               (!toDate || txDate <= toDate) &&
               (!type || tx.transaction_type.toLowerCase() === type) &&
               (!status || tx.status.toLowerCase() === status) &&
               (!search || tx.transaction_id.toLowerCase().includes(search) || tx.details.toLowerCase().includes(search));
    });
    
    currentPage = 1;
    await renderPage();
}

/**
 * Resets all filters and displays all transactions.
 */
async function resetFilters() {
    const form = document.getElementById('filter-form');
    if (form) {
        form.reset();
    }
    await applyFilters();
}

// --- INITIALIZATION --- //

async function initializePage() {
    try {
        const { data, error } = await supabase.functions.invoke('get-transaction-history');
        if (error) throw error;
        
        allTransactions = data.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
        filteredTransactions = allTransactions;
        await renderPage();
        
        const form = document.getElementById('filter-form');
        if (form) {
            form.addEventListener('submit', (e) => e.preventDefault());

            const filterControls = ['date-from', 'date-to', 'type-select', 'status-select'];
            filterControls.forEach(id => {
                document.getElementById(id)?.addEventListener('input', applyFilters);
            });
            
            document.getElementById('reset-filters-btn')?.addEventListener('click', resetFilters);
        }

    } catch (error) {
        console.error('Error fetching transaction history:', error.message);
        document.getElementById(SKELETON_ID).classList.add('hidden');
        const noTransactionsMessage = document.getElementById(NO_TRANSACTIONS_ID);
        noTransactionsMessage.classList.remove('hidden');
        noTransactionsMessage.querySelector('h3').textContent = 'Failed to load data';
        noTransactionsMessage.querySelector('p').textContent = 'Could not retrieve transaction history. Please refresh the page or try again later.';
        noTransactionsMessage.querySelector('a').classList.add('hidden');
    }

}

document.addEventListener('DOMContentLoaded', initializePage);