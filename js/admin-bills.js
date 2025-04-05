document.addEventListener('DOMContentLoaded', function() {
    // Variables
    let currentPage = 1;
    const itemsPerPage = 10;
    let totalBills = 0;
    let bills = [];
    let currentBillId = null;

    // Elements
    const billsList = document.getElementById('billsList');
    const billsPagination = document.getElementById('billsPagination');
    const billSearch = document.getElementById('billSearch');
    const refreshBillsBtn = document.getElementById('refreshBills');
    
    // Modals
    const billLinkModal = document.getElementById('billLinkModal');
    const closeBillLinkModal = document.getElementById('closeBillLinkModal');
    const billLink = document.getElementById('billLink');
    const copyBillLink = document.getElementById('copyBillLink');
    const previewBillBtn = document.getElementById('previewBillBtn');
    const downloadBillBtn = document.getElementById('downloadBillBtn');
    
    const deleteModal = document.getElementById('deleteModal');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const deleteBillInvoice = document.getElementById('deleteBillInvoice');
    const deleteBillClient = document.getElementById('deleteBillClient');
    const cancelDelete = document.getElementById('cancelDelete');
    const confirmDelete = document.getElementById('confirmDelete');

    // Load bills on page load
    loadBills();

    // Event listeners
    refreshBillsBtn.addEventListener('click', loadBills);
    
    billSearch.addEventListener('input', debounce(function() {
        currentPage = 1;
        loadBills();
    }, 300));
    
    // Modal event listeners
    closeBillLinkModal.addEventListener('click', () => toggleModal(billLinkModal, false));
    closeDeleteModal.addEventListener('click', () => toggleModal(deleteModal, false));
    cancelDelete.addEventListener('click', () => toggleModal(deleteModal, false));
    confirmDelete.addEventListener('click', deleteBill);
    
    copyBillLink.addEventListener('click', function() {
        billLink.select();
        document.execCommand('copy');
        showToast('Link copied to clipboard!', 'success');
    });

    // Functions
    async function loadBills() {
        try {
            showLoading(billsList);
            
            // Use the API_URL from adminUtils
            const API_URL = window.adminUtils.API_URL;
            const searchTerm = billSearch.value.trim();
            
            // Use fetch with auth headers from adminUtils
            const headers = window.adminUtils.getAuthHeaders();
            const response = await fetch(`${API_URL}/bills`, { headers });
            
            if (!response.ok) {
                await window.adminUtils.handleApiError(response);
                throw new Error('Failed to load bills');
            }
            
            bills = await response.json();
            
            // Filter bills if search term exists
            if (searchTerm) {
                bills = bills.filter(bill => 
                    bill.invoice_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    bill.bill_to.toLowerCase().includes(searchTerm.toLowerCase())
                );
            }
            
            totalBills = bills.length;
            
            // Calculate pagination
            const totalPages = Math.ceil(totalBills / itemsPerPage);
            
            // Adjust current page if needed
            if (currentPage > totalPages && totalPages > 0) {
                currentPage = totalPages;
            }
            
            // Get bills for current page
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const currentBills = bills.slice(startIndex, endIndex);
            
            renderBills(currentBills);
            renderPagination(totalPages, currentPage);
            
        } catch (error) {
            console.error('Error loading bills:', error);
            billsList.innerHTML = `<tr><td colspan="6" class="text-center">Error loading bills. Please try again.</td></tr>`;
        }
    }

    function renderBills(bills) {
        if (bills.length === 0) {
            billsList.innerHTML = `<tr><td colspan="6" class="text-center">No bills found.</td></tr>`;
            return;
        }
        
        let html = '';
        
        bills.forEach(bill => {
            html += `
                <tr>
                    <td>${escapeHtml(bill.invoice_no)}</td>
                    <td>${escapeHtml(bill.bill_to)}</td>
                    <td>${escapeHtml(bill.date)}</td>
                    <td>₹${bill.grand_total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td>${bill.enable_feedback ? '<span class="status-badge status-active">Enabled</span>' : '<span class="status-badge status-inactive">Disabled</span>'}</td>
                    <td>
                        <div class="actions">
                            <button class="action-btn share-bill" data-id="${bill._id}" title="Share Bill">
                                <i class="fas fa-share-alt"></i>
                            </button>
                            <a href="bill-edit.html?id=${bill._id}" class="action-btn" title="Edit Bill">
                                <i class="fas fa-edit"></i>
                            </a>
                            <button class="action-btn delete delete-bill" data-id="${bill._id}" data-invoice="${bill.invoice_no}" data-client="${bill.bill_to}" title="Delete Bill">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        billsList.innerHTML = html;
        
        // Add event listeners to buttons
        document.querySelectorAll('.share-bill').forEach(button => {
            button.addEventListener('click', function() {
                const billId = this.getAttribute('data-id');
                openShareModal(billId);
            });
        });
        
        document.querySelectorAll('.delete-bill').forEach(button => {
            button.addEventListener('click', function() {
                const billId = this.getAttribute('data-id');
                const invoice = this.getAttribute('data-invoice');
                const client = this.getAttribute('data-client');
                openDeleteModal(billId, invoice, client);
            });
        });
    }

    function renderPagination(totalPages, currentPage) {
        if (totalPages <= 1) {
            billsPagination.innerHTML = '';
            return;
        }
        
        let html = '';
        
        // Previous button
        html += `
            <button class="pagination-item ${currentPage === 1 ? 'disabled' : ''}" 
                ${currentPage === 1 ? 'disabled' : 'data-page="' + (currentPage - 1) + '"'}>
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Page numbers
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <button class="pagination-item ${i === currentPage ? 'active' : ''}" data-page="${i}">
                    ${i}
                </button>
            `;
        }
        
        // Next button
        html += `
            <button class="pagination-item ${currentPage === totalPages ? 'disabled' : ''}" 
                ${currentPage === totalPages ? 'disabled' : 'data-page="' + (currentPage + 1) + '"'}>
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        billsPagination.innerHTML = html;
        
        // Add event listeners to pagination items
        document.querySelectorAll('.pagination-item:not(.disabled):not(.active)').forEach(item => {
            item.addEventListener('click', function() {
                currentPage = parseInt(this.getAttribute('data-page'));
                loadBills();
            });
        });
    }

    function openShareModal(billId) {
        const bill = bills.find(b => b._id === billId);
        if (!bill) return;
        
        // Use the BASE_URL from the window or a default
        const BASE_URL = window.location.origin;
        
        billLink.value = `${BASE_URL}/bill?code=${bill.bill_code}`;
        previewBillBtn.href = `${BASE_URL}/bill?code=${bill.bill_code}`;
        downloadBillBtn.href = `${window.adminUtils.API_URL}/bills/${billId}/download`;
        
        toggleModal(billLinkModal, true);
    }

    function openDeleteModal(billId, invoice, client) {
        currentBillId = billId;
        deleteBillInvoice.textContent = invoice;
        deleteBillClient.textContent = client;
        toggleModal(deleteModal, true);
    }

    async function deleteBill() {
        if (!currentBillId) return;
        
        try {
            const API_URL = window.adminUtils.API_URL;
            const headers = window.adminUtils.getAuthHeaders();
            
            const response = await fetch(`${API_URL}/bills/${currentBillId}`, {
                method: 'DELETE',
                headers
            });
            
            if (!response.ok) {
                await window.adminUtils.handleApiError(response);
                throw new Error('Failed to delete bill');
            }
            
            toggleModal(deleteModal, false);
            showToast('Bill deleted successfully', 'success');
            loadBills();
            
        } catch (error) {
            console.error('Error deleting bill:', error);
            showToast('Error deleting bill. Please try again.', 'error');
        }
    }

    function showLoading(element) {
        element.innerHTML = `<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>`;
    }
});