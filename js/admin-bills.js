document.addEventListener('DOMContentLoaded', function() {
    const { API_URL, getAuthHeaders, handleApiError, formatDate, showToast, toggleModal, debounce, escapeHtml } = window.adminUtils;
    
    // Variables
    let currentPage = 1;
    const itemsPerPage = 10;
    let totalBills = 0;
    let totalPages = 0;
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
    const emailBillBtn = document.getElementById('emailBillBtn');
    const enableFeedback = document.getElementById('enableFeedback');
    
    const deleteModal = document.getElementById('deleteModal');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const deleteBillInvoice = document.getElementById('deleteBillInvoice');
    const deleteBillClient = document.getElementById('deleteBillClient');
    const cancelDelete = document.getElementById('cancelDelete');
    const confirmDelete = document.getElementById('confirmDelete');

    // Load bills on page load
    loadBills();

    // Event listeners
    if (refreshBillsBtn) {
        refreshBillsBtn.addEventListener('click', function() {
            loadBills();
        });
    }
    
    if (billSearch) {
        billSearch.addEventListener('input', debounce(function() {
            currentPage = 1;
            loadBills();
        }, 500));
        
        // Clear search with Escape key
        billSearch.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                this.value = '';
                loadBills();
            }
        });
    }
    
    // Modal event listeners
    if (closeBillLinkModal) {
        closeBillLinkModal.addEventListener('click', function() {
            toggleModal(billLinkModal, false);
        });
    }
    
    if (closeDeleteModal) {
        closeDeleteModal.addEventListener('click', function() {
            toggleModal(deleteModal, false);
        });
    }
    
    if (cancelDelete) {
        cancelDelete.addEventListener('click', function() {
            toggleModal(deleteModal, false);
        });
    }
    
    if (confirmDelete) {
        confirmDelete.addEventListener('click', deleteBill);
    }
    
    if (copyBillLink) {
        copyBillLink.addEventListener('click', function() {
            billLink.select();
            document.execCommand('copy');
            showToast('Link copied to clipboard!', 'success');
        });
    }
    
    if (enableFeedback) {
        enableFeedback.addEventListener('change', toggleFeedback);
    }
    
    if (emailBillBtn) {
        emailBillBtn.addEventListener('click', emailBill);
    }

    // Functions
    async function loadBills() {
        try {
            billsList.innerHTML = `<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading bills...</td></tr>`;
            
            if (refreshBillsBtn) {
                refreshBillsBtn.disabled = true;
                refreshBillsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            }
            
            // Calculate skip for pagination
            const skip = (currentPage - 1) * itemsPerPage;
            
            // Build query parameters
            let url = `${API_URL}/bills?skip=${skip}&limit=${itemsPerPage}`;
            
            const searchTerm = billSearch ? billSearch.value.trim() : '';
            if (searchTerm) {
                url += `&search=${encodeURIComponent(searchTerm)}`;
            }
            
            const response = await fetch(url, {
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            const data = await response.json();
            
            // Store bills data
            bills = data.bills || data; // Handle different API response formats
            
            // Get total count from response metadata or estimate
            totalBills = data.total || bills.length;
            totalPages = Math.ceil(totalBills / itemsPerPage);
            
            // Render bills
            renderBills(bills);
            
            // Update pagination
            renderPagination();
            
        } catch (error) {
            console.error('Error loading bills:', error);
            billsList.innerHTML = `<tr><td colspan="6" class="text-center text-danger"><i class="fas fa-exclamation-circle"></i> Failed to load bills</td></tr>`;
        } finally {
            if (refreshBillsBtn) {
                refreshBillsBtn.disabled = false;
                refreshBillsBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            }
        }
    }

    function renderBills(bills) {
        if (!bills || bills.length === 0) {
            billsList.innerHTML = `<tr><td colspan="6" class="text-center">No bills found</td></tr>`;
            return;
        }
        
        let html = '';
        
        bills.forEach(bill => {
            const formattedAmount = new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0
            }).format(bill.grand_total || 0);
            
            html += `
                <tr>
                    <td><span class="bill-number">${escapeHtml(bill.invoice_no)}</span></td>
                    <td>${escapeHtml(bill.bill_to)}</td>
                    <td><span class="bill-date">${formatDate(bill.date)}</span></td>
                    <td>${formattedAmount}</td>
                    <td>${bill.enable_feedback ? 
                        '<span class="status-badge status-active">Enabled</span>' : 
                        '<span class="status-badge status-inactive">Disabled</span>'}</td>
                    <td>
                        <div class="actions">
                            <button class="action-btn share-bill" title="Share Bill" onclick="shareBill('${bill._id}')">
                                <i class="fas fa-share-alt"></i>
                            </button>
                            <a href="bill-edit.html?id=${bill._id}" class="action-btn" title="Edit Bill">
                                <i class="fas fa-edit"></i>
                            </a>
                            <button class="action-btn delete" title="Delete Bill" onclick="confirmDeleteBill('${bill._id}')">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        billsList.innerHTML = html;
    }

    function renderPagination() {
        if (totalPages <= 1) {
            billsPagination.innerHTML = '';
            return;
        }
        
        let html = '';
        
        // Previous button
        html += `
            <button class="pagination-item ${currentPage === 1 ? 'disabled' : ''}" 
                ${currentPage === 1 ? 'disabled' : `onclick="changePage(${currentPage - 1})"`}>
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Page numbers
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        
        // Adjust start page if end page is maxed out
        if (endPage === totalPages) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
        
        // First page button if not starting from page 1
        if (startPage > 1) {
            html += `
                <button class="pagination-item" onclick="changePage(1)">1</button>
            `;
            
            // Add ellipsis if there's a gap
            if (startPage > 2) {
                html += `<span class="pagination-item disabled">...</span>`;
            }
        }
        
        // Page numbers
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <button class="pagination-item ${i === currentPage ? 'active' : ''}" 
                    onclick="changePage(${i})">
                    ${i}
                </button>
            `;
        }
        
        // Last page button if not ending at last page
        if (endPage < totalPages) {
            // Add ellipsis if there's a gap
            if (endPage < totalPages - 1) {
                html += `<span class="pagination-item disabled">...</span>`;
            }
            
            html += `
                <button class="pagination-item" onclick="changePage(${totalPages})">
                    ${totalPages}
                </button>
            `;
        }
        
        // Next button
        html += `
            <button class="pagination-item ${currentPage === totalPages ? 'disabled' : ''}" 
                ${currentPage === totalPages ? 'disabled' : `onclick="changePage(${currentPage + 1})"`}>
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        billsPagination.innerHTML = html;
    }
    
    // Change page
    window.changePage = function(page) {
        if (page < 1 || page > totalPages || page === currentPage) return;
        currentPage = page;
        loadBills();
        // Scroll to top of table
        document.querySelector('.admin-table-responsive').scrollIntoView({ behavior: 'smooth' });
    };

    // Share bill
    window.shareBill = function(billId) {
        const bill = bills.find(b => b._id === billId);
        if (!bill) return;
        
        currentBillId = billId;
        
        // Use the BASE_URL from the window or a default
        const BASE_URL = window.location.origin;
        
        // Set link and buttons
        billLink.value = `${BASE_URL}/bill?code=${bill.bill_code || billId}`;
        previewBillBtn.href = `${BASE_URL}/bill?code=${bill.bill_code || billId}`;
        downloadBillBtn.href = `${API_URL}/bills/${billId}/download`;
        
        // Set feedback toggle
        if (enableFeedback) {
            enableFeedback.checked = bill.enable_feedback || false;
        }
        
        toggleModal(billLinkModal, true);
    };
    
    // Toggle feedback
    async function toggleFeedback() {
        if (!currentBillId) return;
        
        try {
            const enabled = enableFeedback.checked;
            
            const response = await fetch(`${API_URL}/bills/${currentBillId}/feedback`, {
                method: 'PUT',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ enable_feedback: enabled })
            });
            
            await handleApiError(response);
            
            // Update local data
            const index = bills.findIndex(b => b._id === currentBillId);
            if (index !== -1) {
                bills[index].enable_feedback = enabled;
            }
            
            showToast(`Feedback ${enabled ? 'enabled' : 'disabled'} for this bill`, 'success');
            
        } catch (error) {
            console.error('Error toggling feedback:', error);
            showToast('Failed to update feedback setting', 'error');
            
            // Revert toggle
            enableFeedback.checked = !enableFeedback.checked;
        }
    }
    
    // Email bill to client
    async function emailBill(e) {
        e.preventDefault();
        
        if (!currentBillId) return;
        
        try {
            emailBillBtn.disabled = true;
            emailBillBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            
            const response = await fetch(`${API_URL}/bills/${currentBillId}/email`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            
            showToast('Bill sent to client via email', 'success');
            
        } catch (error) {
            console.error('Error emailing bill:', error);
            showToast('Failed to send email: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            emailBillBtn.disabled = false;
            emailBillBtn.innerHTML = '<i class="fas fa-envelope"></i> Email to Client';
        }
    }

    // Confirm delete bill
    window.confirmDeleteBill = function(billId) {
        const bill = bills.find(b => b._id === billId);
        if (!bill) return;
        
        currentBillId = billId;
        
        deleteBillInvoice.textContent = bill.invoice_no;
        deleteBillClient.textContent = bill.bill_to;
        
        toggleModal(deleteModal, true);
    };

    async function deleteBill() {
        if (!currentBillId) return;
        
        try {
            confirmDelete.disabled = true;
            confirmDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
            
            const response = await fetch(`${API_URL}/bills/${currentBillId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            
            // Close modal and reload bills
            toggleModal(deleteModal, false);
            showToast('Bill deleted successfully', 'success');
            
            // Remove from local data
            bills = bills.filter(b => b._id !== currentBillId);
            
            // Reset current page if it would be empty after deletion
            if ((currentPage - 1) * itemsPerPage >= bills.length && currentPage > 1) {
                currentPage--;
            }
            
            // Reload bills or render existing data
            if (bills.length === 0) {
                loadBills();
            } else {
                renderBills(bills);
                renderPagination();
            }
            
        } catch (error) {
            console.error('Error deleting bill:', error);
            showToast('Failed to delete bill: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            confirmDelete.disabled = false;
            confirmDelete.innerHTML = 'Delete';
        }
    }
    
    // Handle keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Escape key to close modals
        if (e.key === 'Escape') {
            if (billLinkModal.classList.contains('active')) {
                toggleModal(billLinkModal, false);
            } else if (deleteModal.classList.contains('active')) {
                toggleModal(deleteModal, false);
            }
        }
    });
});
