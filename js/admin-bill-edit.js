document.addEventListener('DOMContentLoaded', function() {
    // Variables
    const urlParams = new URLSearchParams(window.location.search);
    const billId = urlParams.get('id');
    const isEditMode = !!billId;
    
    // Form elements
    const billForm = document.getElementById('billForm');
    const billTitle = document.getElementById('billTitle');
    const formTitle = document.getElementById('formTitle');
    const billIdInput = document.getElementById('billId');
    const invoiceNoInput = document.getElementById('invoice_no');
    const dateInput = document.getElementById('date');
    const billToInput = document.getElementById('bill_to');
    const billToAddressInput = document.getElementById('bill_to_address');
    const companyPanInput = document.getElementById('company_pan');
    const suppliersRefNoInput = document.getElementById('suppliers_ref_no');
    const buyersOrderNoInput = document.getElementById('buyers_order_no');
    const otherTermsInput = document.getElementById('other_terms');
    
    // Company details elements
    const companyNameInput = document.getElementById('company_name');
    const companyEmailInput = document.getElementById('company_email');
    const companyAddressInput = document.getElementById('company_address');
    const companyContactInput = document.getElementById('company_contact');
    const companyGstInput = document.getElementById('company_gst');
    const companyPanInput = document.getElementById('company_pan');
    const companyBankNameInput = document.getElementById('company_bank_name');
    const companyAccountNoInput = document.getElementById('company_account_no');
    const companyIfscInput = document.getElementById('company_ifsc');
    
    const billItems = document.getElementById('billItems');
    const addBillItemBtn = document.getElementById('addBillItem');
    const subTotalInput = document.getElementById('sub_total');
    const gstInput = document.getElementById('gst');
    const gstAmountDisplay = document.getElementById('gstAmount');
    const roundOffInput = document.getElementById('round_off');
    const grandTotalInput = document.getElementById('grand_total');
    const amountInWordsInput = document.getElementById('amount_in_words');
    const enableFeedbackCheckbox = document.getElementById('enable_feedback');
    const projectSlugSelect = document.getElementById('project_slug');
    const projectSelectGroup = document.getElementById('projectSelectGroup');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    
    // Set page titles
    if (isEditMode) {
        billTitle.textContent = 'Edit Bill';
        formTitle.textContent = 'Edit Bill';
        billIdInput.value = billId;
    }
    
    // Load data
    if (isEditMode) {
        loadBill();
    } else {
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
        
        // Add default item row
        updateItemNumbers();
        
        // Load default company details
        loadCompanyDetails();
    }
    
    // Load projects for feedback
    loadProjects();
    
    // Event listeners
    billForm.addEventListener('submit', saveBill);
    addBillItemBtn.addEventListener('click', addItemRow);
    cancelBtn.addEventListener('click', () => window.location.href = 'bills.html');
    
    // Toggle project selection based on feedback checkbox
    enableFeedbackCheckbox.addEventListener('change', function() {
        projectSelectGroup.style.display = this.checked ? 'block' : 'none';
    });
    
    // Add event listener for item calculations
    billItems.addEventListener('input', function(e) {
        const target = e.target;
        
        if (target.classList.contains('item-rate') || target.classList.contains('item-qty') || 
            target.classList.contains('item-amount')) {
            
            const row = target.closest('tr');
            const rateInput = row.querySelector('.item-rate');
            const qtyInput = row.querySelector('.item-qty');
            const amountInput = row.querySelector('.item-amount');
            
            // Calculate amount if rate and qty are filled
            if (target.classList.contains('item-rate') || target.classList.contains('item-qty')) {
                const rate = parseFloat(rateInput.value) || 0;
                const qty = qtyInput.value ? (parseFloat(qtyInput.value) || 1) : 1;
                
                amountInput.value = (rate * qty).toFixed(2);
            }
            
            // Update subtotal and grand total
            updateTotals();
        }
    });
    
    // GST input handler with support for percentage
    gstInput.addEventListener('input', function() {
        const value = this.value.trim();
        let gstAmount = 0;
        
        if (value.includes('%')) {
            // Handle percentage input (e.g., "18%")
            const percentage = parseFloat(value.replace('%', '')) || 0;
            const subTotal = parseFloat(subTotalInput.value) || 0;
            gstAmount = (subTotal * percentage / 100).toFixed(2);
            
            // Update GST amount display
            gstAmountDisplay.textContent = `₹${parseFloat(gstAmount).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        } else {
            // Handle direct amount input
            gstAmount = parseFloat(value) || 0;
            
            // Update GST amount display
            gstAmountDisplay.textContent = `₹${gstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }
        
        updateTotals();
    });
    
    // Round off input handler
    roundOffInput.addEventListener('input', updateTotals);
    
    // Grand total input handler
    grandTotalInput.addEventListener('input', function() {
        const grandTotal = parseFloat(this.value) || 0;
        convertNumberToWords(grandTotal);
    });
    
    // Functions
    async function loadCompanyDetails() {
        try {
            const API_URL = window.adminUtils.API_URL;
            
            const response = await fetch(`${API_URL}/company-details`);
            
            if (!response.ok) {
                console.error('Failed to load company details');
                return;
            }
            
            const company = await response.json();
            
            // Set company details form values
            companyNameInput.value = company.name || '';
            companyEmailInput.value = company.email || '';
            companyAddressInput.value = company.address || '';
            companyContactInput.value = company.contact || '';
            companyGstInput.value = company.gst_no || '';
            companyPanInput.value = company.pan || '';
            companyBankNameInput.value = company.bank_name || '';
            companyAccountNoInput.value = company.account_no || '';
            companyIfscInput.value = company.ifsc_code || '';
            
        } catch (error) {
            console.error('Error loading company details:', error);
        }
    }
    
    async function loadBill() {
        try {
            const API_URL = window.adminUtils.API_URL;
            const headers = window.adminUtils.getAuthHeaders();
            
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            
            const response = await fetch(`${API_URL}/bills/${billId}`, { headers });
            
            if (!response.ok) {
                await window.adminUtils.handleApiError(response);
                throw new Error('Failed to load bill');
            }
            
            const bill = await response.json();
            
            // Set form values
            invoiceNoInput.value = bill.invoice_no;
            
            // Format date for the date input
            if (bill.date) {
                try {
                    const dateObj = new Date(bill.date);
                    if (!isNaN(dateObj.getTime())) {
                        dateInput.value = dateObj.toISOString().split('T')[0];
                    } else {
                        dateInput.value = '';
                    }
                } catch (e) {
                    dateInput.value = '';
                }
            }
            
            billToInput.value = bill.bill_to;
            billToAddressInput.value = bill.bill_to_address;
            companyPanInput.value = bill.company_pan || '';
            suppliersRefNoInput.value = bill.suppliers_ref_no || '';
            buyersOrderNoInput.value = bill.buyers_order_no || '';
            otherTermsInput.value = bill.other_terms || '';
            
            // Set company details if available in the bill
            if (bill.company) {
                companyNameInput.value = bill.company.name || '';
                companyEmailInput.value = bill.company.email || '';
                companyAddressInput.value = bill.company.address || '';
                companyContactInput.value = bill.company.contact || '';
                companyGstInput.value = bill.company.gst_no || '';
                companyPanInput.value = bill.company.pan || '';
                companyBankNameInput.value = bill.company.bank_name || '';
                companyAccountNoInput.value = bill.company.account_no || '';
                companyIfscInput.value = bill.company.ifsc_code || '';
            } else {
                // Load default company details
                loadCompanyDetails();
            }
            
            // Clear existing items and add from bill
            billItems.innerHTML = '';
            if (bill.items && bill.items.length > 0) {
                bill.items.forEach(item => {
                    addItemRow(null, item);
                });
            } else {
                addItemRow(); // Add empty row if no items
            }
            
            // Set totals
            subTotalInput.value = bill.sub_total ? bill.sub_total.toFixed(2) : '0.00';
            
            // Set GST with original value
            if (bill.gst) {
                gstInput.value = bill.gst.toFixed(2);
                gstAmountDisplay.textContent = `₹${bill.gst.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            } else {
                gstInput.value = '';
                gstAmountDisplay.textContent = '₹0.00';
            }
            
            roundOffInput.value = bill.round_off ? bill.round_off.toFixed(2) : '';
            grandTotalInput.value = bill.grand_total ? bill.grand_total.toFixed(2) : '0.00';
            amountInWordsInput.value = bill.amount_in_words || '';
            
            // Set feedback options
            enableFeedbackCheckbox.checked = bill.enable_feedback || false;
            projectSelectGroup.style.display = enableFeedbackCheckbox.checked ? 'block' : 'none';
            
            if (bill.project_slug) {
                // Will be set once projects are loaded
                projectSlugSelect.setAttribute('data-selected', bill.project_slug);
            }
            
            // Re-enable save button
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Bill';
            
        } catch (error) {
            console.error('Error loading bill:', error);
            window.adminUtils.showToast('Error loading bill. Please try again.', 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Bill';
        }
    }
    
    async function loadProjects() {
        try {
            const API_URL = window.adminUtils.API_URL;
            const headers = window.adminUtils.getAuthHeaders();
            
            const response = await fetch(`${API_URL}/projects?active_only=true`, { headers });
            
            if (!response.ok) {
                await window.adminUtils.handleApiError(response);
                throw new Error('Failed to load projects');
            }
            
            const projects = await response.json();
            
            // Get the projects array from the response
            const projectsArray = Array.isArray(projects) ? projects : (projects.projects || []);
            
            // Sort projects by title
            projectsArray.sort((a, b) => a.title.localeCompare(b.title));
            
            let options = '<option value="">Select a project</option>';
            
            projectsArray.forEach(project => {
                options += `<option value="${project.slug}">${project.title}</option>`;
            });
            
            projectSlugSelect.innerHTML = options;
            
            // Set selected project if in edit mode
            const selectedProject = projectSlugSelect.getAttribute('data-selected');
            if (selectedProject) {
                projectSlugSelect.value = selectedProject;
            }
            
        } catch (error) {
            console.error('Error loading projects:', error);
        }
    }
    
    function addItemRow(e, itemData = null) {
        const rowHtml = `
            <tr>
                <td><input type="number" class="admin-form-control item-sr-no" value="1" min="1" readonly></td>
                <td><input type="text" class="admin-form-control item-hsn-code" placeholder="-" value="${itemData ? (itemData.hsn_code || '') : ''}"></td>
                <td><input type="text" class="admin-form-control item-description" required placeholder="Item description" value="${itemData ? itemData.description : ''}"></td>
                <td><input type="text" class="admin-form-control item-qty" placeholder="-" value="${itemData ? (itemData.qty || '') : ''}"></td>
                <td><input type="text" class="admin-form-control item-unit" placeholder="-" value="${itemData ? (itemData.unit || '') : ''}"></td>
                <td><input type="number" class="admin-form-control item-rate" required step="0.01" min="0" value="${itemData ? itemData.rate : ''}"></td>
                <td><input type="number" class="admin-form-control item-amount" required step="0.01" min="0" value="${itemData ? itemData.amount : ''}"></td>
                <td>
                    <button type="button" class="dynamic-field-remove action-btn delete" title="Remove Item">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            </tr>
        `;
        
        billItems.insertAdjacentHTML('beforeend', rowHtml);
        
        // Update item numbers
        updateItemNumbers();
        
        // Add event listener to remove button
        const removeButtons = billItems.querySelectorAll('.dynamic-field-remove');
        removeButtons.forEach(button => {
            button.addEventListener('click', removeItemRow);
        });
        
        // Update totals if data was provided
        if (itemData) {
            updateTotals();
        }
    }
    
    function removeItemRow(e) {
        const row = e.target.closest('tr');
        
        // Prevent removing the last row
        if (billItems.querySelectorAll('tr').length > 1) {
            row.remove();
            updateItemNumbers();
            updateTotals();
        } else {
            window.adminUtils.showToast('You must have at least one item', 'error');
        }
    }
    
    function updateItemNumbers() {
        const rows = billItems.querySelectorAll('tr');
        rows.forEach((row, index) => {
            const srNoInput = row.querySelector('.item-sr-no');
            srNoInput.value = index + 1;
        });
    }
    
    function updateTotals() {
        let subTotal = 0;
        
        // Calculate subtotal from items
        const rows = billItems.querySelectorAll('tr');
        rows.forEach(row => {
            const amountInput = row.querySelector('.item-amount');
            const amount = parseFloat(amountInput.value) || 0;
            subTotal += amount;
        });
        
        // Update subtotal field
        subTotalInput.value = subTotal.toFixed(2);
        
        // Calculate GST amount
        let gstAmount = 0;
        const gstValue = gstInput.value.trim();
        
        if (gstValue.includes('%')) {
            // Handle percentage input (e.g., "18%")
            const percentage = parseFloat(gstValue.replace('%', '')) || 0;
            gstAmount = (subTotal * percentage / 100);
            
            // Update GST amount display
            gstAmountDisplay.textContent = `₹${gstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        } else {
            // Handle direct amount input
            gstAmount = parseFloat(gstValue) || 0;
            gstAmountDisplay.textContent = `₹${gstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }
        
        // Get round off value
        const roundOff = parseFloat(roundOffInput.value) || 0;
        
        // Calculate grand total
        const grandTotal = subTotal + gstAmount + roundOff;
        grandTotalInput.value = grandTotal.toFixed(2);
        
        // Update amount in words
        convertNumberToWords(grandTotal);
    }
    
    function convertNumberToWords(number) {
        // Define arrays for words
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        
        // Function to convert numbers less than 1000
        function convertLessThanOneThousand(num) {
            if (num === 0) {
                return '';
            }
            
            if (num < 20) {
                return ones[num];
            }
            
            const ten = Math.floor(num / 10);
            const unit = num % 10;
            
            return tens[ten] + (unit !== 0 ? ' ' + ones[unit] : '');
        }
        
        // Main conversion function for Indian numbering system
        function convert(num) {
            if (num === 0) {
                return 'Zero';
            }
            
            // Handle negative numbers
            const negative = num < 0;
            num = Math.abs(num);
            
            // Split into integer and decimal parts
            const numStr = num.toFixed(2);
            const parts = numStr.split('.');
            const integerPart = parseInt(parts[0]);
            const decimalPart = parseInt(parts[1]);
            
            let result = '';
            
            if (integerPart === 0) {
                result = 'Zero';
            } else {
                // Convert for Indian numbering system (crores, lakhs)
                const crore = Math.floor(integerPart / 10000000);
                const lakh = Math.floor((integerPart % 10000000) / 100000);
                const thousand = Math.floor((integerPart % 100000) / 1000);
                const hundred = Math.floor((integerPart % 1000) / 100);
                const remaining = integerPart % 100;
                
                if (crore > 0) {
                    result += convertLessThanOneThousand(crore) + ' Crore ';
                }
                
                if (lakh > 0) {
                    result += convertLessThanOneThousand(lakh) + ' Lakh ';
                }
                
                if (thousand > 0) {
                    result += convertLessThanOneThousand(thousand) + ' Thousand ';
                }
                
                if (hundred > 0) {
                    result += ones[hundred] + ' Hundred ';
                }
                
                if (remaining > 0) {
                    if (result !== '') {
                        result += 'and ';
                    }
                    result += convertLessThanOneThousand(remaining);
                }
                
                result = result.trim();
            }
            
            // Add paise if there are any
            if (decimalPart > 0) {
                result += ' and ' + convertLessThanOneThousand(decimalPart) + ' Paise';
            }
            
            // Add 'Rupees' prefix and 'Only' suffix
            result = 'Rupees ' + result + ' Only';
            
            // Add negative prefix if needed
            return (negative ? 'Negative ' : '') + result;
        }
        
        // Update the amount in words field
        amountInWordsInput.value = convert(number);
    }
    
    async function saveBill(e) {
        e.preventDefault();
        
        try {
            // Validate form
            if (!billForm.checkValidity()) {
                billForm.reportValidity();
                return;
            }
            
            // Show saving state
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            
            // Process GST input for saving
            let gstValue = 0;
            const gstInputValue = gstInput.value.trim();
            
            if (gstInputValue.includes('%')) {
                // Convert percentage to amount
                const percentage = parseFloat(gstInputValue.replace('%', '')) || 0;
                const subTotal = parseFloat(subTotalInput.value) || 0;
                gstValue = (subTotal * percentage / 100);
            } else {
                // Use direct amount
                gstValue = parseFloat(gstInputValue) || 0;
            }
            
            // Gather form data
            const formData = {
                invoice_no: invoiceNoInput.value,
                date: dateInput.value,
                bill_to: billToInput.value,
                bill_to_address: billToAddressInput.value,
                company_pan: companyPanInput.value || null,
                suppliers_ref_no: suppliersRefNoInput.value || null,
                buyers_order_no: buyersOrderNoInput.value || null,
                other_terms: otherTermsInput.value || null,
                items: [],
                sub_total: parseFloat(subTotalInput.value),
                gst: gstValue || null,
                round_off: roundOffInput.value ? parseFloat(roundOffInput.value) : null,
                grand_total: parseFloat(grandTotalInput.value),
                amount_in_words: amountInWordsInput.value,
                enable_feedback: enableFeedbackCheckbox.checked,
                // Include company details
                company: {
                    name: companyNameInput.value,
                    email: companyEmailInput.value,
                    address: companyAddressInput.value,
                    contact: companyContactInput.value,
                    gst_no: companyGstInput.value || null,
                    pan: companyPanInput.value || null,
                    bank_name: companyBankNameInput.value || null,
                    account_no: companyAccountNoInput.value,
                    ifsc_code: companyIfscInput.value
                }
            };
            
            // Add project slug if feedback is enabled
            if (formData.enable_feedback && projectSlugSelect.value) {
                formData.project_slug = projectSlugSelect.value;
            }
            
            // Gather items
            const rows = billItems.querySelectorAll('tr');
            rows.forEach(row => {
                const srNo = parseInt(row.querySelector('.item-sr-no').value);
                const hsnCode = row.querySelector('.item-hsn-code').value;
                const description = row.querySelector('.item-description').value;
                const qty = row.querySelector('.item-qty').value;
                const unit = row.querySelector('.item-unit').value;
                const rate = parseFloat(row.querySelector('.item-rate').value);
                const amount = parseFloat(row.querySelector('.item-amount').value);
                
                formData.items.push({
                    sr_no: srNo,
                    hsn_code: hsnCode || null,
                    description,
                    qty: qty || null,
                    unit: unit || null,
                    rate,
                    amount
                });
            });
            
            // Save to API
            const API_URL = window.adminUtils.API_URL;
            const headers = window.adminUtils.getAuthHeaders();
            
            let url = `${API_URL}/bills`;
            let method = 'POST';
            
            if (isEditMode) {
                url = `${API_URL}/bills/${billId}`;
                method = 'PUT';
            }
            
            const response = await fetch(url, {
                method,
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                await window.adminUtils.handleApiError(response);
                throw new Error('Failed to save bill');
            }
            
            const savedBill = await response.json();
            
            window.adminUtils.showToast('Bill saved successfully', 'success');
            
            // Redirect to bills list after short delay
            setTimeout(() => {
                window.location.href = 'bills.html';
            }, 1000);
            
        } catch (error) {
            console.error('Error saving bill:', error);
            window.adminUtils.showToast('Error saving bill: ' + (error.message || 'Please try again'), 'error');
            
            // Reset save button
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Bill';
        }
    }
});
