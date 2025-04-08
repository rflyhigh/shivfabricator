document.addEventListener('DOMContentLoaded', function() {
    // Form elements
    const companyForm = document.getElementById('companyForm');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const contactInput = document.getElementById('contact');
    const addressInput = document.getElementById('address');
    const panInput = document.getElementById('pan');
    const gstNoInput = document.getElementById('gst_no');
    const bankNameInput = document.getElementById('bank_name');
    const accountNoInput = document.getElementById('account_no');
    const ifscCodeInput = document.getElementById('ifsc_code');
    const saveBtn = document.getElementById('saveBtn');
    
    // Load company details
    loadCompanyDetails();
    
    // Event listeners
    companyForm.addEventListener('submit', saveCompanyDetails);
    
    // Functions
    async function loadCompanyDetails() {
        try {
            const API_URL = window.adminUtils.API_URL;
            
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            
            const response = await fetch(`${API_URL}/company-details`);
            
            if (!response.ok) {
                if (response.status === 401) {
                    // Redirect to login if unauthorized
                    window.location.href = 'login.html';
                    return;
                }
                throw new Error('Failed to load company details');
            }
            
            const company = await response.json();
            
            nameInput.value = company.name || '';
            emailInput.value = company.email || '';
            contactInput.value = company.contact || '';
            addressInput.value = company.address || '';
            panInput.value = company.pan || '';
            gstNoInput.value = company.gst_no || '';
            bankNameInput.value = company.bank_name || '';
            accountNoInput.value = company.account_no || '';
            ifscCodeInput.value = company.ifsc_code || '';
            
            // Re-enable save button
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            
        } catch (error) {
            console.error('Error loading company details:', error);
            window.adminUtils.showToast('Error loading company details. Please try again.', 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        }
    }
    
    async function saveCompanyDetails(e) {
        e.preventDefault();
        
        try {
            // Validate form
            if (!companyForm.checkValidity()) {
                companyForm.reportValidity();
                return;
            }
            
            // Show saving state
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            
            // Gather form data
            const formData = {
                name: nameInput.value,
                email: emailInput.value,
                contact: contactInput.value,
                address: addressInput.value,
                pan: panInput.value || null,
                gst_no: gstNoInput.value || null,
                bank_name: bankNameInput.value || null,
                account_no: accountNoInput.value,
                ifsc_code: ifscCodeInput.value
            };
            
            // Save to API
            const API_URL = window.adminUtils.API_URL;
            const headers = window.adminUtils.getAuthHeaders();
            
            const response = await fetch(`${API_URL}/company-details`, {
                method: 'PUT',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                await window.adminUtils.handleApiError(response);
                throw new Error('Failed to save company details');
            }
            
            window.adminUtils.showToast('Company details saved successfully', 'success');
            
            // Reset save button
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            
        } catch (error) {
            console.error('Error saving company details:', error);
            window.adminUtils.showToast('Error saving company details: ' + (error.message || 'Please try again'), 'error');
            
            // Reset save button
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        }
    }
});
