document.addEventListener('DOMContentLoaded', function() {
    const { API_URL, getAuthHeaders, handleApiError, formatDate, showToast, toggleModal } = window.adminUtils;
    const projectsList = document.getElementById('projectsList');
    const categoryFilter = document.getElementById('categoryFilter');
    const projectSearch = document.getElementById('projectSearch');
    const projectsPagination = document.getElementById('projectsPagination');
    
    // Delete modal elements
    const deleteModal = document.getElementById('deleteModal');
    const deleteProjectName = document.getElementById('deleteProjectName');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const cancelDelete = document.getElementById('cancelDelete');
    const confirmDelete = document.getElementById('confirmDelete');
    
    // Feedback code modal elements
    const feedbackCodeModal = document.getElementById('feedbackCodeModal');
    const feedbackLink = document.getElementById('feedbackLink');
    const feedbackNotAvailable = document.getElementById('feedbackNotAvailable');
    const copyFeedbackLink = document.getElementById('copyFeedbackLink');
    const closeFeedbackModal = document.getElementById('closeFeedbackModal');
    const closeFeedbackBtn = document.getElementById('closeFeedbackBtn');
    
    // Pagination variables
    let currentPage = 1;
    const itemsPerPage = 10;
    let totalProjects = 0;
    let totalPages = 0;
    
    // Filter variables
    let currentCategory = '';
    let searchTerm = '';
    
    // Current projects data
    let projects = [];
    
    // Project to delete
    let projectToDelete = null;
    
    // Load categories for filter
    async function loadCategories() {
        try {
            const response = await fetch(`${API_URL}/categories`, {
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            const data = await response.json();
            
            if (data.categories && data.categories.length > 0) {
                // Populate category filter
                data.categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category;
                    option.textContent = category;
                    categoryFilter.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }
    
    // Load projects
    async function loadProjects() {
        try {
            projectsList.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading projects...</td></tr>';
            
            // Calculate skip for pagination
            const skip = (currentPage - 1) * itemsPerPage;
            
            // Build query parameters
            let url = `${API_URL}/projects?skip=${skip}&limit=${itemsPerPage}&active_only=false`;
            if (currentCategory) {
                url += `&category=${encodeURIComponent(currentCategory)}`;
            }
            if (searchTerm) {
                url += `&search=${encodeURIComponent(searchTerm)}`;
            }
            
            const response = await fetch(url, {
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            const data = await response.json();
            
            // Store projects data
            projects = data.projects || data; // Handle different API response formats
            
            // Get total count from response metadata or estimate
            totalProjects = data.total || projects.length;
            totalPages = Math.ceil(totalProjects / itemsPerPage);
            
            // Render projects
            renderProjects(projects);
            
            // Update pagination
            renderPagination();
            
        } catch (error) {
            console.error('Error loading projects:', error);
            projectsList.innerHTML = '<tr><td colspan="6" class="text-center text-danger"><i class="fas fa-exclamation-circle"></i> Failed to load projects</td></tr>';
        }
    }
    
    // Render projects in table
    function renderProjects(projects) {
        if (!projects || projects.length === 0) {
            projectsList.innerHTML = '<tr><td colspan="6" class="text-center">No projects found</td></tr>';
            return;
        }
        
        let html = '';
        projects.forEach(project => {
            const statusClass = project.active ? 'status-active' : 'status-inactive';
            const statusText = project.active ? 'Active' : 'Inactive';
            
            html += `
                <tr>
                    <td><strong>${escapeHtml(project.title)}</strong></td>
                    <td>${escapeHtml(project.category)}</td>
                    <td>${escapeHtml(project.location)}</td>
                    <td>${project.completed_year || 'N/A'}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <div class="actions">
                            <a href="project-edit.html?id=${project._id}" class="action-btn" title="Edit">
                                <i class="fas fa-edit"></i>
                            </a>
                            <button class="action-btn" title="Feedback Link" onclick="getFeedbackCode('${project.slug}')">
                                <i class="fas fa-comment-alt"></i>
                            </button>
                            <button class="action-btn" title="View on Site" onclick="window.open('/projects/${project.slug}', '_blank')">
                                <i class="fas fa-external-link-alt"></i>
                            </button>
                            <button class="action-btn delete" title="Delete" onclick="confirmDeleteProject('${project._id}', '${escapeHtml(project.title)}')">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        projectsList.innerHTML = html;
    }
    
    // Escape HTML to prevent XSS
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    // Render pagination
    function renderPagination() {
        if (totalPages <= 1) {
            projectsPagination.innerHTML = '';
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
        
        projectsPagination.innerHTML = html;
    }
    
    // Change page
    window.changePage = function(page) {
        if (page < 1 || page > totalPages || page === currentPage) return;
        currentPage = page;
        loadProjects();
        // Scroll to top of table
        document.querySelector('.admin-table-responsive').scrollIntoView({ behavior: 'smooth' });
    };
    
    // Get feedback code
    window.getFeedbackCode = async function(slug) {
        try {
            // Reset feedback modal state
            feedbackLink.value = '';
            feedbackNotAvailable.style.display = 'none';
            
            const response = await fetch(`${API_URL}/feedback/code/${slug}`, {
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    // Feedback link not available
                    feedbackNotAvailable.style.display = 'flex';
                } else {
                    await handleApiError(response);
                }
            } else {
                const data = await response.json();
                feedbackLink.value = data.url || '';
            }
            
            // Show feedback code modal
            toggleModal(feedbackCodeModal, true);
            
        } catch (error) {
            console.error('Error getting feedback code:', error);
            showToast('Failed to get feedback link', 'error');
        }
    };
    
    // Copy feedback link
    if (copyFeedbackLink) {
        copyFeedbackLink.addEventListener('click', function() {
            if (!feedbackLink.value) {
                showToast('No feedback link to copy', 'error');
                return;
            }
            
            feedbackLink.select();
            document.execCommand('copy');
            showToast('Feedback link copied to clipboard', 'success');
        });
    }
    
    // Close feedback modal
    if (closeFeedbackModal) {
        closeFeedbackModal.addEventListener('click', function() {
            toggleModal(feedbackCodeModal, false);
        });
    }
    
    if (closeFeedbackBtn) {
        closeFeedbackBtn.addEventListener('click', function() {
            toggleModal(feedbackCodeModal, false);
        });
    }
    
    // Confirm delete project
    window.confirmDeleteProject = function(id, title) {
        projectToDelete = id;
        deleteProjectName.textContent = title;
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
    
    // Delete project
    if (confirmDelete) {
        confirmDelete.addEventListener('click', async function() {
            if (!projectToDelete) return;
            
            try {
                confirmDelete.disabled = true;
                confirmDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
                
                const project = projects.find(p => p._id === projectToDelete);
                if (!project) throw new Error('Project not found');
                
                const response = await fetch(`${API_URL}/projects/${project.slug}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                
                await handleApiError(response);
                
                // Close modal and reload projects
                toggleModal(deleteModal, false);
                showToast('Project deleted successfully', 'success');
                
                // Reset current page if it would be empty after deletion
                if (projects.length === 1 && currentPage > 1) {
                    currentPage--;
                }
                
                loadProjects();
                
            } catch (error) {
                console.error('Error deleting project:', error);
                showToast('Failed to delete project: ' + (error.message || 'Unknown error'), 'error');
            } finally {
                confirmDelete.disabled = false;
                confirmDelete.innerHTML = 'Delete';
                toggleModal(deleteModal, false);
            }
        });
    }
    
    // Debounce search input
    const debouncedSearch = debounce(function() {
        searchTerm = projectSearch.value.trim();
        currentPage = 1; // Reset to first page on search
        loadProjects();
    }, 500);
    
    // Event listeners
    if (categoryFilter) {
        categoryFilter.addEventListener('change', function() {
            currentCategory = this.value;
            currentPage = 1; // Reset to first page on filter change
            loadProjects();
        });
    }
    
    if (projectSearch) {
        projectSearch.addEventListener('input', debouncedSearch);
        
        // Clear search with Escape key
        projectSearch.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                this.value = '';
                debouncedSearch();
            }
        });
    }
    
    // Debounce function
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Initialize page
    function init() {
        loadCategories();
        loadProjects();
    }
    
    init();
});
