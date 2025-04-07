document.addEventListener('DOMContentLoaded', function() {
    const { API_URL, getAuthHeaders, handleApiError, formatDate, showToast, toggleModal, debounce, escapeHtml } = window.adminUtils;
    const messagesList = document.getElementById('messagesList');
    const messageSearch = document.getElementById('messageSearch');
    const messageFilter = document.getElementById('messageFilter');
    const refreshMessages = document.getElementById('refreshMessages');
    const messagesPagination = document.getElementById('messagesPagination');
    const messageCount = document.getElementById('messageCount');
    
    // View message modal elements
    const viewMessageModal = document.getElementById('viewMessageModal');
    const closeViewModal = document.getElementById('closeViewModal');
    const closeMessageBtn = document.getElementById('closeMessageBtn');
    const messageFrom = document.getElementById('messageFrom');
    const messageEmail = document.getElementById('messageEmail');
    const messagePhone = document.getElementById('messagePhone');
    const messageCompany = document.getElementById('messageCompany');
    const messageSubject = document.getElementById('messageSubject');
    const messageDate = document.getElementById('messageDate');
    const messageContent = document.getElementById('messageContent');
    const replyEmailBtn = document.getElementById('replyEmailBtn');
    
    // Delete modal elements
    const deleteModal = document.getElementById('deleteModal');
    const deleteMessageFrom = document.getElementById('deleteMessageFrom');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const cancelDelete = document.getElementById('cancelDelete');
    const confirmDelete = document.getElementById('confirmDelete');
    
    // Pagination variables
    let currentPage = 1;
    const itemsPerPage = 10;
    let totalMessages = 0;
    let totalPages = 0;
    
    // Filter variables
    let searchTerm = '';
    let filterStatus = 'all';
    
    // Current messages data
    let messages = [];
    
    // Message to delete
    let messageToDelete = null;
    
    // Load messages
    async function loadMessages() {
        try {
            messagesList.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading messages...</td></tr>';
            
            if (refreshMessages) {
                refreshMessages.disabled = true;
                refreshMessages.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            }
            
            // Calculate skip for pagination
            const skip = (currentPage - 1) * itemsPerPage;
            
            // Build query parameters
            let url = `${API_URL}/contact?skip=${skip}&limit=${itemsPerPage}`;
            if (filterStatus !== 'all') {
                url += `&status=${filterStatus}`;
            }
            if (searchTerm) {
                url += `&search=${encodeURIComponent(searchTerm)}`;
            }
            
            const response = await fetch(url, {
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            const data = await response.json();
            
            // Store messages data
            messages = data.messages || data; // Handle different API response formats
            
            // Get total count from response metadata or estimate
            totalMessages = data.total || messages.length;
            totalPages = Math.ceil(totalMessages / itemsPerPage);
            
            // Update message count
            if (messageCount) {
                messageCount.textContent = totalMessages;
            }
            
            // Render messages
            renderMessages(messages);
            
            // Update pagination
            renderPagination();
            
        } catch (error) {
            console.error('Error loading messages:', error);
            messagesList.innerHTML = '<tr><td colspan="5" class="text-center text-danger"><i class="fas fa-exclamation-circle"></i> Failed to load messages</td></tr>';
        } finally {
            if (refreshMessages) {
                refreshMessages.disabled = false;
                refreshMessages.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            }
        }
    }
    
    // Render messages in table
    function renderMessages(messages) {
        if (!messages || messages.length === 0) {
            messagesList.innerHTML = '<tr><td colspan="5" class="text-center">No messages found</td></tr>';
            return;
        }
        
        let html = '';
        messages.forEach(message => {
            const isUnread = message.status === 'unread' || !message.status;
            const rowClass = isUnread ? 'unread' : '';
            
            html += `
                <tr class="${rowClass}">
                    <td>${escapeHtml(message.name)}</td>
                    <td>${escapeHtml(message.email)}</td>
                    <td>${escapeHtml(message.subject)}</td>
                    <td>${formatDate(message.created_at)}</td>
                    <td>
                        <div class="actions">
                            <button class="action-btn" title="View" onclick="viewMessage('${message._id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="action-btn delete" title="Delete" onclick="confirmDeleteMessage('${message._id}', '${escapeHtml(message.name)}')">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        messagesList.innerHTML = html;
    }
    
    // Render pagination
    function renderPagination() {
        if (totalPages <= 1) {
            messagesPagination.innerHTML = '';
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
        
        messagesPagination.innerHTML = html;
    }
    
    // Change page
    window.changePage = function(page) {
        if (page < 1 || page > totalPages || page === currentPage) return;
        currentPage = page;
        loadMessages();
        // Scroll to top of table
        document.querySelector('.admin-table-responsive').scrollIntoView({ behavior: 'smooth' });
    };
    
    // Mark message as read
    async function markAsRead(id) {
        try {
            const response = await fetch(`${API_URL}/contact/${id}/read`, {
                method: 'PUT',
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            
            // Update message in local data
            const messageIndex = messages.findIndex(m => m._id === id);
            if (messageIndex !== -1) {
                messages[messageIndex].status = 'read';
                renderMessages(messages);
            }
            
        } catch (error) {
            console.error('Error marking message as read:', error);
            // Continue anyway, not critical
        }
    }
    
    // View message details
    window.viewMessage = async function(id) {
        const message = messages.find(m => m._id === id);
        if (!message) return;
        
        // Fill modal with message details
        messageFrom.textContent = message.name || 'N/A';
        messageEmail.textContent = message.email || 'N/A';
        messagePhone.textContent = message.phone || 'N/A';
        messageCompany.textContent = message.company || 'N/A';
        messageSubject.textContent = message.subject || 'N/A';
        messageDate.textContent = formatDate(message.created_at);
        messageContent.textContent = message.message || 'No message content';
        
        // Set reply email link
        replyEmailBtn.href = `mailto:${message.email}?subject=Re: ${message.subject}`;
        
        // Show modal
        toggleModal(viewMessageModal, true);
        
        // Mark as read if it was unread
        if (message.status === 'unread' || !message.status) {
            await markAsRead(id);
        }
    };
    
    // Close view modal
    if (closeViewModal) {
        closeViewModal.addEventListener('click', function() {
            toggleModal(viewMessageModal, false);
        });
    }
    
    if (closeMessageBtn) {
        closeMessageBtn.addEventListener('click', function() {
            toggleModal(viewMessageModal, false);
        });
    }
    
    // Confirm delete message
    window.confirmDeleteMessage = function(id, name) {
        messageToDelete = id;
        deleteMessageFrom.textContent = name;
        toggleModal(deleteModal, true);
    };
    
    // Close delete modal
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
    
    // Delete message
    if (confirmDelete) {
        confirmDelete.addEventListener('click', async function() {
            if (!messageToDelete) return;
            
            try {
                confirmDelete.disabled = true;
                confirmDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
                
                const response = await fetch(`${API_URL}/contact/${messageToDelete}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                
                await handleApiError(response);
                
                // Close modal and reload messages
                toggleModal(deleteModal, false);
                showToast('Message deleted successfully', 'success');
                
                // Reset current page if it would be empty after deletion
                if (messages.length === 1 && currentPage > 1) {
                    currentPage--;
                }
                
                loadMessages();
                
            } catch (error) {
                console.error('Error deleting message:', error);
                showToast('Failed to delete message: ' + (error.message || 'Unknown error'), 'error');
            } finally {
                confirmDelete.disabled = false;
                confirmDelete.innerHTML = 'Delete';
                toggleModal(deleteModal, false);
            }
        });
    }
    
    // Debounced search input
    const debouncedSearch = debounce(function() {
        searchTerm = messageSearch.value.trim();
        currentPage = 1; // Reset to first page on search
        loadMessages();
    }, 500);
    
    // Event listeners
    if (messageSearch) {
        messageSearch.addEventListener('input', debouncedSearch);
        
        // Clear search with Escape key
        messageSearch.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                this.value = '';
                debouncedSearch();
            }
        });
    }
    
    if (messageFilter) {
        messageFilter.addEventListener('change', function() {
            filterStatus = this.value;
            currentPage = 1; // Reset to first page on filter change
            loadMessages();
        });
    }
    
    if (refreshMessages) {
        refreshMessages.addEventListener('click', function() {
            loadMessages();
        });
    }
    
    // Check for message id in URL
    function checkUrlForMessageId() {
        const urlParams = new URLSearchParams(window.location.search);
        const messageId = urlParams.get('id');
        
        if (messageId) {
            // Wait for messages to load then open the specified message
            setTimeout(() => {
                const message = messages.find(m => m._id === messageId);
                if (message) {
                    viewMessage(messageId);
                } else {
                    showToast('Message not found', 'error');
                }
            }, 1000);
        }
    }
    
    // Handle keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Escape key to close modals
        if (e.key === 'Escape') {
            if (viewMessageModal.classList.contains('active')) {
                toggleModal(viewMessageModal, false);
            } else if (deleteModal.classList.contains('active')) {
                toggleModal(deleteModal, false);
            }
        }
        
        // Prevent default for our shortcuts
        if ((e.key === 'f' || e.key === 'F') && e.ctrlKey) {
            e.preventDefault();
            messageSearch.focus();
        }
    });
    
    // Clipboard functionality for email
    messageEmail.addEventListener('click', function() {
        if (!this.textContent || this.textContent === 'N/A') return;
        
        const email = this.textContent;
        navigator.clipboard.writeText(email)
            .then(() => {
                showToast('Email copied to clipboard', 'success');
            })
            .catch(() => {
                showToast('Failed to copy email', 'error');
            });
    });
    
    // Add tooltip to email field
    messageEmail.title = 'Click to copy email';
    messageEmail.style.cursor = 'pointer';
    
    // Mark all as read functionality (if available in API)
    async function markAllAsRead() {
        try {
            const response = await fetch(`${API_URL}/contact/mark-all-read`, {
                method: 'PUT',
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                // If endpoint doesn't exist, just show a message
                if (response.status === 404) {
                    showToast('This feature is not available', 'error');
                    return;
                }
                
                await handleApiError(response);
            }
            
            showToast('All messages marked as read', 'success');
            loadMessages();
            
        } catch (error) {
            console.error('Error marking all as read:', error);
            showToast('Failed to mark messages as read', 'error');
        }
    }
    
    // Check for unread messages
    function hasUnreadMessages() {
        return messages.some(m => m.status === 'unread' || !m.status);
    }
    
    // Auto-refresh messages periodically (if needed)
    let autoRefreshInterval;
    
    function startAutoRefresh() {
        // Refresh every 5 minutes
        autoRefreshInterval = setInterval(() => {
            // Only refresh if the user isn't interacting with the page
            if (!viewMessageModal.classList.contains('active') && 
                !deleteModal.classList.contains('active')) {
                loadMessages();
            }
        }, 5 * 60 * 1000); // 5 minutes
    }
    
    function stopAutoRefresh() {
        clearInterval(autoRefreshInterval);
    }
    
    // Handle window visibility changes
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            // Refresh when tab becomes visible again
            loadMessages();
            startAutoRefresh();
        } else {
            stopAutoRefresh();
        }
    });
    
    // Handle browser back button
    window.addEventListener('popstate', function() {
        // Close any open modals when back button is pressed
        if (viewMessageModal.classList.contains('active')) {
            toggleModal(viewMessageModal, false);
        }
        if (deleteModal.classList.contains('active')) {
            toggleModal(deleteModal, false);
        }
        
        // Check URL for message ID
        checkUrlForMessageId();
    });
    
    // Initialize page
    function init() {
        loadMessages();
        checkUrlForMessageId();
        startAutoRefresh();
        
        // Add keyboard shortcut info to search placeholder
        if (messageSearch) {
            messageSearch.placeholder = "Search messages... (Ctrl+F)";
        }
    }
    
    init();
});
