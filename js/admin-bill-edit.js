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
    const billItems = document.getElementById('billItems');
    const addBillItemBtn = document.getElementById('addBillItem');
    const subTotalInput = document.getElementById('sub_total');
    const gstInput = document.getElementById('gst');
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
        const today = new Date();
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        dateInput.value = today.toLocaleDateString('en-IN', options);
        
        // Add default item row
        updateItemNumbers();
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
    
    // Add listener for grand total changes
    grandTotalInput.addEventListener('input', function() {
        const grandTotal = parseFloat(this.value) || 0;
        convertNumberToWords(grandTotal);
    });
    
    // Functions
    async function loadBill() {
        try {
            const API_URL = window.adminUtils.API_URL;
            const headers = window.adminUtils.getAuthHeaders();
            
            const response = await fetch(`${API_URL}/bills/${billId}`, { headers });
            
            if (!response.ok) {
                await window.adminUtils.handleApiError(response);
                throw new Error('Failed to load bill');
            }
            
            const bill = await response.json();
            
            // Set form values
            invoiceNoInput.value = bill.invoice_no;
            dateInput.value = bill.date;
            billToInput.value = bill.bill_to;
            billToAddressInput.value = bill.bill_to_address;
            companyPanInput.value = bill.company_pan || '';
            suppliersRefNoInput.value = bill.suppliers_ref_no || '';
            buyersOrderNoInput.value = bill.buyers_order_no || '';
            otherTermsInput.value = bill.other_terms || '';
            
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
            subTotalInput.value = bill.sub_total.toFixed(2);
            gstInput.value = bill.gst ? bill.gst.toFixed(2) : '';
            roundOffInput.value = bill.round_off ? bill.round_off.toFixed(2) : '';
            grandTotalInput.value = bill.grand_total.toFixed(2);
            amountInWordsInput.value = bill.amount_in_words;
            
            // Set feedback options
            enableFeedbackCheckbox.checked = bill.enable_feedback || false;
            projectSelectGroup.style.display = enableFeedbackCheckbox.checked ? 'block' : 'none';
            
            if (bill.project_slug) {
                // Will be set once projects are loaded
                projectSlugSelect.setAttribute('data-selected', bill.project_slug);
            }
            
        } catch (error) {
            console.error('Error loading bill:', error);
            showToast('Error loading bill. Please try again.', 'error');
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
            
            let options = '<option value="">Select a project</option>';
            
            projects.forEach(project => {
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
                <td><input type="number" class="admin-form-control item-sr-no" value="1" min="1"></td>
                <td><input type="text" class="admin-form-control item-hsn-code" placeholder="-" value="${itemData ? (itemData.hsn_code || '') : ''}"></td>
                <td><input type="text" class="admin-form-control item-description" required placeholder="Item description" value="${itemData ? itemData.description : ''}"></td>
                <td><input type="text" class="admin-form-control item-qty" placeholder="-" value="${itemData ? (itemData.qty || '') : ''}"></td>
                <td><input type="text" class="admin-form-control item-unit" placeholder="-" value="${itemData ? (itemData.unit || '') : ''}"></td>
                <td><input type="number" class="admin-form-control item-rate" required step="0.01" min="0" value="${itemData ? itemData.rate : ''}"></td>
                <td><input type="number" class="admin-form-control item-amount" required step="0.01" min="0" value="${itemData ? itemData.amount : ''}"></td>
                <td>
                    <button type="button" class="dynamic-field-remove action-btn delete">
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
            showToast('You must have at least one item', 'error');
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
        
        // Calculate grand total
        const gst = parseFloat(gstInput.value) || 0;
        const roundOff = parseFloat(roundOffInput.value) || 0;
        
        const grandTotal = subTotal + gst + roundOff;
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
        
        // Main conversion function
        function convert(num) {
            if (num === 0) {
                return 'Zero';
            }
            
            // Handle negative numbers
            const negative = num < 0;
            num = Math.abs(num);
            
            // Split into integer and decimal parts
            const parts = num.toString().split('.');
            const integerPart = parseInt(parts[0]);
            
            let result = '';
            
            if (integerPart === 0) {
                result = 'Zero';
            } else {
                // Convert for Indian numbering system (crores, lakhs)
                const crore = Math.floor(integerPart / 10000000);
                const lakh = Math.floor((integerPart % 10000000) / 100000);
                const thousand = Math.floor((integerPart % 100000) / 1000);
                const remaining = integerPart % 1000;
                
                if (crore > 0) {
                    result += convertLessThanOneThousand(crore) + ' Crore ';
                }
                
                if (lakh > 0) {
                    result += convertLessThanOneThousand(lakh) + ' Lakh ';
                }
                
                if (thousand > 0) {
                    result += convertLessThanOneThousand(thousand) + ' Thousand ';
                }
                
                if (remaining > 0) {
                    result += convertLessThanOneThousand(remaining);
                }
                
                result = result.trim();
            }
            
            // Add 'Only' suffix
            result += ' Only';
            
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
                gst: gstInput.value ? parseFloat(gstInput.value) : null,
                round_off: roundOffInput.value ? parseFloat(roundOffInput.value) : null,
                grand_total: parseFloat(grandTotalInput.value),
                amount_in_words: amountInWordsInput.value,
                enable_feedback: enableFeedbackCheckbox.checked
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
            window.adminUtils.showToast('Error saving bill. Please try again.', 'error');
        }
    }
});