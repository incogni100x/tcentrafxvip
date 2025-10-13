import { supabase } from './client.js';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import { initializeLockedSavingsActions, initializeEarlyClosureActions } from './locked-savings-action.js';
import { formatCurrency, getUserCurrency } from './session.js';

async function initializePage() {
    const plansGrid = document.getElementById('plans-grid');
    const activeTbody = document.getElementById('active-deposits-tbody');
    const activeCards = document.getElementById('active-deposits-cards');
    const historicalTbody = document.getElementById('historical-deposits-tbody');
    const historicalCards = document.getElementById('historical-deposits-cards');

    function renderSkeletons() {
        if (!plansGrid) return;
        plansGrid.innerHTML = '';
        const skeletonHTML = `
            <div class="bg-white border border-gray-200 rounded-xl p-6 animate-pulse">
                <div class="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div class="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
                <div class="space-y-3">
                    <div class="flex justify-between">
                        <div class="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div class="h-4 bg-gray-200 rounded w-1/4"></div>
                    </div>
                    <div class="flex justify-between">
                        <div class="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div class="h-4 bg-gray-200 rounded w-1/4"></div>
                    </div>
                     <div class="flex justify-between">
                        <div class="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div class="h-4 bg-gray-200 rounded w-1/4"></div>
                    </div>
                </div>
                <div class="h-10 bg-gray-200 rounded-lg mt-6"></div>
            </div>
        `;
        for (let i = 0; i < 3; i++) {
            plansGrid.innerHTML += skeletonHTML;
        }
    }


    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    async function renderSummaryCards(data) {
        const principalEl = document.getElementById('total-principal-value');
        const interestEl = document.getElementById('interest-earned-value');
        const activeCountEl = document.getElementById('active-deposits-value');

        // Helper to toggle visibility
        const show = (el) => el.classList.remove('hidden');
        const hide = (el) => el.classList.add('hidden');

        if (principalEl) {
            principalEl.textContent = await formatCurrency(data.total_principal);
            show(document.getElementById('total-principal-content'));
            hide(document.getElementById('total-principal-skeleton'));
        }
        if (interestEl) {
            interestEl.textContent = await formatCurrency(data.total_interest_earned);
            show(document.getElementById('interest-earned-content'));
            hide(document.getElementById('interest-earned-skeleton'));
        }
        if (activeCountEl) {
            activeCountEl.textContent = data.active_deposits_count;
            show(document.getElementById('active-deposits-content'));
            hide(document.getElementById('active-deposits-skeleton'));
        }
    }

    async function renderActiveSavings(savings, userCurrency = 'USD') {
        activeTbody.innerHTML = '';
        activeCards.innerHTML = '';
        document.getElementById('deposits-count').textContent = `${savings.length} Active Membership(s)`;

        if (savings.length === 0) {
            const emptyRow = `<tr><td colspan="8" class="text-center py-8 text-gray-600">No active membership plans.</td></tr>`;
            const emptyCard = `<div class="text-center py-8 text-gray-600">No active membership plans.</div>`;
            activeTbody.innerHTML = emptyRow;
            activeCards.innerHTML = emptyCard;
            return;
        }

        for (const saving of savings) {
            const statusBadge = `<span class="px-2 py-1 text-xs font-medium rounded-full bg-green-900 text-green-300">Active</span>`;
            
            const tableRow = `
                <tr class="border-b border-gray-200 hover:bg-gray-100">
                    <td class="px-6 py-4 text-sm">
                        <div class="font-medium text-gray-900 break-words max-w-[200px]">${saving.plan_name}</div>
                        <div class="text-xs text-gray-600 mt-1">MB-${saving.id.substring(0,8).toUpperCase()}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${await formatCurrency(saving.amount, userCurrency)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-green-400">${saving.weekly_interest_rate}%</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${saving.duration_months} months</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(saving.start_date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(saving.end_date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${statusBadge}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <div class="flex flex-col gap-1">
                            <button class="text-[#009296] hover:text-[#007a7e] text-xs font-medium topup-btn transition-colors" data-membership-id="${saving.id}">
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
                <div class="bg-white border border-gray-200/80 rounded-xl p-5 border border-gray-200 space-y-4">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-bold text-lg text-gray-900">${saving.plan_name}</h4>
                            <p class="text-xs text-gray-600">ID: MB-${saving.id.substring(0,8).toUpperCase()}</p>
                        </div>
                        ${statusBadge}
                    </div>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p class="text-gray-600">Investment</p>
                            <p class="font-semibold text-lg text-gray-900">${await formatCurrency(saving.amount, userCurrency)}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-gray-600">Weekly Interest</p>
                            <p class="font-semibold text-lg text-green-400">${saving.weekly_interest_rate}%</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p class="text-gray-600">Duration</p>
                            <p class="font-semibold text-gray-900">${saving.duration_months} months</p>
                        </div>
                        <div class="text-right">
                            <p class="text-gray-600">Top-ups</p>
                            <p class="font-semibold text-gray-900">${await formatCurrency(saving.total_topups || 0, userCurrency)}</p>
                        </div>
                    </div>
                    <div>
                        <div class="flex justify-between text-xs text-gray-600 mb-1">
                            <span>${formatDate(saving.start_date)}</span>
                            <span>${formatDate(saving.end_date)}</span>
                        </div>
                        <div class="w-full bg-gray-100 rounded-full h-2">
                            <div class="bg-green-500 h-2 rounded-full" style="width: ${progress.toFixed(2)}%"></div>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button class="flex-1 text-center py-2.5 bg-[#009296] text-white rounded-lg hover:bg-[#007a7e] font-semibold topup-btn" data-membership-id="${saving.id}">
                            Top Up
                        </button>
                        <button class="flex-1 text-center py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-semibold early-closure-btn" data-lock-id="${saving.id}">
                            Early Closure
                        </button>
                    </div>
                </div>`;
            
            activeTbody.innerHTML += tableRow;
            activeCards.innerHTML += card;
        }
    }

    async function renderHistoricalSavings(savings, userCurrency = 'USD') {
        historicalTbody.innerHTML = '';
        historicalCards.innerHTML = '';
        
        if (savings.length === 0) {
            const emptyRow = `<tr><td colspan="5" class="text-center py-8 text-gray-600">No historical memberships.</td></tr>`;
            const emptyCard = `<div class="text-center py-8 text-gray-600">No historical memberships.</div>`;
            historicalTbody.innerHTML = emptyRow;
            historicalCards.innerHTML = emptyCard;
            return;
        }

        for (const saving of savings) {
            const statusColors = {
                pending_closure: 'bg-yellow-900 text-yellow-300',
                closed_early: 'bg-red-900 text-red-300',
                completed: 'bg-blue-900 text-blue-300'
            };
            const statusBadge = `<span class="px-2 py-1 text-xs font-medium rounded-full ${statusColors[saving.status] || 'bg-gray-100'}">${saving.status.replace('_', ' ')}</span>`;

            const tableRow = `
                 <tr class="border-b border-gray-200/50 hover:bg-gray-100 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">MB-${saving.id.substring(0,8).toUpperCase()}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${await formatCurrency(saving.amount, userCurrency)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(saving.end_date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${statusBadge}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${await formatCurrency(saving.final_amount_to_pay, userCurrency)}</td>
                </tr>`;
            
            const card = `
                <div class="bg-gray-100/50 rounded-lg p-4 space-y-3">
                     <div class="flex justify-between items-center">
                        <span class="font-bold text-gray-900">MB-${saving.id.substring(0,8).toUpperCase()}</span>
                        ${statusBadge}
                    </div>
                    <div class="flex justify-between"><span class="text-gray-600">Investment:</span> <span class="text-gray-900">${await formatCurrency(saving.amount, userCurrency)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-600">Concluded:</span> <span class="text-gray-500">${formatDate(saving.end_date)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-600">Final Payout:</span> <span class="text-gray-900 font-bold">${await formatCurrency(saving.final_amount_to_pay, userCurrency)}</span></div>
                </div>
            `;
            
            historicalTbody.innerHTML += tableRow;
            historicalCards.innerHTML += card;
        }
    }

    async function renderPlans(plans, userCurrency = 'USD') {
        if (!plansGrid) return;
        plansGrid.innerHTML = '';
        if (!plans || plans.length === 0) {
            plansGrid.innerHTML = `<p class="text-gray-600 col-span-full text-center">No membership plans are currently available.</p>`;
            return;
        }
        for (const plan of plans) {
            const card = document.createElement('div');
            card.className = 'bg-white border border-gray-200 rounded-xl p-6 flex flex-col hover:border-[#009296] transition-all duration-300';
            const maxAmountText = plan.max_amount ? await formatCurrency(plan.max_amount, userCurrency) : 'No Limit';
            card.innerHTML = `
                <div class="flex-grow">
                    <h3 class="text-xl font-bold text-gray-900">${plan.plan_name}</h3>
                    <p class="text-green-400 font-semibold mb-4">${plan.weekly_interest_rate}% <span class="text-sm font-normal text-gray-600">weekly interest</span></p>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between"><span class="text-gray-600">Duration:</span><span class="font-medium text-gray-900">${plan.min_months}-${plan.max_months} months</span></div>
                        <div class="flex justify-between"><span class="text-gray-600">Min. Investment:</span><span class="font-medium text-gray-900">${await formatCurrency(plan.min_amount, userCurrency)}</span></div>
                        <div class="flex justify-between"><span class="text-gray-600">Max. Investment:</span><span class="font-medium text-gray-900">${maxAmountText}</span></div>
                    </div>
                </div>
                <button class="mt-6 w-full bg-[#009296] text-white py-2.5 rounded-lg hover:bg-[#007a7e] transition-colors font-semibold select-plan-btn" data-plan-id="${plan.id}">Select Plan</button>
            `;
            plansGrid.appendChild(card);
        }
        initializeLockedSavingsActions(plans);
    }

    async function fetchPageData() {
        // Get user currency from session
        const userCurrency = await getUserCurrency();

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
            await renderPlans(plansResult.data, userCurrency);
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
            await renderSummaryCards(summaryResult.data);
            const activeSavings = summaryResult.data.active_memberships || [];
            const historicalSavings = summaryResult.data.historical_memberships || [];
            
            await renderActiveSavings(activeSavings, userCurrency);
            await renderHistoricalSavings(historicalSavings, userCurrency);
            await initializeEarlyClosureActions(activeSavings);
        }
    }
    
    // Initial skeleton rendering for plans is now in fetchPageData
    // We just need to remove the old call to fetchPlans
    await fetchPageData();
}

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = '/login';
        return;
    }
    initializePage();
}); 