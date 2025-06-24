import { supabase } from './client.js';
import { getCurrentUser } from './session.js';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";

document.addEventListener('DOMContentLoaded', async () => {
    const user = await getCurrentUser();
    if (!user) return;

    // --- DOM Elements ---
    const balanceElements = document.querySelectorAll('.available-balance');
    const balanceLoading = document.getElementById('balance-loading');
    const withdrawalForm = document.getElementById('withdrawal-form');
    
    // Method Tabs
    const bankTab = document.getElementById('bank-tab');
    const cryptoTab = document.getElementById('crypto-tab');
    const bankFields = document.getElementById('bank-fields');
    const cryptoFields = document.getElementById('crypto-fields');

    // Beneficiary Elements
    const savedBeneficiarySelect = document.getElementById('saved-beneficiary-select');
    const addEditBankDetailsSection = document.getElementById('add-edit-bank-details-section');

    // Form fields
    const amountInput = document.getElementById('amount');
    const descriptionInput = document.getElementById('description');
    const submitButton = document.getElementById('submit-withdrawal');
    const buttonSpinner = document.getElementById('button-spinner');
    const buttonText = document.getElementById('button-text');

    // Modal DOM Elements
    const confirmationOverlay = document.getElementById('confirmation-overlay');
    const confirmationState = document.getElementById('confirmation-state');
    const processingState = document.getElementById('processing-state');
    const successState = document.getElementById('success-state');
    const closeConfirmationBtn = document.getElementById('close-confirmation');
    const cancelWithdrawalBtn = document.getElementById('cancel-withdrawal');
    const confirmWithdrawalBtn = document.getElementById('confirm-withdrawal');
    const closeSuccessBtn = document.getElementById('close-success');
    const confirmMethodEl = document.getElementById('confirm-method');
    const confirmAmountEl = document.getElementById('confirm-amount');
    const confirmFeeEl = document.getElementById('confirm-fee');
    const confirmTotalEl = document.getElementById('confirm-total');
    const referenceIdEl = document.getElementById('reference-id');
    const successAmountEl = document.getElementById('success-amount');
    const successFeeEl = document.getElementById('success-fee');
    const successMethodEl = document.getElementById('success-method');
    const successTotalEl = document.getElementById('success-total');

    // --- State ---
    let currentMethod = 'bank transfer';
    let savedBeneficiaries = [];
    let withdrawalData = {}; // To store data for confirmation
    
    // --- Input Collections ---
    const bankInputs = [
        document.getElementById('bank_name'),
        document.getElementById('account_holder_name'),
        document.getElementById('account_number'),
        document.getElementById('routing_number'),
        document.getElementById('swift_code'),
        document.getElementById('bank_address'),
    ];
    const cryptoInputs = [
        document.getElementById('crypto_currency'),
        document.getElementById('crypto_wallet_address'),
    ];

    // --- Helper Functions ---
    const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

    // --- Modal Logic ---
    function showModal() {
        confirmationOverlay.classList.remove('hidden');
        confirmationOverlay.classList.add('flex');
        document.body.classList.add('overflow-hidden');
    }

    function hideModal() {
        confirmationOverlay.classList.add('hidden');
        confirmationOverlay.classList.remove('flex');
        document.body.classList.remove('overflow-hidden');
        // Reset to default state
        confirmationState.classList.remove('hidden');
        processingState.classList.add('hidden');
        successState.classList.add('hidden');
    }
    
    // --- Core Logic ---

    // Fetch and display user's available balance
    async function fetchBalance() {
        balanceLoading.classList.remove('hidden');
        try {
            const { data, error } = await supabase.from('profiles').select('cash_balance').eq('id', user.id).single();
            if (error) throw error;
            balanceElements.forEach(el => el.textContent = formatCurrency(data.cash_balance));
            amountInput.max = data.cash_balance; // Set max withdrawal amount
        } catch (error) {
            console.error('Error fetching balance:', error);
            balanceElements.forEach(el => el.textContent = 'Error');
            Toastify({ text: "Could not load balance.", duration: 3000, style: { background: "red" } }).showToast();
        } finally {
            balanceLoading.classList.add('hidden');
        }
    }

    // Fetch saved bank accounts and populate the dropdown
    async function fetchAndPopulateBeneficiaries() {
        try {
            const { data, error } = await supabase.from('saved_beneficiaries').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
            if (error) throw error;
            savedBeneficiaries = data;

            savedBeneficiarySelect.innerHTML = `<option value="">-- Select a saved account --</option><option value="add_new">-- Add New Bank Account --</option>`;
            savedBeneficiaries.forEach(b => {
                const option = document.createElement('option');
                option.value = b.id;
                option.textContent = `${b.bank_name} - ****${String(b.account_number).slice(-4)}`;
                savedBeneficiarySelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error fetching beneficiaries:', error);
        }
    }

    // Handle showing/hiding the form to add a new beneficiary
    function handleBeneficiarySelectChange() {
        const selectedValue = savedBeneficiarySelect.value;
        const bankForm = addEditBankDetailsSection;
        const fields = {
            bank_name: document.getElementById('bank_name'),
            account_holder_name: document.getElementById('account_holder_name'),
            account_number: document.getElementById('account_number'),
            routing_number: document.getElementById('routing_number'),
            swift_code: document.getElementById('swift_code'),
            bank_address: document.getElementById('bank_address'),
        };

        const clearForm = () => Object.values(fields).forEach(field => field.value = '');

        if (selectedValue === 'add_new' || (selectedValue && selectedValue !== '')) {
            bankForm.classList.remove('hidden');
            bankInputs.forEach(input => input.required = true);

            if (selectedValue === 'add_new') {
                clearForm();
            } else {
                 const beneficiary = savedBeneficiaries.find(b => b.id.toString() === selectedValue);
                if (beneficiary) {
                    for (const key in fields) {
                        fields[key].value = beneficiary[key] || '';
                    }
                }
            }
        } else {
            bankForm.classList.add('hidden');
            bankInputs.forEach(input => input.required = false);
            clearForm();
        }
    }
    
    // Switch between Bank and Crypto withdrawal forms
    function selectTab(method) {
        currentMethod = method;
        if (method === 'bank transfer') {
            bankTab.classList.add('border-blue-400');
            bankTab.classList.remove('border-gray-600');
            cryptoTab.classList.add('border-gray-600');
            cryptoTab.classList.remove('border-blue-400');
            
            bankFields.classList.remove('hidden');
            cryptoFields.classList.add('hidden');
            
            cryptoInputs.forEach(input => input.required = false);
            handleBeneficiarySelectChange();
        } else { // crypto
            cryptoTab.classList.add('border-blue-400');
            cryptoTab.classList.remove('border-gray-600');
            bankTab.classList.add('border-gray-600');
            bankTab.classList.remove('border-blue-400');

            cryptoFields.classList.remove('hidden');
            bankFields.classList.add('hidden');

            bankInputs.forEach(input => input.required = false);
            cryptoInputs.forEach(input => input.required = true);
        }
    }

    // Step 1: User submits the form, this prepares the confirmation modal
    function handleFormSubmit(e) {
        e.preventDefault();

        const amount = parseFloat(amountInput.value) || 0;
        if (amount < 10) {
            Toastify({ text: 'Minimum withdrawal amount is $10.00', duration: 3000, style: { background: "orange" } }).showToast();
            return;
        }

        const fee = Math.max(1, amount * 0.01); // 1% fee, minimum $1
        const total = amount - fee;

        // Store data for final submission
        withdrawalData = {
            amount,
            method: currentMethod,
            description: descriptionInput.value,
            saved_beneficiary_id: savedBeneficiarySelect.value === 'add_new' ? null : savedBeneficiarySelect.value || null,
        };
        
        if (currentMethod === 'bank transfer') {
            Object.assign(withdrawalData, {
                bank_name: document.getElementById('bank_name').value,
                account_holder_name: document.getElementById('account_holder_name').value,
                account_number: document.getElementById('account_number').value,
                routing_number: document.getElementById('routing_number').value,
                swift_code: document.getElementById('swift_code').value,
                bank_address: document.getElementById('bank_address').value,
                crypto_currency: null,
                crypto_wallet_address: null,
            });
        } else { // crypto
            Object.assign(withdrawalData, {
                bank_name: null,
                account_holder_name: null,
                account_number: null,
                routing_number: null,
                swift_code: null,
                bank_address: null,
                crypto_currency: document.getElementById('crypto_currency').value,
                crypto_wallet_address: document.getElementById('crypto_wallet_address').value,
            });
        }

        // Populate and show modal
        confirmMethodEl.textContent = currentMethod === 'bank transfer' ? 'Bank Transfer' : 'Cryptocurrency';
        confirmAmountEl.textContent = formatCurrency(amount);
        confirmFeeEl.textContent = formatCurrency(fee);
        confirmTotalEl.textContent = formatCurrency(total);
        
        showModal();
    }
    
    // Step 2: User clicks 'Confirm' in the modal, this runs the edge function
    async function executeWithdrawal() {
        // Show processing state
        confirmationState.classList.add('hidden');
        processingState.classList.remove('hidden');
        
        submitButton.disabled = true; // Also disable main form button
        buttonSpinner.classList.remove('hidden');
        buttonText.textContent = 'Submitting...';

        try {
            const { data, error } = await supabase.functions.invoke('submit-withdrawal', { body: withdrawalData });
            
            if (error) throw new Error(error.message);
            if (data.success === false) throw new Error(data.message);

            // Populate and show success state
            const fee = Math.max(1, withdrawalData.amount * 0.01);
            const total = withdrawalData.amount - fee;
            successAmountEl.textContent = formatCurrency(withdrawalData.amount);
            successFeeEl.textContent = formatCurrency(fee);
            successMethodEl.textContent = withdrawalData.method === 'bank transfer' ? 'Bank Transfer' : 'Cryptocurrency';
            successTotalEl.textContent = formatCurrency(total);
            referenceIdEl.textContent = data.withdrawalId || 'N/A';

            processingState.classList.add('hidden');
            successState.classList.remove('hidden');

            // Reset everything
            withdrawalForm.reset();
            selectTab('bank transfer');
            handleBeneficiarySelectChange(); 
            fetchBalance();
            fetchAndPopulateBeneficiaries(); 

        } catch (error) {
            Toastify({ text: `Error: ${error.message}`, duration: 4000, style: { background: "red" } }).showToast();
            hideModal(); // Hide modal on error so user can try again
        } finally {
            submitButton.disabled = false;
            buttonSpinner.classList.add('hidden');
            buttonText.textContent = 'Submit Withdrawal Request';
        }
    }

    // --- Event Listeners ---
    bankTab.addEventListener('click', () => selectTab('bank transfer'));
    cryptoTab.addEventListener('click', () => selectTab('crypto'));
    savedBeneficiarySelect.addEventListener('change', handleBeneficiarySelectChange);
    withdrawalForm.addEventListener('submit', handleFormSubmit);

    // New modal listeners
    confirmWithdrawalBtn.addEventListener('click', executeWithdrawal);
    closeConfirmationBtn.addEventListener('click', hideModal);
    cancelWithdrawalBtn.addEventListener('click', hideModal);
    closeSuccessBtn.addEventListener('click', () => {
        hideModal();
    });

    // --- Initial Page Load ---
    fetchBalance();
    fetchAndPopulateBeneficiaries();
    selectTab('bank transfer');
}); 