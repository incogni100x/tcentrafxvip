import { supabase } from './client.js';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import { initializeLockedSavingsActions, initializeEarlyClosureActions } from './locked-savings-action.js';

function initializePage() {
    const plansGrid = document.getElementById('plans-grid');
    const activeTbody = document.getElementById('active-deposits-tbody');
    const activeCards = document.getElementById('active-deposits-cards');
    const historicalTbody = document.getElementById('historical-deposits-tbody');
    const historicalCards = document.getElementById('historical-deposits-cards');

    function renderSkeletons() {
        if (!plansGrid) return;
        plansGrid.innerHTML = '';
        const skeletonHTML = `
            <div class="bg-gray-700/50 rounded-xl p-6 border border-gray-700 animate-pulse">
                <div class="h-6 bg-gray-600 rounded w-3/4 mb-2"></div>
                <div class="h-4 bg-gray-600 rounded w-1/2 mb-6"></div>
                <div class="space-y-3">
                    <div class="flex justify-between">
                        <div class="h-4 bg-gray-600 rounded w-1/4"></div>
                        <div class="h-4 bg-gray-600 rounded w-1/4"></div>
                    </div>
                    <div class="flex justify-between">
                        <div class="h-4 bg-gray-600 rounded w-1/4"></div>
                        <div class="h-4 bg-gray-600 rounded w-1/4"></div>
                    </div>
                     <div class="flex justify-between">
                        <div class="h-4 bg-gray-600 rounded w-1/4"></div>
                        <div class="h-4 bg-gray-600 rounded w-1/4"></div>
                    </div>
                </div>
                <div class="h-10 bg-gray-600 rounded-lg mt-6"></div>
            </div>
        `;
        for (let i = 0; i < 3; i++) {
            plansGrid.innerHTML += skeletonHTML;
        }
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
    }

    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    function renderSummaryCards(data) {
        const principalEl = document.getElementById('total-principal-value');
        const interestEl = document.getElementById('interest-earned-value');
        const activeCountEl = document.getElementById('active-deposits-value');

        // Helper to toggle visibility
        const show = (el) => el.classList.remove('hidden');
        const hide = (el) => el.classList.add('hidden');

        if (principalEl) {
            principalEl.textContent = formatCurrency(data.total_principal);
            show(document.getElementById('total-principal-content'));
            hide(document.getElementById('total-principal-skeleton'));
        }
        if (interestEl) {
            interestEl.textContent = formatCurrency(data.total_interest_earned);
            show(document.getElementById('interest-earned-content'));
            hide(document.getElementById('interest-earned-skeleton'));
        }
        if (activeCountEl) {
            activeCountEl.textContent = data.active_deposits_count;
            show(document.getElementById('active-deposits-content'));
            hide(document.getElementById('active-deposits-skeleton'));
        }
    }

    function renderActiveSavings(savings) {
        activeTbody.innerHTML = '';
        activeCards.innerHTML = '';
        document.getElementById('deposits-count').textContent = `${savings.length} Active Deposit(s)`;

        if (savings.length === 0) {
            const emptyRow = `<tr><td colspan="7" class="text-center py-8 text-gray-400">No active savings plans.</td></tr>`;
            const emptyCard = `<div class="text-center py-8 text-gray-400">No active savings plans.</div>`;
            activeTbody.innerHTML = emptyRow;
            activeCards.innerHTML = emptyCard;
            return;
        }

        savings.forEach(saving => {
            const statusBadge = `<span class="px-2 py-1 text-xs font-medium rounded-full bg-green-900 text-green-300">Active</span>`;
            
            const tableRow = `
                <tr class="border-b border-gray-700 hover:bg-gray-700/50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <div class="font-medium text-white">${saving.plan_name}</div>
                        <div class="text-xs text-gray-400">LS-${saving.id.substring(0,8).toUpperCase()}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-white">${formatCurrency(saving.amount)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-green-400">${saving.interest_rate_weekly}%</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${formatDate(saving.start_date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${formatDate(saving.end_date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${statusBadge}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <button class="text-yellow-400 hover:text-yellow-300 early-closure-btn" data-lock-id="${saving.id}">Early Closure</button>
                    </td>
                </tr>`;

            const startDate = new Date(saving.start_date);
            const endDate = new Date(saving.end_date);
            const totalDuration = endDate.getTime() - startDate.getTime();
            const elapsedDuration = new Date().getTime() - startDate.getTime();
            const progress = Math.max(0, Math.min(100, (elapsedDuration / totalDuration) * 100));

            const card = `
                <div class="bg-gray-800/80 rounded-xl p-5 border border-gray-700 space-y-4">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-bold text-lg text-white">${saving.plan_name}</h4>
                            <p class="text-xs text-gray-400">ID: LS-${saving.id.substring(0,8).toUpperCase()}</p>
                        </div>
                        ${statusBadge}
                    </div>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p class="text-gray-400">Principal</p>
                            <p class="font-semibold text-lg text-white">${formatCurrency(saving.amount)}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-gray-400">Weekly Interest</p>
                            <p class="font-semibold text-lg text-green-400">${saving.interest_rate_weekly}%</p>
                        </div>
                    </div>
                    <div>
                        <div class="flex justify-between text-xs text-gray-400 mb-1">
                            <span>${formatDate(saving.start_date)}</span>
                            <span>${formatDate(saving.end_date)}</span>
                        </div>
                        <div class="w-full bg-gray-700 rounded-full h-2">
                            <div class="bg-green-500 h-2 rounded-full" style="width: ${progress.toFixed(2)}%"></div>
                        </div>
                    </div>
                    <button class="w-full mt-2 text-center py-2.5 bg-yellow-600/20 text-yellow-400 rounded-lg hover:bg-yellow-600/40 font-semibold early-closure-btn" data-lock-id="${saving.id}">
                        Request Early Closure
                    </button>
                </div>`;
            
            activeTbody.innerHTML += tableRow;
            activeCards.innerHTML += card;
        });
    }

    function renderHistoricalSavings(savings) {
        historicalTbody.innerHTML = '';
        historicalCards.innerHTML = '';
        
        if (savings.length === 0) {
            const emptyRow = `<tr><td colspan="5" class="text-center py-8 text-gray-400">No historical savings.</td></tr>`;
            const emptyCard = `<div class="text-center py-8 text-gray-400">No historical savings.</div>`;
            historicalTbody.innerHTML = emptyRow;
            historicalCards.innerHTML = emptyCard;
            return;
        }

        savings.forEach(saving => {
            const statusColors = {
                pending_closure: 'bg-yellow-900 text-yellow-300',
                closed_early: 'bg-red-900 text-red-300',
                completed: 'bg-blue-900 text-blue-300'
            };
            const statusBadge = `<span class="px-2 py-1 text-xs font-medium rounded-full ${statusColors[saving.status] || 'bg-gray-700'}">${saving.status.replace('_', ' ')}</span>`;

            const tableRow = `
                 <tr class="border-b border-gray-700 hover:bg-gray-700/50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">LS-${saving.id.substring(0,8).toUpperCase()}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-white">${formatCurrency(saving.amount)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${formatDate(saving.end_date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${statusBadge}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-white">${formatCurrency(saving.final_amount_to_pay)}</td>
                </tr>`;
            
            const card = `
                <div class="bg-gray-700/50 rounded-lg p-4 space-y-3">
                     <div class="flex justify-between items-center">
                        <span class="font-bold text-white">LS-${saving.id.substring(0,8).toUpperCase()}</span>
                        ${statusBadge}
                    </div>
                    <div class="flex justify-between"><span class="text-gray-400">Principal:</span> <span class="text-white">${formatCurrency(saving.amount)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">Concluded:</span> <span class="text-gray-300">${formatDate(saving.end_date)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">Amount Paid:</span> <span class="text-white font-bold">${formatCurrency(saving.final_amount_to_pay)}</span></div>
                </div>
            `;
            
            historicalTbody.innerHTML += tableRow;
            historicalCards.innerHTML += card;
        });
    }

    function renderPlans(plans) {
        if (!plansGrid) return;
        plansGrid.innerHTML = '';
        if (!plans || plans.length === 0) {
            plansGrid.innerHTML = `<p class="text-gray-400 col-span-full text-center">No savings plans are currently available.</p>`;
            return;
        }
        plans.forEach(plan => {
            const card = document.createElement('div');
            card.className = 'bg-gray-800/80 rounded-xl p-6 flex flex-col border border-gray-700 hover:border-blue-500 transition-all duration-300';
            card.innerHTML = `
                <div class="flex-grow">
                    <h3 class="text-xl font-bold text-white">${plan.plan_name}</h3>
                    <p class="text-green-400 font-semibold mb-4">${plan.interest_rate_weekly}% <span class="text-sm font-normal text-gray-400">weekly interest</span></p>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between"><span class="text-gray-400">Duration:</span><span class="font-medium text-white">${plan.duration_days} days</span></div>
                        <div class="flex justify-between"><span class="text-gray-400">Min. Deposit:</span><span class="font-medium text-white">${formatCurrency(plan.min_amount)}</span></div>
                        <div class="flex justify-between"><span class="text-gray-400">Max. Deposit:</span><span class="font-medium text-white">${formatCurrency(plan.max_amount)}</span></div>
                    </div>
                </div>
                <button class="mt-6 w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-semibold select-plan-btn" data-plan-id="${plan.id}">Select Plan</button>
            `;
            plansGrid.appendChild(card);
        });
        initializeLockedSavingsActions(plans);
    }

    async function fetchPageData() {
        // Fetch plans for the top section
        const plansPromise = supabase.from('locked_savings_plans').select('*').eq('is_active', true).order('duration_days', { ascending: true });
        // Fetch summary, active, and historical data
        const summaryPromise = supabase.functions.invoke('get-locked-savings-data');

        renderSkeletons();

        const [plansResult, summaryResult] = await Promise.all([plansPromise, summaryPromise]);

        if (plansResult.error) {
            console.error("Error fetching savings plans:", plansResult.error);
            Toastify({ text: "Failed to load savings plans.", duration: 3000, style: { background: "red" } }).showToast();
        } else {
            renderPlans(plansResult.data);
        }

        if (summaryResult.error) {
            console.error("Error fetching summary data:", summaryResult.error);
            Toastify({ text: "Failed to load your savings summary.", duration: 3000, style: { background: "red" } }).showToast();
        } else {
            renderSummaryCards(summaryResult.data);
            renderActiveSavings(summaryResult.data.active_deposits);
            renderHistoricalSavings(summaryResult.data.historical_deposits);
            initializeEarlyClosureActions();
        }
    }
    
    // Initial skeleton rendering for plans is now in fetchPageData
    // We just need to remove the old call to fetchPlans
    fetchPageData();
}

// Wait for the header to confirm a valid session before initializing the page.
document.addEventListener('profile-loaded', initializePage); 