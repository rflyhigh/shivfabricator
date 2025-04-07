document.addEventListener('DOMContentLoaded', function() {
    const { API_URL, getAuthHeaders, handleApiError, formatDate, showToast, toggleModal, debounce, escapeHtml } = window.adminUtils;
    const feedbackList = document.getElementById('feedbackList');
    const projectFilter = document.getElementById('projectFilter');
    const statusFilter = document.getElementById('statusFilter');
    const feedbackSearch = document.getElementById('feedbackSearch');
    const refreshFeedback = document.getElementById('refreshFeedback');
    const feedbackPagination = document.getElementById('feedbackPagination');
    const feedbackCount = document.getElementById('feedbackCount');
    
    // View feedback modal elements
    const viewFeedbackModal = document.getElementById('viewFeedbackModal');
    const closeViewModal = document.getElementById('closeViewModal');
    const closeFeedbackBtn = document.getElementById('closeFeedbackBtn');
    const feedbackProject = document.getElementById('feedbackProject');
    const feedbackCompany = document.getElementById('feedbackCompany');
    const feedbackFrom = document.getElementById('feedbackFrom');
    const feedbackRating = document.getElementById('feedbackRating');
    const ratingValue = document.getElementById('ratingValue');
    const feedbackDate = document.getElementById('feedbackDate');
    const feedbackContent = document.getElementById('feedbackContent');
    const feedbackStatus = document.getElementById('feedbackStatus');
    const feedbackStatusContainer = document.getElementById('feedbackStatusContainer');
    const approveFeedbackBtn = document.getElementById('approveFeedbackBtn');
    const deleteFeedbackBtn = document.getElementById('deleteFeedbackBtn');
    
    // Delete modal elements
    const deleteModal = document.getElementById('deleteModal');
    const deleteFeedbackFrom = document.getElementById('deleteFeedbackFrom');
    const deleteFeedbackProject = document.getElementById('deleteFeedbackProject');
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
    let searchTerm = '';
    
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
            projects = data.projects || data; // Handle different API response formats
            
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
            showToast('Failed to load projects', 'error');
        }
    }
    
    // Load feedback
    async function loadFeedback() {
        try {
            feedbackList.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading feedback...</td></tr>';
            
            if (refreshFeedback) {
                refreshFeedback.disabled = true;
                refreshFeedback.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            }
            
            // Calculate skip for pagination
            const skip = (currentPage - 1) * itemsPerPage;
            
            // Build query parameters
            let url = `${API_URL}/feedback?skip=${skip}&limit=${itemsPerPage}`;
            if (currentProjectId) {
                url += `&project_id=${currentProjectId}`;
            }
            if (searchTerm) {
                url += `&search=${encodeURIComponent(searchTerm)}`;
            }
            
            const response = await fetch(url, {
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            const data = await response.json();
            
            // Store feedback data
            feedback = data.feedback || data; // Handle different API response formats
            
            // Get total count from response metadata or estimate
            totalFeedback = data.total || feedback.length;
            totalPages = Math.ceil(totalFeedback / itemsPerPage);
            
            // Update feedback count
            if (feedbackCount) {
                feedbackCount.textContent = totalFeedback;
            }
            
            // Filter by status if needed (in case API doesn't support status filtering)
            if (currentStatus) {
                feedback = feedback.filter(item => {
                    const isApproved = item.approved ? 'approved' : 'pending';
                    return currentStatus === isApproved;
                });
            }
            
            // Render feedback
            renderFeedback(feedback);
            
            // Update pagination
            renderPagination();
            
        } catch (error) {
            console.error('Error loading feedback:', error);
            feedbackList.innerHTML = '<tr><td colspan="6" class="text-center text-danger"><i class="fas fa-exclamation-circle"></i> Failed to load feedback</td></tr>';
        } finally {
            if (refreshFeedback) {
                refreshFeedback.disabled = false;
                refreshFeedback.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            }
        }
    }
    
    // Render feedback in table
    function renderFeedback(feedbackItems) {
        if (!feedbackItems || feedbackItems.length === 0) {
            feedbackList.innerHTML = '<tr><td colspan="6" class="text-center">No feedback found</td></tr>';
            return;
        }
        
        let html = '';
        feedbackItems.forEach(item => {
            // Find project name
            const project = projects.find(p => p._id === item.project_id) || { title: 'Unknown Project' };
            
            const statusClass = item.approved ? 'status-approved' : 'status-pending';
            const statusText = item.approved ? 'Approved' : 'Pending';
            
            html += `
                <tr>
                    <td>${escapeHtml(project.title)}</td>
                    <td>${escapeHtml(item.company_name || 'N/A')}</td>
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
                            <button class="action-btn delete" title="Delete" onclick="confirmDeleteFeedback('${item._id}')">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        feedbackList.innerHTML = html;
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
        
        feedbackPagination.innerHTML = html;
    }
    
    // Change page
    window.changePage = function(page) {
        if (page < 1 || page > totalPages || page === currentPage) return;
        currentPage = page;
        loadFeedback();
        // Scroll to top of table
        document.querySelector('.admin-table-responsive').scrollIntoView({ behavior: 'smooth' });
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
        feedbackCompany.textContent = item.company_name || 'N/A';
        feedbackFrom.textContent = item.author_name || 'Anonymous';
        feedbackRating.innerHTML = generateStars(item.rating);
        ratingValue.textContent = item.rating;
        feedbackDate.textContent = formatDate(item.created_at);
        feedbackContent.textContent = item.text || 'No feedback text provided';
        
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
        toggleModal(viewFeedbackModal, true);
    };
    
    // Close view modal
    if (closeViewModal) {
        closeViewModal.addEventListener('click', function() {
            toggleModal(viewFeedbackModal, false);
        });
    }
    
    if (closeFeedbackBtn) {
        closeFeedbackBtn.addEventListener('click', function() {
            toggleModal(viewFeedbackModal, false);
        });
    }
    
    // Approve feedback
    window.approveFeedback = async function(id) {
        try {
            const feedbackId = id || (currentFeedback ? currentFeedback._id : null);
            if (!feedbackId) {
                showToast('No feedback selected', 'error');
                return;
            }
            
            // Disable approve button if in modal
            if (id === undefined && approveFeedbackBtn) {
                approveFeedbackBtn.disabled = true;
                approveFeedbackBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Approving...';
            }
            
            const response = await fetch(`${API_URL}/feedback/${feedbackId}/approve`, {
                method: 'PUT',
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            
            showToast('Feedback approved successfully', 'success');
            
            // Update in local data
            const feedbackIndex = feedback.findIndex(f => f._id === feedbackId);
            if (feedbackIndex !== -1) {
                feedback[feedbackIndex].approved = true;
                renderFeedback(feedback);
            }
            
            // If modal is open, update the status
            if (viewFeedbackModal.classList.contains('active') && currentFeedback && currentFeedback._id === feedbackId) {
                feedbackStatus.className = 'status-badge status-approved';
                feedbackStatus.textContent = 'Approved';
                approveFeedbackBtn.style.display = 'none';
                
                // Update current feedback
                currentFeedback.approved = true;
            }
            
        } catch (error) {
            console.error('Error approving feedback:', error);
            showToast('Failed to approve feedback: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            // Re-enable approve button if in modal
            if (id === undefined && approveFeedbackBtn) {
                approveFeedbackBtn.disabled = false;
                approveFeedbackBtn.innerHTML = '<i class="fas fa-check"></i> Approve Feedback';
            }
        }
    };
    
    // Approve from modal
    if (approveFeedbackBtn) {
        approveFeedbackBtn.addEventListener('click', function() {
            approveFeedback();
        });
    }
    
    // Delete feedback from modal
    if (deleteFeedbackBtn) {
        deleteFeedbackBtn.addEventListener('click', function() {
            if (currentFeedback) {
                confirmDeleteFeedback(currentFeedback._id);
                toggleModal(viewFeedbackModal, false);
            }
        });
    }
    
    // Confirm delete feedback
    window.confirmDeleteFeedback = function(id) {
        const item = feedback.find(f => f._id === id);
        if (!item) return;
        
        feedbackToDelete = id;
        
        // Find project name
        const project = projects.find(p => p._id === item.project_id) || { title: 'Unknown Project' };
        
        deleteFeedbackFrom.textContent = item.author_name || 'Anonymous';
        deleteFeedbackProject.textContent = project.title;
        
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
    
    // Delete feedback
    if (confirmDelete) {
        confirmDelete.addEventListener('click', async function() {
            if (!feedbackToDelete) return;
            
            try {
                confirmDelete.disabled = true;
                confirmDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
                
                const response = await fetch(`${API_URL}/feedback/${feedbackToDelete}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                
                await handleApiError(response);
                
                // Close modal and reload feedback
                toggleModal(deleteModal, false);
                showToast('Feedback deleted successfully', 'success');
                
                // Remove from local data
                feedback = feedback.filter(f => f._id !== feedbackToDelete);
                
                // Reset current page if it would be empty after deletion
                if (feedback.length === 0 && currentPage > 1) {
                    currentPage--;
                }
                
                // Render with updated data or reload
                if (feedback.length === 0) {
                    loadFeedback();
                } else {
                    renderFeedback(feedback);
                    
                    // Update total count
                    totalFeedback--;
                    totalPages = Math.ceil(totalFeedback / itemsPerPage);
                    renderPagination();
                    
                    if (feedbackCount) {
                        feedbackCount.textContent = totalFeedback;
                    }
                }
                
            } catch (error) {
                console.error('Error deleting feedback:', error);
                showToast('Failed to delete feedback: ' + (error.message || 'Unknown error'), 'error');
            } finally {
                confirmDelete.disabled = false;
                confirmDelete.innerHTML = 'Delete';
                toggleModal(deleteModal, false);
            }
        });
    }
    
    // Debounced search input
    const debouncedSearch = debounce(function() {
        searchTerm = feedbackSearch.value.trim();
        currentPage = 1; // Reset to first page on search
        loadFeedback();
    }, 500);
    
    // Event listeners
    if (feedbackSearch) {
        feedbackSearch.addEventListener('input', debouncedSearch);
        
        // Clear search with Escape key
        feedbackSearch.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                this.value = '';
                debouncedSearch();
            }
        });
    }
    
    if (projectFilter) {
        projectFilter.addEventListener('change', function() {
            currentProjectId = this.value;
            currentPage = 1; // Reset to first page on filter change
            loadFeedback();
        });
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            currentStatus = this.value;
            currentPage = 1; // Reset to first page on filter change
            loadFeedback();
        });
    }
    
    if (refreshFeedback) {
        refreshFeedback.addEventListener('click', function() {
            loadFeedback();
        });
    }
    
    // Handle keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Escape key to close modals
        if (e.key === 'Escape') {
            if (viewFeedbackModal.classList.contains('active')) {
                toggleModal(viewFeedbackModal, false);
            } else if (deleteModal.classList.contains('active')) {
                toggleModal(deleteModal, false);
            }
        }
    });
    
    // Initialize page
    function init() {
        loadProjects().then(() => {
            loadFeedback();
        });
    }
    
    init();
});
