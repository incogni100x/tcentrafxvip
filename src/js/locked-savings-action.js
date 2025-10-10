import { supabase } from './client.js';
import Toastify from 'toastify-js';

// DOM Elements for the modal
const createSavingModal = document.getElementById('create-saving-modal');
const closeModalButton = document.getElementById('close-create-saving-modal');
const createSavingForm = document.getElementById('create-saving-form');
const confirmButton = document.getElementById('confirm-create-saving');

// Modal fields
const modalPlanName = document.getElementById('modal-plan-name');
const modalPlanId = document.getElementById('modal-plan-id');
const modalPlanDuration = document.getElementById('modal-plan-duration');
const modalPlanInterest = document.getElementById('modal-plan-interest');
const modalPlanRange = document.getElementById('modal-plan-range');
const modalAmountInput = document.getElementById('modal-amount');
const modalAmountError = document.getElementById('modal-amount-error');
const modalMonthsInput = document.getElementById('modal-months');
const modalMonthsError = document.getElementById('modal-months-error');

// Top-up modal elements
const topupModal = document.getElementById('topup-modal');
const topupCloseButton = document.getElementById('close-topup-modal');
const topupForm = document.getElementById('topup-form');
const topupConfirmButton = document.getElementById('confirm-topup');
const topupAmountInput = document.getElementById('topup-amount');
const topupAmountError = document.getElementById('topup-amount-error');
const topupModeSelect = document.getElementById('topup-mode');
const topupMembershipId = document.getElementById('topup-membership-id');

// Other Overlays and Modals
const processingOverlay = document.getElementById('processing-overlay');
const successModal = document.getElementById('success-modal');
const insufficientModal = document.getElementById('insufficient-modal');
const topupSuccessModal = document.getElementById('topup-success-modal');
const earlyCloseInfoModal = document.getElementById('early-close-info-modal');
const earlyCloseCancelBtn = document.getElementById('early-close-info-modal-cancel');
const earlyCloseConfirmBtn = document.getElementById('early-close-info-modal-confirm');
const earlyCloseXBtn = document.getElementById('early-close-info-modal-close-x');

let allPlans = [];
let activeSavings = [];

let userCurrency = 'USD';

function formatCurrency(amount, currencyCode = userCurrency) {
    if (typeof amount !== 'number') {
        amount = 0;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount);
}

function showModal(plan) {
    if (!plan || !createSavingModal) return;

    modalPlanName.textContent = plan.plan_name;
    modalPlanId.value = plan.id;
    modalPlanDuration.textContent = `${plan.min_months}-${plan.max_months} months`;
    modalPlanInterest.textContent = `${plan.weekly_interest_rate}%`;
    const maxAmountText = plan.max_amount ? formatCurrency(plan.max_amount) : 'No Limit';
    modalPlanRange.textContent = `${formatCurrency(plan.min_amount)} - ${maxAmountText}`;
    modalAmountInput.min = plan.min_amount;
    if (plan.max_amount) modalAmountInput.max = plan.max_amount;
    modalAmountInput.value = '';
    modalAmountError.textContent = '';
    
    // Set up months input
    if (modalMonthsInput) {
        modalMonthsInput.min = plan.min_months;
        modalMonthsInput.max = plan.max_months;
        modalMonthsInput.value = plan.min_months;
        modalMonthsError.textContent = '';
    }
    
    confirmButton.disabled = false;
    
    createSavingModal.classList.remove('hidden', 'opacity-0');
    createSavingModal.classList.add('flex');
}

function hideModal() {
    if (!createSavingModal) return;
    createSavingModal.classList.add('hidden');
    createSavingModal.classList.remove('flex');
}

async function handleFormSubmit(event) {
    event.preventDefault();
    confirmButton.disabled = true;
    
    const planId = parseInt(modalPlanId.value, 10);
    const amount = parseFloat(modalAmountInput.value);
    const months = modalMonthsInput ? parseInt(modalMonthsInput.value, 10) : null;
    
    const plan = allPlans.find(p => p.id === planId);
    if (!plan) {
        Toastify({ text: "Selected plan not found.", duration: 3000, style: { background: "red" }}).showToast();
        confirmButton.disabled = false;
        return;
    }

    // Validate amount
    if (isNaN(amount) || amount < plan.min_amount || (plan.max_amount && amount > plan.max_amount)) {
        const maxText = plan.max_amount ? formatCurrency(plan.max_amount) : 'unlimited';
        modalAmountError.textContent = `Enter an amount between ${formatCurrency(plan.min_amount)} and ${maxText}.`;
        confirmButton.disabled = false;
        return;
    }
    modalAmountError.textContent = '';

    // Validate months if input exists
    if (modalMonthsInput && (isNaN(months) || months < plan.min_months || months > plan.max_months)) {
        modalMonthsError.textContent = `Select duration between ${plan.min_months} and ${plan.max_months} months.`;
        confirmButton.disabled = false;
        return;
    }
    if (modalMonthsError) modalMonthsError.textContent = '';

    hideModal();
    processingOverlay.classList.remove('hidden');

    try {
        const { data: rpcResponse, error: rpcError } = await supabase.functions.invoke('create-membership-plan', {
            body: { 
                plan_id: planId, 
                amount: amount,
                months: months || plan.min_months
            }
        });

        if (rpcError) throw new Error('A server error occurred during the transaction.');
        if (!rpcResponse.success) throw new Error(rpcResponse.message);

        const newMembership = rpcResponse.data;
        document.getElementById('fd-number').textContent = `MB-${newMembership.id.substring(0, 8).toUpperCase()}`;
        document.getElementById('fd-principal').textContent = formatCurrency(newMembership.amount);
        document.getElementById('fd-rate').textContent = `${plan.weekly_interest_rate}% weekly`;
        document.getElementById('fd-maturity').textContent = new Date(newMembership.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        document.getElementById('fd-maturity-amount').textContent = formatCurrency(newMembership.amount);
        successModal.classList.remove('hidden');
        successModal.classList.add('flex');

        document.getElementById('close-success').onclick = () => {
            successModal.classList.add('hidden');
            successModal.classList.remove('flex');
            window.location.reload();
        };
        
    } catch (error) {
        if (error.message.includes('Insufficient')) {
            // Show toast notification first
            Toastify({ 
                text: "Insufficient balance! Please add funds to your account.", 
                duration: 4000, 
                gravity: "top", 
                position: "center", 
                style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } 
            }).showToast();

            // Then show detailed modal
            const { data: profile } = await supabase.from('profiles').select('cash_balance').single();
            const available = profile ? profile.cash_balance : 0;
            
            document.getElementById('required-amount').textContent = formatCurrency(amount);
            document.getElementById('available-balance').textContent = formatCurrency(available);
            document.getElementById('balance-shortfall').textContent = formatCurrency(amount - available);
            insufficientModal.classList.remove('hidden');
            insufficientModal.classList.add('flex');
            document.getElementById('close-insufficient').onclick = () => {
                insufficientModal.classList.add('hidden');
                insufficientModal.classList.remove('flex');
            };
        } else {
            Toastify({ 
                text: `Error: ${error.message}`, 
                duration: 4000, 
                gravity: "top", 
                position: "center", 
                style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } 
            }).showToast();
        }
    } finally {
        processingOverlay.classList.add('hidden');
        confirmButton.disabled = false;
    }
}

function hideEarlyCloseModal() {
    if (earlyCloseInfoModal) earlyCloseInfoModal.classList.add('hidden');
}

// Top-up modal functions
function showTopupModal(membership) {
    if (!membership || !topupModal) return;

    document.getElementById('topup-membership-name').textContent = membership.plan_name;
    document.getElementById('topup-membership-id-display').textContent = `MB-${membership.id.substring(0,8).toUpperCase()}`;
    document.getElementById('topup-current-amount').textContent = formatCurrency(membership.amount);
    
    topupMembershipId.value = membership.id;
    topupAmountInput.value = '';
    topupAmountError.textContent = '';
    topupModeSelect.value = 'continue';
    topupConfirmButton.disabled = false;
    
    topupModal.classList.remove('hidden');
    topupModal.classList.add('flex');
}

function hideTopupModal() {
    if (!topupModal) return;
    topupModal.classList.add('hidden');
    topupModal.classList.remove('flex');
}

async function handleTopupSubmit(event) {
    event.preventDefault();
    topupConfirmButton.disabled = true;
    
    const membershipId = topupMembershipId.value;
    const amount = parseFloat(topupAmountInput.value);
    const topupMode = topupModeSelect.value;
    
    const membership = activeSavings.find(m => m.id === membershipId);
    if (!membership) {
        Toastify({ text: "Membership not found.", duration: 3000, style: { background: "red" }}).showToast();
        topupConfirmButton.disabled = false;
        return;
    }

    // Find the plan to get limits
    const plan = allPlans.find(p => p.id === membership.plan_id);
    if (!plan) {
        Toastify({ text: "Plan not found.", duration: 3000, style: { background: "red" }}).showToast();
        topupConfirmButton.disabled = false;
        return;
    }

    if (isNaN(amount) || amount <= 0) {
        topupAmountError.textContent = 'Enter a valid positive amount.';
        topupConfirmButton.disabled = false;
        return;
    }

    // Check if new total would exceed plan limits (only if plan has max_amount)
    if (plan.max_amount) {
        const newTotal = membership.amount + amount;
        if (newTotal > plan.max_amount) {
            topupAmountError.textContent = `Total amount would exceed plan limit of ${formatCurrency(plan.max_amount)}.`;
            topupConfirmButton.disabled = false;
            return;
        }
    }
    topupAmountError.textContent = '';

    hideTopupModal();
    processingOverlay.classList.remove('hidden');

    try {
        // Debug: Log the parameters being sent
        console.log('Top-up parameters:', {
            membership_id: membership.id,  // The specific membership to top up
            amount: amount,
            topup_mode: topupMode
        });

        // Use dedicated top-up function that targets the specific membership ID
        const { data: rpcResponse, error: rpcError } = await supabase.functions.invoke('topup-membership', {
            body: { 
                membership_id: membership.id,  // The specific membership UUID to top up
                amount: amount,                // Only the top-up amount
                topup_mode: topupMode         // 'continue' or 'reset'
            }
        });

        console.log('Top-up response:', rpcResponse);

        if (rpcError) throw new Error('A server error occurred during the transaction.');
        if (!rpcResponse.success) throw new Error(rpcResponse.message);

        // Show success modal with details
        const updatedMembership = rpcResponse.data;
        document.getElementById('topup-success-membership-id').textContent = `MB-${membership.id.substring(0,8).toUpperCase()}`;
        document.getElementById('topup-success-amount').textContent = formatCurrency(amount);
        document.getElementById('topup-success-new-total').textContent = formatCurrency(updatedMembership.amount);
        document.getElementById('topup-success-mode').textContent = topupMode === 'reset' ? 'Reset Timeline' : 'Continue Timeline';
        
        topupSuccessModal.classList.remove('hidden');
        topupSuccessModal.classList.add('flex');

        document.getElementById('close-topup-success').onclick = () => {
            topupSuccessModal.classList.add('hidden');
            topupSuccessModal.classList.remove('flex');
            window.location.reload();
        };
        
    } catch (error) {
        if (error.message.includes('Insufficient')) {
            // Show toast notification first
            Toastify({ 
                text: "Insufficient balance for top-up! Please add funds to your account.", 
                duration: 4000, 
                gravity: "top", 
                position: "center", 
                style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } 
            }).showToast();

            // Then show detailed modal
            const { data: profile } = await supabase.from('profiles').select('cash_balance').single();
            const available = profile ? profile.cash_balance : 0;
            
            document.getElementById('required-amount').textContent = formatCurrency(amount);
            document.getElementById('available-balance').textContent = formatCurrency(available);
            document.getElementById('balance-shortfall').textContent = formatCurrency(amount - available);
            insufficientModal.classList.remove('hidden');
            insufficientModal.classList.add('flex');
            document.getElementById('close-insufficient').onclick = () => {
                insufficientModal.classList.add('hidden');
                insufficientModal.classList.remove('flex');
            };
        } else {
            Toastify({ 
                text: `Top-up Error: ${error.message}`, 
                duration: 4000, 
                gravity: "top", 
                position: "center", 
                style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } 
            }).showToast();
        }
    } finally {
        processingOverlay.classList.add('hidden');
        topupConfirmButton.disabled = false;
    }
}

// Function to check user balance and show warning
async function checkBalanceAndWarn(amount, isTopup = false) {
    try {
        const { data: profile } = await supabase.from('profiles').select('cash_balance').single();
        const available = profile ? profile.cash_balance : 0;
        
        if (amount > available) {
            const actionType = isTopup ? 'top-up' : 'membership creation';
            Toastify({ 
                text: `Insufficient balance for ${actionType}! You need ${formatCurrency(amount - available)} more.`, 
                duration: 4000, 
                gravity: "top", 
                position: "center", 
                style: { background: "linear-gradient(to right, #f39c12, #e67e22)" } 
            }).showToast();
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error checking balance:', error);
        return true; // Allow to proceed if balance check fails
    }
}

export function initializeLockedSavingsActions(plans) {
    if (!createSavingModal) return;

    allPlans = plans;

    // Get user currency
    supabase.from('profiles').select('currency_code').single().then(({ data }) => {
        if (data?.currency_code) {
            userCurrency = data.currency_code;
        }
    });

    document.querySelectorAll('.select-plan-btn').forEach(button => {
        button.addEventListener('click', () => {
            const planId = parseInt(button.dataset.planId, 10);
            const selectedPlan = allPlans.find(p => p.id === planId);
            if(selectedPlan) showModal(selectedPlan);
        });
    });

    // Top-up button event listeners (using event delegation for dynamically added buttons)
    document.addEventListener('click', (e) => {
        // Handle both the button and its child elements (span, svg)
        let targetElement = e.target;
        
        // If clicked on span or svg inside button, get the button element
        if (targetElement.tagName === 'SPAN' || targetElement.tagName === 'svg' || targetElement.tagName === 'path') {
            targetElement = targetElement.closest('.topup-btn');
        }
        
        if (targetElement && targetElement.classList.contains('topup-btn')) {
            const membershipId = targetElement.dataset.membershipId;
            const membership = activeSavings.find(m => m.id === membershipId);
            if(membership) showTopupModal(membership);
        }
    });

    closeModalButton.addEventListener('click', hideModal);
    createSavingModal.addEventListener('click', (e) => { if (e.target === createSavingModal) hideModal(); });
    createSavingForm.addEventListener('submit', handleFormSubmit);

    // Top-up modal event listeners
    if (topupCloseButton) topupCloseButton.addEventListener('click', hideTopupModal);
    if (topupModal) topupModal.addEventListener('click', (e) => { if (e.target === topupModal) hideTopupModal(); });
    if (topupForm) topupForm.addEventListener('submit', handleTopupSubmit);

    // Add real-time balance checking on amount input
    if (modalAmountInput) {
        modalAmountInput.addEventListener('blur', async () => {
            const amount = parseFloat(modalAmountInput.value);
            if (!isNaN(amount) && amount > 0) {
                await checkBalanceAndWarn(amount, false);
            }
        });
    }

    if (topupAmountInput) {
        topupAmountInput.addEventListener('blur', async () => {
            const amount = parseFloat(topupAmountInput.value);
            if (!isNaN(amount) && amount > 0) {
                await checkBalanceAndWarn(amount, true);
            }
        });
    }
}

export function initializeEarlyClosureActions(savings) {
    if (!earlyCloseInfoModal) return;
    activeSavings = savings;

    document.querySelectorAll('.early-closure-btn').forEach(button => {
        button.addEventListener('click', () => {
            const lockId = button.dataset.lockId;
            const saving = activeSavings.find(s => s.id === lockId);
            if (!saving) return;

            // Client-side calculation for display
            const penaltyPercent = 0.10;
            const interestEarned = saving.total_interest_earned || 0;
            const penaltyAmount = interestEarned * penaltyPercent;
            const finalPayout = saving.amount + interestEarned - penaltyAmount;

            document.getElementById('info-fd-number').textContent = `MB-${saving.id.substring(0, 8).toUpperCase()}`;
            document.getElementById('info-fd-principal').textContent = formatCurrency(saving.amount);
            document.getElementById('info-fd-maturity-date').textContent = new Date(saving.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            
            document.getElementById('info-fd-interest-earned').textContent = formatCurrency(interestEarned);
            document.getElementById('info-fd-penalty').textContent = `- ${formatCurrency(penaltyAmount)}`;
            document.getElementById('info-fd-final-payout').textContent = formatCurrency(finalPayout);

            earlyCloseConfirmBtn.dataset.lockId = lockId; // Pass lock id to confirm button
            earlyCloseInfoModal.classList.remove('hidden');
        });
    });

    const handleEarlyClosure = async (event) => {
        const lockId = event.currentTarget.dataset.lockId;
        if (!lockId) return;

        processingOverlay.classList.remove('hidden');
        hideEarlyCloseModal();

        try {
            const { data, error } = await supabase.functions.invoke('request_membership_early_closure', {
                body: { membership_id: lockId }
            });

            if (error) throw new Error(error.message);
            if (!data.success) throw new Error(data.message);

            Toastify({
                text: "Early closure request submitted successfully.",
                duration: 3000,
                gravity: "top",
                position: "center",
                style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
            }).showToast();

            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            Toastify({
                text: `Error: ${error.message || 'Could not process request.'}`,
                duration: 4000,
                gravity: "top",
                position: "center",
                style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
            }).showToast();
        } finally {
            processingOverlay.classList.add('hidden');
        }
    };

    earlyCloseConfirmBtn.addEventListener('click', handleEarlyClosure);
    earlyCloseCancelBtn.addEventListener('click', hideEarlyCloseModal);
    earlyCloseXBtn.addEventListener('click', hideEarlyCloseModal);
    earlyCloseInfoModal.addEventListener('click', (e) => {
        if (e.target === earlyCloseInfoModal) hideEarlyCloseModal();
    });
} 