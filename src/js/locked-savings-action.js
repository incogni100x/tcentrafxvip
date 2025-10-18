import { supabase } from './client.js';
import Toastify from 'toastify-js';
import { formatCurrency, getCurrencySymbol } from './session.js';

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

// Function to update currency symbols in modals
async function updateModalCurrencySymbols() {
    try {
        const currencySymbol = await getCurrencySymbol();
        
        // Update create savings modal currency symbol
        const modalCurrencySymbol = document.getElementById('modal-currency-symbol');
        if (modalCurrencySymbol) {
            modalCurrencySymbol.textContent = currencySymbol;
        }
        
        // Update top-up modal currency symbol
        const topupCurrencySymbol = document.getElementById('topup-currency-symbol');
        if (topupCurrencySymbol) {
            topupCurrencySymbol.textContent = currencySymbol;
        }
    } catch (error) {
        console.warn('Failed to update modal currency symbols:', error);
    }
}

async function showModal(plan) {
    if (!plan || !createSavingModal) return;

    modalPlanName.textContent = plan.plan_name;
    modalPlanId.value = plan.id;
    modalPlanDuration.textContent = `${plan.min_months}-${plan.max_months} months`;
    modalPlanInterest.textContent = `${plan.weekly_interest_rate}%`;
    const maxAmountText = plan.max_amount ? await formatCurrency(plan.max_amount) : 'No Limit';
    modalPlanRange.textContent = `${await formatCurrency(plan.min_amount)} - ${maxAmountText}`;
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
    
    // Update currency symbols
    await updateModalCurrencySymbols();
    
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
        const maxText = plan.max_amount ? await formatCurrency(plan.max_amount) : 'unlimited';
        modalAmountError.textContent = `Enter an amount between ${await formatCurrency(plan.min_amount)} and ${maxText}.`;
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
        if (!rpcResponse.success) {
            // Create error object with balance information if available
            const error = new Error(rpcResponse.message);
            if (rpcResponse.current_balance !== undefined) {
                error.current_balance = rpcResponse.current_balance;
                error.required_amount = rpcResponse.required_amount;
                error.shortfall = rpcResponse.shortfall;
            }
            throw error;
        }

        const newMembership = rpcResponse.data;
        const maturityAmount = rpcResponse.maturity_amount || newMembership.amount; // Fallback to principal if maturity not calculated
        
        document.getElementById('fd-number').textContent = `MB-${newMembership.id.substring(0, 8).toUpperCase()}`;
        document.getElementById('fd-principal').textContent = await formatCurrency(newMembership.amount);
        document.getElementById('fd-rate').textContent = `${rpcResponse.weekly_interest_rate || plan.weekly_interest_rate}% weekly`;
        document.getElementById('fd-maturity').textContent = new Date(newMembership.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        document.getElementById('fd-maturity-amount').textContent = await formatCurrency(maturityAmount);
        successModal.classList.remove('hidden');
        successModal.classList.add('flex');

        document.getElementById('close-success').onclick = () => {
            successModal.classList.add('hidden');
            successModal.classList.remove('flex');
            // Refresh session data before reloading
            refreshSessionData().then(() => {
                window.location.reload();
            });
        };
        
    } catch (error) {
        console.log('Create membership error:', error.message);
        // Check for insufficient balance errors
        if (error.message.includes('Insufficient') || error.message.includes('insufficient') || error.message.includes('balance') || error.message.includes('funds') || error.message.includes('server error')) {
            // Show insufficient balance modal
            try {
                // Try to get balance info from the error response if available
                let availableBalance = 0;
                let requiredAmount = amount;
                
                // Check if the error has balance information
                if (error.current_balance !== undefined) {
                    availableBalance = error.current_balance;
                    requiredAmount = error.required_amount || amount;
                } else {
                    // Use a default balance or show generic message
                    availableBalance = 0; // Don't make additional DB calls that might fail
                }
                
                await showInsufficientBalanceModal(requiredAmount, availableBalance, false);
            } catch (modalError) {
                console.error('Error showing insufficient balance modal:', modalError);
                // Fallback to toast
                Toastify({ 
                    text: "Insufficient balance! Please add funds to your account.", 
                    duration: 4000, 
                    gravity: "top", 
                    position: "center", 
                    style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } 
                }).showToast();
            }
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
async function showTopupModal(membership) {
    if (!membership || !topupModal) return;

    document.getElementById('topup-membership-name').textContent = membership.plan_name;
    document.getElementById('topup-membership-id-display').textContent = `MB-${membership.id.substring(0,8).toUpperCase()}`;
    document.getElementById('topup-current-amount').textContent = await formatCurrency(membership.amount);
    
    topupMembershipId.value = membership.id;
    topupAmountInput.value = '';
    topupAmountError.textContent = '';
    topupModeSelect.value = 'continue';
    topupConfirmButton.disabled = false;
    
    // Update currency symbols
    await updateModalCurrencySymbols();
    
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
            topupAmountError.textContent = `Total amount would exceed plan limit of ${await formatCurrency(plan.max_amount)}.`;
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
        document.getElementById('topup-success-amount').textContent = await formatCurrency(amount);
        document.getElementById('topup-success-new-total').textContent = await formatCurrency(updatedMembership.amount);
        document.getElementById('topup-success-mode').textContent = topupMode === 'reset' ? 'Reset Timeline' : 'Continue Timeline';
        
        topupSuccessModal.classList.remove('hidden');
        topupSuccessModal.classList.add('flex');

        document.getElementById('close-topup-success').onclick = () => {
            topupSuccessModal.classList.add('hidden');
            topupSuccessModal.classList.remove('flex');
            window.location.reload();
        };
        
    } catch (error) {
        if (error.message.includes('Insufficient') || error.message.includes('insufficient') || error.message.includes('balance') || error.message.includes('funds')) {
            // Show insufficient balance modal
            try {
                // Try to get balance info from the error response if available
                let availableBalance = 0;
                let requiredAmount = amount;
                
                // Check if the error has balance information
                if (error.current_balance !== undefined) {
                    availableBalance = error.current_balance;
                    requiredAmount = error.required_amount || amount;
                } else {
                    // Use a default balance or show generic message
                    availableBalance = 0; // Don't make additional DB calls that might fail
                }
                
                await showInsufficientBalanceModal(requiredAmount, availableBalance, true);
            } catch (modalError) {
                console.error('Error showing insufficient balance modal:', modalError);
                // Fallback to toast
                Toastify({ 
                    text: "Insufficient balance for top-up! Please add funds to your account.", 
                    duration: 4000, 
                    gravity: "top", 
                    position: "center", 
                    style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } 
                }).showToast();
            }
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

// Function to show insufficient balance modal
async function showInsufficientBalanceModal(requiredAmount, availableBalance, isTopup = false) {
    try {
        const shortfall = requiredAmount - availableBalance;
        
        // Update modal content
        document.getElementById('required-amount').textContent = await formatCurrency(requiredAmount);
        document.getElementById('available-balance').textContent = await formatCurrency(availableBalance);
        document.getElementById('balance-shortfall').textContent = await formatCurrency(shortfall);
        
        // Update title and description based on action type
        const title = isTopup ? 'Unable to Top Up Membership' : 'Unable to Create Time Deposits';
        const description = isTopup 
            ? 'You don\'t have sufficient balance in your wallet to top up this membership.'
            : 'You don\'t have sufficient balance in your wallet to create this Time Deposits.';
        
        document.querySelector('#insufficient-modal h4').textContent = title;
        document.querySelector('#insufficient-modal p').textContent = description;
        
        // Show modal
        insufficientModal.classList.remove('hidden');
        insufficientModal.classList.add('flex');
        
        // Set up close button
        document.getElementById('close-insufficient').onclick = () => {
            insufficientModal.classList.add('hidden');
            insufficientModal.classList.remove('flex');
        };
        
    } catch (error) {
        console.error('Error showing insufficient balance modal:', error);
        // Fallback to toast if modal fails
        Toastify({ 
            text: "Insufficient balance! Please add funds to your account.", 
            duration: 4000, 
            gravity: "top", 
            position: "center", 
            style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } 
        }).showToast();
    }
}

// Removed balance checking functions - now using backend response data

// Function to refresh session data
async function refreshSessionData() {
    try {
        // Clear cached profile data
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const cachedProfileKey = `userProfile_${user.id}`;
            sessionStorage.removeItem(cachedProfileKey);
            
            // Re-fetch fresh profile data
            const { getUserWithProfile } = await import('./session.js');
            await getUserWithProfile();
        }
    } catch (error) {
        console.error('Error refreshing session data:', error);
    }
}

export function initializeLockedSavingsActions(plans) {
    if (!createSavingModal) return;

    allPlans = plans;


    document.querySelectorAll('.select-plan-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const planId = parseInt(button.dataset.planId, 10);
            const selectedPlan = allPlans.find(p => p.id === planId);
            if(selectedPlan) await showModal(selectedPlan);
        });
    });

    // Top-up button event listeners (using event delegation for dynamically added buttons)
    document.addEventListener('click', async (e) => {
        // Handle both the button and its child elements (span, svg)
        let targetElement = e.target;
        
        // If clicked on span or svg inside button, get the button element
        if (targetElement.tagName === 'SPAN' || targetElement.tagName === 'svg' || targetElement.tagName === 'path') {
            targetElement = targetElement.closest('.topup-btn');
        }
        
        if (targetElement && targetElement.classList.contains('topup-btn')) {
            const membershipId = targetElement.dataset.membershipId;
            const membership = activeSavings.find(m => m.id === membershipId);
            if(membership) await showTopupModal(membership);
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
                // Balance check removed - backend handles validation
            }
        });
    }

    if (topupAmountInput) {
        topupAmountInput.addEventListener('blur', async () => {
            const amount = parseFloat(topupAmountInput.value);
            if (!isNaN(amount) && amount > 0) {
                // Balance check removed - backend handles validation
            }
        });
    }
}

export async function initializeEarlyClosureActions(savings) {
    if (!earlyCloseInfoModal) return;
    activeSavings = savings;

    document.querySelectorAll('.early-closure-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const lockId = button.dataset.lockId;
            const saving = activeSavings.find(s => s.id === lockId);
            if (!saving) return;

            // Client-side calculation for display
            const penaltyPercent = 0.10;
            const interestEarned = saving.total_interest_earned || 0;
            const penaltyAmount = interestEarned * penaltyPercent;
            const finalPayout = saving.amount + interestEarned - penaltyAmount;

            document.getElementById('info-fd-number').textContent = `MB-${saving.id.substring(0, 8).toUpperCase()}`;
            document.getElementById('info-fd-principal').textContent = await formatCurrency(saving.amount);
            document.getElementById('info-fd-maturity-date').textContent = new Date(saving.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            
            document.getElementById('info-fd-interest-earned').textContent = await formatCurrency(interestEarned);
            document.getElementById('info-fd-penalty').textContent = `- ${await formatCurrency(penaltyAmount)}`;
            document.getElementById('info-fd-final-payout').textContent = await formatCurrency(finalPayout);

            earlyCloseConfirmBtn.dataset.lockId = lockId; // Pass lock id to confirm button
            earlyCloseInfoModal.classList.remove('hidden');
            earlyCloseInfoModal.classList.add('flex');
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