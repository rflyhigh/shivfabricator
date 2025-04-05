document.addEventListener('DOMContentLoaded', function() {
    const { API_URL, getAuthHeaders, handleApiError, formatDate, showToast } = window.adminUtils;
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
            projectsList.innerHTML = '<tr><td colspan="6" class="text-center">Loading projects...</td></tr>';
            
            // Calculate skip for pagination
            const skip = (currentPage - 1) * itemsPerPage;
            
            // Build query parameters
            let url = `${API_URL}/projects?skip=${skip}&limit=${itemsPerPage}&active_only=false`;
            if (currentCategory) {
                url += `&category=${encodeURIComponent(currentCategory)}`;
            }
            
            const response = await fetch(url, {
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            const data = await response.json();
            
            // Store projects data
            projects = data;
            
            // For demo purposes, set total to number of projects returned
            // In a real API, you would get total from response metadata
            totalProjects = data.length > itemsPerPage ? data.length : itemsPerPage * 2;
            totalPages = Math.ceil(totalProjects / itemsPerPage);
            
            // Render projects
            renderProjects(data);
            
            // Update pagination
            renderPagination();
            
        } catch (error) {
            console.error('Error loading projects:', error);
            projectsList.innerHTML = '<tr><td colspan="6" class="text-center">Failed to load projects</td></tr>';
        }
    }
    
    // Render projects in table
    function renderProjects(projects) {
        if (projects.length === 0) {
            projectsList.innerHTML = '<tr><td colspan="6" class="text-center">No projects found</td></tr>';
            return;
        }
        
        let html = '';
        projects.forEach(project => {
            // Filter by search term if present
            if (searchTerm && !project.title.toLowerCase().includes(searchTerm.toLowerCase())) {
                return;
            }
            
            const statusClass = project.active ? 'status-active' : 'status-inactive';
            const statusText = project.active ? 'Active' : 'Inactive';
            
            html += `
                <tr>
                    <td>${project.title}</td>
                    <td>${project.category}</td>
                    <td>${project.location}</td>
                    <td>${project.completed_year}</td>
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
                            <button class="action-btn delete" title="Delete" onclick="confirmDeleteProject('${project._id}', '${project.title}')">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        projectsList.innerHTML = html;
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
        
        projectsPagination.innerHTML = html;
    }
    
    // Change page
    window.changePage = function(page) {
        currentPage = page;
        loadProjects();
    };
    
    // Get feedback code
    window.getFeedbackCode = async function(slug) {
        try {
            const response = await fetch(`${API_URL}/feedback/code/${slug}`, {
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            const data = await response.json();
            
            // Show feedback code modal
            feedbackLink.value = data.url;
            feedbackCodeModal.classList.add('active');
            
        } catch (error) {
            console.error('Error getting feedback code:', error);
            showToast('Failed to get feedback link', 'error');
        }
    };
    
    // Copy feedback link
    if (copyFeedbackLink) {
        copyFeedbackLink.addEventListener('click', function() {
            feedbackLink.select();
            document.execCommand('copy');
            showToast('Feedback link copied to clipboard', 'success');
        });
    }
    
    // Close feedback modal
    if (closeFeedbackModal) {
        closeFeedbackModal.addEventListener('click', function() {
            feedbackCodeModal.classList.remove('active');
        });
    }
    
    if (closeFeedbackBtn) {
        closeFeedbackBtn.addEventListener('click', function() {
            feedbackCodeModal.classList.remove('active');
        });
    }
    
    // Confirm delete project
    window.confirmDeleteProject = function(id, title) {
        projectToDelete = id;
        deleteProjectName.textContent = title;
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
    
    // Delete project
    if (confirmDelete) {
        confirmDelete.addEventListener('click', async function() {
            if (!projectToDelete) return;
            
            try {
                const project = projects.find(p => p._id === projectToDelete);
                if (!project) throw new Error('Project not found');
                
                const response = await fetch(`${API_URL}/projects/${project.slug}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                
                await handleApiError(response);
                
                // Close modal and reload projects
                deleteModal.classList.remove('active');
                showToast('Project deleted successfully', 'success');
                loadProjects();
                
            } catch (error) {
                console.error('Error deleting project:', error);
                showToast('Failed to delete project', 'error');
                deleteModal.classList.remove('active');
            }
        });
    }
    
    // Event listeners
    if (categoryFilter) {
        categoryFilter.addEventListener('change', function() {
            currentCategory = this.value;
            currentPage = 1;
            loadProjects();
        });
    }
    
    if (projectSearch) {
        projectSearch.addEventListener('input', function() {
            searchTerm = this.value.trim();
            renderProjects(projects);
        });
    }
    
    // Add CSS for status badges
    const statusStyle = document.createElement('style');
    statusStyle.textContent = `
        .status-badge {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .status-active {
            background-color: rgba(76, 175, 80, 0.1);
            color: #4caf50;
        }
        
        .status-inactive {
            background-color: rgba(158, 158, 158, 0.1);
            color: #9e9e9e;
        }
        
        .feedback-link-container {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }
        
        .text-center {
            text-align: center;
        }
        
        .text-danger {
            color: #f44336;
        }
        
        .admin-search {
            position: relative;
            margin-right: 15px;
        }
        
        .admin-search input {
            padding-left: 35px;
            width: 250px;
        }
        
        .admin-search::before {
            content: '\\f002';
            font-family: 'Font Awesome 5 Free';
            font-weight: 900;
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-secondary);
            font-size: 14px;
        }
        
        .admin-filter-group {
            display: flex;
            gap: 15px;
        }
        
        .admin-card-actions {
            display: flex;
            align-items: center;
        }
        
        .admin-table-responsive {
            overflow-x: auto;
        }
        
        .btn-sm {
            padding: 8px 15px;
            font-size: 0.9rem;
        }
    `;
    document.head.appendChild(statusStyle);
    
    // Initialize page
    function init() {
        loadCategories();
        loadProjects();
    }
    
    init();
});