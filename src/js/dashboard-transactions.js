import { supabase } from './client.js';

// --- HELPERS (for consistency with transaction-history.js) ---

function getStatusLook(status) {
    status = status ? status.toLowerCase() : '';
    switch (status) {
        case 'approved': return { badge: 'bg-green-100 text-green-800' };
        case 'pending': return { badge: 'bg-yellow-100 text-yellow-800' };
        case 'declined': return { badge: 'bg-red-100 text-red-800' };
        default: return { badge: 'bg-gray-200 text-gray-800' };
    }
}

function formatDetails(details) {
    if (typeof details !== 'string') return details;
    return details
        .replace(/bank transfer/gi, 'Bank Transfer')
        .replace(/crypto/gi, 'Crypto');
}

function truncateId(id) {
    if (typeof id !== 'string' || id.length <= 10) {
        return id;
    }
    return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

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

function capitalize(s) {
    if (typeof s !== 'string') return ''
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

// --- MAIN FUNCTION --- //

async function renderRecentTransactions() {
    const desktopTbody = document.getElementById('transactions-tbody-desktop');
    const mobileContainer = document.getElementById('transactions-cards-mobile');
    const skeleton = document.getElementById('recent-transactions-skeleton');
    const noTransactionsMessage = document.getElementById('no-recent-transactions-message');

    // Make sure all required elements exist before proceeding
    if (!desktopTbody || !mobileContainer || !skeleton || !noTransactionsMessage) {
        console.error('Dashboard transaction elements not found.');
        return;
    }

    // Clear any existing data to prevent duplicates
    desktopTbody.innerHTML = '';
    mobileContainer.innerHTML = '';

    try {
        const { data, error } = await supabase.functions.invoke('get-transaction-history');
        if (error) throw error;

        // Hide skeleton loader
        skeleton.classList.add('hidden');

        const recentTransactions = data.slice(0, 5);

        if (recentTransactions.length === 0) {
            noTransactionsMessage.classList.remove('hidden');
            return;
        }

        recentTransactions.forEach(tx => {
            const { badge } = getStatusLook(tx.status);
            const txDate = new Date(tx.transaction_date);
            const displayDate = txDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            
            const isDeposit = tx.transaction_type.toLowerCase() === 'deposit';
            const formattedAmount = `${isDeposit ? '+' : '-'}$${Math.abs(Number(tx.amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const formattedDetails = formatDetails(tx.details);
            const truncatedId = truncateId(tx.transaction_id?.toUpperCase());
            const typeIcon = getTypeIcon(tx.transaction_type);
            const displayType = capitalize(tx.transaction_type);

            // Create Desktop Row
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700/50 hover:bg-gray-700/50';
            row.innerHTML = `
                <td class="px-3 py-4 text-sm text-white">${displayType}</td>
                <td class="px-3 py-4 text-sm text-gray-300">${formattedDetails}</td>
                <td class="px-3 py-4 text-sm text-gray-400">${displayDate}</td>
                <td class="px-3 py-4 text-sm font-medium ${isDeposit ? 'text-green-400' : 'text-red-400'}">${formattedAmount}</td>
                <td class="px-3 py-4 text-sm">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge}">${tx.status}</span>
                </td>
            `;
            desktopTbody.appendChild(row);

            // Create Mobile Card
            const card = document.createElement('div');
            card.className = 'bg-gray-700/50 rounded-lg p-4';
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
        });

    } catch (error) {
        console.error('Error fetching recent transactions:', error);
        if(skeleton) skeleton.classList.add('hidden');
        if(noTransactionsMessage) {
            noTransactionsMessage.classList.remove('hidden');
            noTransactionsMessage.querySelector('p').textContent = 'Could not load transactions.';
        }
    }
}

// Listen for the 'profile-loaded' event dispatched by header.js
// to ensure we only fetch when a valid session is confirmed and cached.
document.addEventListener('profile-loaded', () => {
    renderRecentTransactions();
});
