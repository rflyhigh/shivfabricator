document.addEventListener('DOMContentLoaded', function() {
    const { API_URL, getAuthHeaders, handleApiError, formatDate, showToast } = window.adminUtils;
    const feedbackList = document.getElementById('feedbackList');
    const projectFilter = document.getElementById('projectFilter');
    const statusFilter = document.getElementById('statusFilter');
    const refreshFeedback = document.getElementById('refreshFeedback');
    const feedbackPagination = document.getElementById('feedbackPagination');
    
    // View feedback modal elements
    const viewFeedbackModal = document.getElementById('viewFeedbackModal');
    const closeViewModal = document.getElementById('closeViewModal');
    const closeFeedbackBtn = document.getElementById('closeFeedbackBtn');
    const feedbackProject = document.getElementById('feedbackProject');
    const feedbackCompany = document.getElementById('feedbackCompany');
    const feedbackFrom = document.getElementById('feedbackFrom');
    const feedbackRating = document.getElementById('feedbackRating');
    const feedbackDate = document.getElementById('feedbackDate');
    const feedbackContent = document.getElementById('feedbackContent');
    const feedbackStatus = document.getElementById('feedbackStatus');
    const feedbackStatusContainer = document.getElementById('feedbackStatusContainer');
    const approveFeedbackBtn = document.getElementById('approveFeedbackBtn');
    const deleteFeedbackBtn = document.getElementById('deleteFeedbackBtn');
    
    // Delete modal elements
    const deleteModal = document.getElementById('deleteModal');
    const deleteFeedbackFrom = document.getElementById('deleteFeedbackFrom');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const cancelDelete = document.getElementById('cancelDelete');
    const confirmDelete = document.getElementById('confirmDelete');
    
    // Pagination variables
    let currentPage = 1;
    const itemsPerPage = 10;
    let totalFeedback = 0;
    let totalPages = 0;
    
    // Filter variables
    let currentProjectId = '';
    let currentStatus = '';
    
    // Current feedback data
    let feedback = [];
    
    // Feedback to delete
    let feedbackToDelete = null;
    
    // Current feedback item being viewed
    let currentFeedback = null;
    
    // Projects data
    let projects = [];
    
    // Load projects for filter
    async function loadProjects() {
        try {
            const response = await fetch(`${API_URL}/projects`, {
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            const data = await response.json();
            
            // Store projects data
            projects = data;
            
            // Populate project filter
            if (projectFilter) {
                // Sort projects by title
                projects.sort((a, b) => a.title.localeCompare(b.title));
                
                projects.forEach(project => {
                    const option = document.createElement('option');
                    option.value = project._id;
                    option.textContent = project.title;
                    projectFilter.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading projects:', error);
        }
    }
    
    // Load feedback
    async function loadFeedback() {
        try {
            feedbackList.innerHTML = '<tr><td colspan="6" class="text-center">Loading feedback...</td></tr>';
            
            // Calculate skip for pagination
            const skip = (currentPage - 1) * itemsPerPage;
            
            // Build query parameters
            let url = `${API_URL}/feedback?skip=${skip}&limit=${itemsPerPage}`;
            if (currentProjectId) {
                url += `&project_id=${currentProjectId}`;
            }
            
            const response = await fetch(url, {
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            const data = await response.json();
            
            // Store feedback data
            feedback = data;
            
            // For demo purposes, set total to number of feedback items returned
            // In a real API, you would get total from response metadata
            totalFeedback = data.length > itemsPerPage ? data.length : itemsPerPage * 2;
            totalPages = Math.ceil(totalFeedback / itemsPerPage);
            
            // Render feedback
            renderFeedback(data);
            
            // Update pagination
            renderPagination();
            
        } catch (error) {
            console.error('Error loading feedback:', error);
            feedbackList.innerHTML = '<tr><td colspan="6" class="text-center">Failed to load feedback</td></tr>';
        }
    }
    
    // Render feedback in table
    function renderFeedback(feedbackItems) {
        if (feedbackItems.length === 0) {
            feedbackList.innerHTML = '<tr><td colspan="6" class="text-center">No feedback found</td></tr>';
            return;
        }
        
        let html = '';
        feedbackItems.forEach(item => {
            // Filter by status if selected
            if (currentStatus) {
                const isApproved = item.approved ? 'approved' : 'pending';
                if (currentStatus !== isApproved) {
                    return;
                }
            }
            
            // Find project name
            const project = projects.find(p => p._id === item.project_id) || { title: 'Unknown Project' };
            
            const statusClass = item.approved ? 'status-approved' : 'status-pending';
            const statusText = item.approved ? 'Approved' : 'Pending';
            
            html += `
                <tr>
                    <td>${project.title}</td>
                    <td>${item.company_name}</td>
                    <td>
                        <div class="rating-display">
                            ${generateStars(item.rating)}
                        </div>
                    </td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${formatDate(item.created_at)}</td>
                    <td>
                        <div class="actions">
                            <button class="action-btn" title="View" onclick="viewFeedback('${item._id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${!item.approved ? `
                                <button class="action-btn approve" title="Approve" onclick="approveFeedback('${item._id}')">
                                    <i class="fas fa-check"></i>
                                </button>
                            ` : ''}
                            <button class="action-btn delete" title="Delete" onclick="confirmDeleteFeedback('${item._id}', '${item.author_name}')">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        feedbackList.innerHTML = html || '<tr><td colspan="6" class="text-center">No matching feedback found</td></tr>';
    }
    
    // Generate star rating HTML
    function generateStars(rating) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                stars += '<i class="fas fa-star"></i>';
            } else {
                stars += '<i class="far fa-star"></i>';
            }
        }
        return stars;
    }
    
    // Render pagination
    function renderPagination() {
        if (totalPages <= 1) {
            feedbackPagination.innerHTML = '';
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
        
        feedbackPagination.innerHTML = html;
    }
    
    // Change page
    window.changePage = function(page) {
        currentPage = page;
        loadFeedback();
    };
    
    // View feedback details
    window.viewFeedback = function(id) {
        const item = feedback.find(f => f._id === id);
        if (!item) return;
        
        // Store current feedback
        currentFeedback = item;
        
        // Find project name
        const project = projects.find(p => p._id === item.project_id) || { title: 'Unknown Project' };
        
        // Fill modal with feedback details
        feedbackProject.textContent = project.title;
        feedbackCompany.textContent = item.company_name;
        feedbackFrom.textContent = item.author_name;
        feedbackRating.innerHTML = generateStars(item.rating);
        feedbackDate.textContent = formatDate(item.created_at);
        feedbackContent.textContent = item.text;
        
        // Set status
        const statusClass = item.approved ? 'status-approved' : 'status-pending';
        const statusText = item.approved ? 'Approved' : 'Pending';
        feedbackStatus.className = `status-badge ${statusClass}`;
        feedbackStatus.textContent = statusText;
        
        // Show/hide approve button
        if (item.approved) {
            approveFeedbackBtn.style.display = 'none';
        } else {
            approveFeedbackBtn.style.display = 'block';
        }
        
        // Show modal
        viewFeedbackModal.classList.add('active');
    };
    
    // Close view modal
    if (closeViewModal) {
        closeViewModal.addEventListener('click', function() {
            viewFeedbackModal.classList.remove('active');
        });
    }
    
    if (closeFeedbackBtn) {
        closeFeedbackBtn.addEventListener('click', function() {
            viewFeedbackModal.classList.remove('active');
        });
    }
    
    // Approve feedback
    window.approveFeedback = async function(id) {
        try {
            const response = await fetch(`${API_URL}/feedback/${id}/approve`, {
                method: 'PUT',
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            
            showToast('Feedback approved successfully', 'success');
            
            // Reload feedback
            loadFeedback();
            
            // If modal is open, update the status
            if (viewFeedbackModal.classList.contains('active') && currentFeedback && currentFeedback._id === id) {
                feedbackStatus.className = 'status-badge status-approved';
                feedbackStatus.textContent = 'Approved';
                approveFeedbackBtn.style.display = 'none';
                
                // Update current feedback
                currentFeedback.approved = true;
            }
            
        } catch (error) {
            console.error('Error approving feedback:', error);
            showToast('Failed to approve feedback', 'error');
        }
    };
    
    // Approve from modal
    if (approveFeedbackBtn) {
        approveFeedbackBtn.addEventListener('click', function() {
            if (currentFeedback) {
                approveFeedback(currentFeedback._id);
            }
        });
    }
    
    // Delete feedback from modal
    if (deleteFeedbackBtn) {
        deleteFeedbackBtn.addEventListener('click', function() {
            if (currentFeedback) {
                confirmDeleteFeedback(currentFeedback._id, currentFeedback.author_name);
                viewFeedbackModal.classList.remove('active');
            }
        });
    }
    
    // Confirm delete feedback
    window.confirmDeleteFeedback = function(id, name) {
        feedbackToDelete = id;
        deleteFeedbackFrom.textContent = name;
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
    
    // Delete feedback
    if (confirmDelete) {
        confirmDelete.addEventListener('click', async function() {
            if (!feedbackToDelete) return;
            
            try {
                const response = await fetch(`${API_URL}/feedback/${feedbackToDelete}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                
                await handleApiError(response);
                
                // Close modal and reload feedback
                deleteModal.classList.remove('active');
                showToast('Feedback deleted successfully', 'success');
                loadFeedback();
                
            } catch (error) {
                console.error('Error deleting feedback:', error);
                showToast('Failed to delete feedback', 'error');
                deleteModal.classList.remove('active');
            }
        });
    }
    
    // Event listeners
    if (projectFilter) {
        projectFilter.addEventListener('change', function() {
            currentProjectId = this.value;
            currentPage = 1;
            loadFeedback();
        });
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            currentStatus = this.value;
            renderFeedback(feedback);
        });
    }
    
    if (refreshFeedback) {
        refreshFeedback.addEventListener('click', function() {
            loadFeedback();
        });
    }
    
    // Add CSS for rating and status
    const feedbackStyle = document.createElement('style');
    feedbackStyle.textContent = `
        .rating-display {
            color: #ffc107;
            font-size: 14px;
        }
        
        .status-badge {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .status-approved {
            background-color: rgba(76, 175, 80, 0.1);
            color: #4caf50;
        }
        
        .status-pending {
            background-color: rgba(255, 152, 0, 0.1);
            color: #ff9800;
        }
        
        .action-btn.approve {
            background-color: rgba(76, 175, 80, 0.1);
            color: #4caf50;
        }
        
        .action-btn.approve:hover {
            background-color: #4caf50;
            color: white;
        }
        
        .feedback-status-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .feedback-status {
            display: flex;
            align-items: center;
        }
        
        .feedback-status strong {
            margin-right: 10px;
        }
        
        .rating-value {
            font-size: 36px;
            font-weight: 700;
            color: var(--primary-color);
            margin-top: 20px;
        }
        
        .rating-label {
            color: var(--text-secondary);
            font-size: 14px;
        }
        
        .admin-filter-group {
            display: flex;
            gap: 15px;
        }
    `;
    document.head.appendChild(feedbackStyle);
    
    // Initialize page
    function init() {
        loadProjects().then(() => {
            loadFeedback();
        });
    }
    
    init();
});