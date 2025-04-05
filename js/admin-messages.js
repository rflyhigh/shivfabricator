document.addEventListener('DOMContentLoaded', function() {
    const { API_URL, getAuthHeaders, handleApiError, formatDate, showToast } = window.adminUtils;
    const messagesList = document.getElementById('messagesList');
    const messageSearch = document.getElementById('messageSearch');
    const refreshMessages = document.getElementById('refreshMessages');
    const messagesPagination = document.getElementById('messagesPagination');
    
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
    
    // Current messages data
    let messages = [];
    
    // Message to delete
    let messageToDelete = null;
    
    // Load messages
    async function loadMessages() {
        try {
            messagesList.innerHTML = '<tr><td colspan="5" class="text-center">Loading messages...</td></tr>';
            
            // Calculate skip for pagination
            const skip = (currentPage - 1) * itemsPerPage;
            
            // Build query parameters
            let url = `${API_URL}/contact?skip=${skip}&limit=${itemsPerPage}`;
            
            const response = await fetch(url, {
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            const data = await response.json();
            
            // Store messages data
            messages = data;
            
            // For demo purposes, set total to number of messages returned
            // In a real API, you would get total from response metadata
            totalMessages = data.length > itemsPerPage ? data.length : itemsPerPage * 2;
            totalPages = Math.ceil(totalMessages / itemsPerPage);
            
            // Render messages
            renderMessages(data);
            
            // Update pagination
            renderPagination();
            
        } catch (error) {
            console.error('Error loading messages:', error);
            messagesList.innerHTML = '<tr><td colspan="5" class="text-center">Failed to load messages</td></tr>';
        }
    }
    
    // Render messages in table
    function renderMessages(messages) {
        if (messages.length === 0) {
            messagesList.innerHTML = '<tr><td colspan="5" class="text-center">No messages found</td></tr>';
            return;
        }
        
        let html = '';
        messages.forEach(message => {
            // Filter by search term if present
            if (searchTerm && !messageMatchesSearch(message, searchTerm)) {
                return;
            }
            
            html += `
                <tr>
                    <td>${message.name}</td>
                    <td>${message.email}</td>
                    <td>${message.subject}</td>
                    <td>${formatDate(message.created_at)}</td>
                    <td>
                        <div class="actions">
                            <button class="action-btn" title="View" onclick="viewMessage('${message._id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="action-btn delete" title="Delete" onclick="confirmDeleteMessage('${message._id}', '${message.name}')">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        messagesList.innerHTML = html || '<tr><td colspan="5" class="text-center">No matching messages found</td></tr>';
    }
    
    // Check if message matches search term
    function messageMatchesSearch(message, term) {
        term = term.toLowerCase();
        return (
            message.name.toLowerCase().includes(term) ||
            message.email.toLowerCase().includes(term) ||
            message.subject.toLowerCase().includes(term) ||
            (message.company && message.company.toLowerCase().includes(term)) ||
            message.message.toLowerCase().includes(term)
        );
    }
    
    function renderPagination() {
        if (totalPages <= 1) {
            messagesPagination.innerHTML = '';
            return;
        }
        
        let html = '';
        
        // Previous button
        html += `
            <button class="pagination-item ${currentPage === 1 ? 'disabled' : ''}" 
                ${currentPage === 1 ? 'disabled' : 'onclick="changePage(' + (currentPage - 1) + ')"'}>
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Page numbers
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <button class="pagination-item ${i === currentPage ? 'active' : ''}" 
                    onclick="changePage(${i})">
                    ${i}
                </button>
            `;
        }
        
        // Next button
        html += `
            <button class="pagination-item ${currentPage === totalPages ? 'disabled' : ''}" 
                ${currentPage === totalPages ? 'disabled' : 'onclick="changePage(' + (currentPage + 1) + ')"'}>
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        messagesPagination.innerHTML = html;
    }
    
    // Change page
    window.changePage = function(page) {
        currentPage = page;
        loadMessages();
    };
    
    // View message details
    window.viewMessage = function(id) {
        const message = messages.find(m => m._id === id);
        if (!message) return;
        
        // Fill modal with message details
        messageFrom.textContent = message.name;
        messageEmail.textContent = message.email;
        messagePhone.textContent = message.phone;
        messageCompany.textContent = message.company || 'N/A';
        messageSubject.textContent = message.subject;
        messageDate.textContent = formatDate(message.created_at);
        messageContent.textContent = message.message;
        
        // Set reply email link
        replyEmailBtn.href = `mailto:${message.email}?subject=Re: ${message.subject}`;
        
        // Show modal
        viewMessageModal.classList.add('active');
    };
    
    // Close view modal
    if (closeViewModal) {
        closeViewModal.addEventListener('click', function() {
            viewMessageModal.classList.remove('active');
        });
    }
    
    if (closeMessageBtn) {
        closeMessageBtn.addEventListener('click', function() {
            viewMessageModal.classList.remove('active');
        });
    }
    
    // Confirm delete message
    window.confirmDeleteMessage = function(id, name) {
        messageToDelete = id;
        deleteMessageFrom.textContent = name;
        deleteModal.classList.add('active');
    };
    
    // Close delete modal
    if (closeDeleteModal) {
        closeDeleteModal.addEventListener('click', function() {
            deleteModal.classList.remove('active');
        });
    }
    
    if (cancelDelete) {
        cancelDelete.addEventListener('click', function() {
            deleteModal.classList.remove('active');
        });
    }
    
    // Delete message
    if (confirmDelete) {
        confirmDelete.addEventListener('click', async function() {
            if (!messageToDelete) return;
            
            try {
                const response = await fetch(`${API_URL}/contact/${messageToDelete}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                
                await handleApiError(response);
                
                // Close modal and reload messages
                deleteModal.classList.remove('active');
                showToast('Message deleted successfully', 'success');
                loadMessages();
                
            } catch (error) {
                console.error('Error deleting message:', error);
                showToast('Failed to delete message', 'error');
                deleteModal.classList.remove('active');
            }
        });
    }
    
    // Event listeners
    if (messageSearch) {
        messageSearch.addEventListener('input', function() {
            searchTerm = this.value.trim();
            renderMessages(messages);
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
                }
            }, 500);
        }
    }
    
    // Add CSS for message details
    const messageStyle = document.createElement('style');
    messageStyle.textContent = `
        .message-details {
            display: grid;
            gap: 15px;
        }
        
        .message-detail-item {
            display: grid;
            grid-template-columns: 100px 1fr;
            gap: 10px;
        }
        
        .message-detail-item strong {
            color: var(--text-primary);
        }
        
        .message-detail-item span {
            color: var(--text-secondary);
        }
        
        .message-content {
            display: block;
        }
        
        .message-content strong {
            display: block;
            margin-bottom: 10px;
        }
        
        .message-content div {
            padding: 15px;
            background-color: rgba(255, 255, 255, 0.03);
            border-radius: var(--border-radius);
            color: var(--text-secondary);
            line-height: 1.6;
            white-space: pre-line;
        }
    `;
    document.head.appendChild(messageStyle);
    
    // Initialize page
    function init() {
        loadMessages();
        checkUrlForMessageId();
    }
    
    init();
});