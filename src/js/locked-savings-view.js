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

    function formatCurrency(amount, currencyCode = 'USD') {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount || 0);
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

    function renderActiveSavings(savings, userCurrency = 'USD') {
        activeTbody.innerHTML = '';
        activeCards.innerHTML = '';
        document.getElementById('deposits-count').textContent = `${savings.length} Active Membership(s)`;

        if (savings.length === 0) {
            const emptyRow = `<tr><td colspan="8" class="text-center py-8 text-gray-400">No active membership plans.</td></tr>`;
            const emptyCard = `<div class="text-center py-8 text-gray-400">No active membership plans.</div>`;
            activeTbody.innerHTML = emptyRow;
            activeCards.innerHTML = emptyCard;
            return;
        }

        savings.forEach(saving => {
            const statusBadge = `<span class="px-2 py-1 text-xs font-medium rounded-full bg-green-900 text-green-300">Active</span>`;
            
            const tableRow = `
                <tr class="border-b border-gray-700 hover:bg-gray-700/50">
                    <td class="px-6 py-4 text-sm">
                        <div class="font-medium text-white break-words max-w-[200px]">${saving.plan_name}</div>
                        <div class="text-xs text-gray-400 mt-1">MB-${saving.id.substring(0,8).toUpperCase()}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-white">${formatCurrency(saving.amount, userCurrency)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-green-400">${saving.weekly_interest_rate}%</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${saving.duration_months} months</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${formatDate(saving.start_date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${formatDate(saving.end_date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${statusBadge}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <div class="flex flex-col gap-1">
                            <button class="text-blue-400 hover:text-blue-300 text-xs font-medium topup-btn transition-colors" data-membership-id="${saving.id}">
                                <span class="flex items-center gap-1 pointer-events-none">
                                    <svg class="w-3 h-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                    Top Up
                                </span>
                            </button>
                            <button class="text-yellow-400 hover:text-yellow-300 text-xs font-medium early-closure-btn transition-colors" data-lock-id="${saving.id}">
                                <span class="flex items-center gap-1 pointer-events-none">
                                    <svg class="w-3 h-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    Early Close
                                </span>
                            </button>
                        </div>
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
                            <p class="text-xs text-gray-400">ID: MB-${saving.id.substring(0,8).toUpperCase()}</p>
                        </div>
                        ${statusBadge}
                    </div>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p class="text-gray-400">Investment</p>
                            <p class="font-semibold text-lg text-white">${formatCurrency(saving.amount, userCurrency)}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-gray-400">Weekly Interest</p>
                            <p class="font-semibold text-lg text-green-400">${saving.weekly_interest_rate}%</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p class="text-gray-400">Duration</p>
                            <p class="font-semibold text-white">${saving.duration_months} months</p>
                        </div>
                        <div class="text-right">
                            <p class="text-gray-400">Top-ups</p>
                            <p class="font-semibold text-white">${formatCurrency(saving.total_topups || 0, userCurrency)}</p>
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
                    <div class="flex gap-2">
                        <button class="flex-1 text-center py-2.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40 font-semibold topup-btn" data-membership-id="${saving.id}">
                            Top Up
                        </button>
                        <button class="flex-1 text-center py-2.5 bg-yellow-600/20 text-yellow-400 rounded-lg hover:bg-yellow-600/40 font-semibold early-closure-btn" data-lock-id="${saving.id}">
                            Early Closure
                        </button>
                    </div>
                </div>`;
            
            activeTbody.innerHTML += tableRow;
            activeCards.innerHTML += card;
        });
    }

    function renderHistoricalSavings(savings, userCurrency = 'USD') {
        historicalTbody.innerHTML = '';
        historicalCards.innerHTML = '';
        
        if (savings.length === 0) {
            const emptyRow = `<tr><td colspan="5" class="text-center py-8 text-gray-400">No historical memberships.</td></tr>`;
            const emptyCard = `<div class="text-center py-8 text-gray-400">No historical memberships.</div>`;
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
                 <tr class="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">MB-${saving.id.substring(0,8).toUpperCase()}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-white">${formatCurrency(saving.amount, userCurrency)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${formatDate(saving.end_date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${statusBadge}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-white">${formatCurrency(saving.final_amount_to_pay, userCurrency)}</td>
                </tr>`;
            
            const card = `
                <div class="bg-gray-700/50 rounded-lg p-4 space-y-3">
                     <div class="flex justify-between items-center">
                        <span class="font-bold text-white">MB-${saving.id.substring(0,8).toUpperCase()}</span>
                        ${statusBadge}
                    </div>
                    <div class="flex justify-between"><span class="text-gray-400">Investment:</span> <span class="text-white">${formatCurrency(saving.amount, userCurrency)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">Concluded:</span> <span class="text-gray-300">${formatDate(saving.end_date)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">Final Payout:</span> <span class="text-white font-bold">${formatCurrency(saving.final_amount_to_pay, userCurrency)}</span></div>
                </div>
            `;
            
            historicalTbody.innerHTML += tableRow;
            historicalCards.innerHTML += card;
        });
    }

    function renderPlans(plans, userCurrency = 'USD') {
        if (!plansGrid) return;
        plansGrid.innerHTML = '';
        if (!plans || plans.length === 0) {
            plansGrid.innerHTML = `<p class="text-gray-400 col-span-full text-center">No membership plans are currently available.</p>`;
            return;
        }
        plans.forEach(plan => {
            const card = document.createElement('div');
            card.className = 'bg-gray-800/80 rounded-xl p-6 flex flex-col border border-gray-700 hover:border-blue-500 transition-all duration-300';
            const maxAmountText = plan.max_amount ? formatCurrency(plan.max_amount, userCurrency) : 'No Limit';
            card.innerHTML = `
                <div class="flex-grow">
                    <h3 class="text-xl font-bold text-white">${plan.plan_name}</h3>
                    <p class="text-green-400 font-semibold mb-4">${plan.weekly_interest_rate}% <span class="text-sm font-normal text-gray-400">weekly interest</span></p>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between"><span class="text-gray-400">Duration:</span><span class="font-medium text-white">${plan.min_months}-${plan.max_months} months</span></div>
                        <div class="flex justify-between"><span class="text-gray-400">Min. Investment:</span><span class="font-medium text-white">${formatCurrency(plan.min_amount, userCurrency)}</span></div>
                        <div class="flex justify-between"><span class="text-gray-400">Max. Investment:</span><span class="font-medium text-white">${maxAmountText}</span></div>
                    </div>
                </div>
                <button class="mt-6 w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-semibold select-plan-btn" data-plan-id="${plan.id}">Select Plan</button>
            `;
            plansGrid.appendChild(card);
        });
        initializeLockedSavingsActions(plans);
    }

    async function fetchPageData() {
        // Get user profile to get currency
        const { data: profile } = await supabase.from('profiles').select('currency_code').single();
        const userCurrency = profile?.currency_code || 'USD';

        // Fetch plans for the top section
        const plansPromise = supabase.from('membership_plans').select('*').eq('is_active', true).order('min_amount', { ascending: true });
        // Fetch summary, active, and historical data
        const summaryPromise = supabase.functions.invoke('get-membership-data');

        renderSkeletons();

        const [plansResult, summaryResult] = await Promise.all([plansPromise, summaryPromise]);

        if (plansResult.error) {
            console.error("Error fetching membership plans:", plansResult.error);
            Toastify({ 
                text: "Failed to load membership plans.", 
                duration: 3000, 
                gravity: "top",
                position: "center",
                style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } 
            }).showToast();
        } else {
            renderPlans(plansResult.data, userCurrency);
        }

        if (summaryResult.error) {
            console.error("Error fetching summary data:", summaryResult.error);
            Toastify({ 
                text: "Failed to load your membership summary.", 
                duration: 3000, 
                gravity: "top",
                position: "center",
                style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } 
            }).showToast();
        } else if (summaryResult.data) {
            renderSummaryCards(summaryResult.data);
            const activeSavings = summaryResult.data.active_memberships || [];
            const historicalSavings = summaryResult.data.historical_memberships || [];
            
            renderActiveSavings(activeSavings, userCurrency);
            renderHistoricalSavings(historicalSavings, userCurrency);
            initializeEarlyClosureActions(activeSavings);
        }
    }
    
    // Initial skeleton rendering for plans is now in fetchPageData
    // We just need to remove the old call to fetchPlans
    fetchPageData();
}

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = '/login.html';
        return;
    }
    initializePage();
}); 