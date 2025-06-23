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

// Other Overlays and Modals
const processingOverlay = document.getElementById('processing-overlay');
const successModal = document.getElementById('success-modal');
const insufficientModal = document.getElementById('insufficient-modal');
const earlyCloseInfoModal = document.getElementById('early-close-info-modal');
const earlyCloseCancelBtn = document.getElementById('early-close-info-modal-cancel');
const earlyCloseConfirmBtn = document.getElementById('early-close-info-modal-confirm');
const earlyCloseXBtn = document.getElementById('early-close-info-modal-close-x');

let allPlans = [];
let activeSavings = [];

function formatCurrency(amount) {
    if (typeof amount !== 'number') {
        amount = 0;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function showModal(plan) {
    if (!plan || !createSavingModal) return;

    modalPlanName.textContent = plan.plan_name;
    modalPlanId.value = plan.id;
    modalPlanDuration.textContent = `${plan.duration_days} days`;
    modalPlanInterest.textContent = `${plan.interest_rate_weekly}%`;
    modalPlanRange.textContent = `${formatCurrency(plan.min_amount)} - ${formatCurrency(plan.max_amount)}`;
    modalAmountInput.min = plan.min_amount;
    modalAmountInput.max = plan.max_amount;
    modalAmountInput.value = '';
    modalAmountError.textContent = '';
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
    
    const plan = allPlans.find(p => p.id === planId);
    if (!plan) {
        Toastify({ text: "Selected plan not found.", duration: 3000, style: { background: "red" }}).showToast();
        confirmButton.disabled = false;
        return;
    }

    if (isNaN(amount) || amount < plan.min_amount || amount > plan.max_amount) {
        modalAmountError.textContent = `Enter an amount between ${formatCurrency(plan.min_amount)} and ${formatCurrency(plan.max_amount)}.`;
        confirmButton.disabled = false;
        return;
    }
    modalAmountError.textContent = '';

    hideModal();
    processingOverlay.classList.remove('hidden');

    try {
        const { data: rpcResponse, error: rpcError } = await supabase.functions.invoke('create-locked-saving', {
            body: { plan_id: planId, amount: amount }
        });

        if (rpcError) throw new Error('A server error occurred during the transaction.');
        if (!rpcResponse.success) throw new Error(rpcResponse.message);

        const newSaving = rpcResponse.data;
        document.getElementById('fd-number').textContent = `LS-${newSaving.id.substring(0, 8).toUpperCase()}`;
        document.getElementById('fd-principal').textContent = formatCurrency(newSaving.amount);
        document.getElementById('fd-rate').textContent = `${plan.interest_rate_weekly}% weekly`;
        document.getElementById('fd-maturity').textContent = new Date(newSaving.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        document.getElementById('fd-maturity-amount').textContent = formatCurrency(newSaving.amount);
        successModal.classList.remove('hidden');
        successModal.classList.add('flex');

        document.getElementById('close-success').onclick = () => {
            successModal.classList.add('hidden');
            successModal.classList.remove('flex');
            window.location.reload();
        };
        
    } catch (error) {
        if (error.message.includes('Insufficient')) {
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
            Toastify({ text: `Error: ${error.message}`, duration: 4000, gravity: "top", position: "center", style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" } }).showToast();
        }
    } finally {
        processingOverlay.classList.add('hidden');
        confirmButton.disabled = false;
    }
}

function hideEarlyCloseModal() {
    if (earlyCloseInfoModal) earlyCloseInfoModal.classList.add('hidden');
}

export function initializeLockedSavingsActions(plans) {
    if (!createSavingModal) return;

    allPlans = plans;

    document.querySelectorAll('.select-plan-btn').forEach(button => {
        button.addEventListener('click', () => {
            const planId = parseInt(button.dataset.planId, 10);
            const selectedPlan = allPlans.find(p => p.id === planId);
            if(selectedPlan) showModal(selectedPlan);
        });
    });

    closeModalButton.addEventListener('click', hideModal);
    createSavingModal.addEventListener('click', (e) => { if (e.target === createSavingModal) hideModal(); });
    createSavingForm.addEventListener('submit', handleFormSubmit);
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

            document.getElementById('info-fd-number').textContent = `LS-${saving.id.substring(0, 8).toUpperCase()}`;
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
            const { data, error } = await supabase.functions.invoke('request-early-closure', {
                body: { lock_id: lockId }
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