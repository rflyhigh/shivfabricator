document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://shivfabricator.onrender.com/api';
    const projectsGrid = document.getElementById('projectsGrid');
    const filterButtonsContainer = document.querySelector('.filter-buttons');
    const noProjectsMessage = document.querySelector('.no-projects-message');
    let categories = [];
    let projects = [];
    let activeCategory = 'all';

    // Fetch categories and projects
    async function initialize() {
        try {
            // Fetch categories
            const categoriesResponse = await fetch(`${API_URL}/categories`);
            if (!categoriesResponse.ok) throw new Error('Failed to fetch categories');
            const categoriesData = await categoriesResponse.json();
            categories = categoriesData.categories || [];

            // Fetch projects
            const projectsResponse = await fetch(`${API_URL}/projects?active_only=true`);
            if (!projectsResponse.ok) throw new Error('Failed to fetch projects');
            const projectsData = await projectsResponse.json();
            projects = projectsData || [];

            // Render categories and projects
            renderCategories();
            renderProjects();
        } catch (error) {
            console.error('Error initializing projects page:', error);
            showErrorState();
        } finally {
            // Hide loading states
            const projectsLoading = document.querySelector('.projects-loading');
            if (projectsLoading) {
                projectsLoading.style.display = 'none';
            }
            
            const filterSkeleton = document.querySelector('.filter-skeleton');
            if (filterSkeleton) {
                filterSkeleton.style.display = 'none';
            }
            
            // Hide loader
            const loader = document.querySelector('.loader');
            if (loader) {
                loader.classList.add('hidden');
                setTimeout(() => {
                    if (loader.parentNode) {
                        loader.remove();
                    }
                }, 500);
            }
        }
    }

    function renderCategories() {
        if (!filterButtonsContainer || categories.length === 0) return;
        
        // Remove the skeleton loader
        const filterSkeleton = document.querySelector('.filter-skeleton');
        if (filterSkeleton) filterSkeleton.remove();
        
        // Add category buttons
        categories.forEach((category, index) => {
            const button = document.createElement('button');
            button.className = 'filter-btn';
            button.setAttribute('data-category', category);
            button.textContent = category;
            
            // Add with delay for animation
            setTimeout(() => {
                filterButtonsContainer.appendChild(button);
                setTimeout(() => button.classList.add('fade-in'), 50);
            }, index * 100);
            
            // Add event listener
            button.addEventListener('click', () => filterProjects(category));
        });
    }

    function renderProjects() {
        if (!projectsGrid) return;
        
        // Clear previous projects
        projectsGrid.innerHTML = '';
        
        if (projects.length === 0) {
            showNoProjectsMessage();
            return;
        }
        
        // Filter projects if needed
        const filteredProjects = activeCategory === 'all' 
            ? projects 
            : projects.filter(project => project.category === activeCategory);
        
        if (filteredProjects.length === 0) {
            showNoProjectsMessage();
            return;
        }
        
        if (noProjectsMessage) {
            noProjectsMessage.style.display = 'none';
        }
        
        // Create project cards
        filteredProjects.forEach((project, index) => {
            const projectCard = createProjectCard(project);
            projectsGrid.appendChild(projectCard);
            
            // Add fade-in animation with delay
            setTimeout(() => {
                projectCard.classList.add('fade-in');
            }, 100 * index);
        });
    }

    function createProjectCard(project) {
        const card = document.createElement('div');
        card.className = 'project-item';
        card.setAttribute('data-category', project.category);
        
        // Get the first image as the thumbnail, or use a placeholder
        const thumbnailImage = project.images && project.images.length > 0 
            ? project.images[0] 
            : 'https://via.placeholder.com/800x600/1e1e1e/cccccc?text=No+Image';
        
        card.innerHTML = `
            <div class="project-image">
                <img src="${thumbnailImage}" alt="${project.title}">
                <div class="project-overlay">
                    <a href="/projects/${project.slug}" class="btn-view">View Details</a>
                </div>
            </div>
            <div class="project-info">
                <span class="project-category">${project.category}</span>
                <h3>${project.title}</h3>
                <div class="project-meta-info">
                    <span class="project-meta-item">
                        <i class="fas fa-calendar-alt"></i> ${project.completed_year}
                    </span>
                    <span class="project-meta-item">
                        <i class="fas fa-map-marker-alt"></i> ${project.location}
                    </span>
                </div>
                <p>${truncateText(project.overview, 120)}</p>
                <a href="/projects/${project.slug}" class="read-more">View Project <i class="fas fa-arrow-right"></i></a>
            </div>
        `;
        
        return card;
    }

    function filterProjects(category) {
        // Update active category
        activeCategory = category;
        
        // Update active button
        if (filterButtonsContainer) {
            const buttons = filterButtonsContainer.querySelectorAll('.filter-btn');
            buttons.forEach(btn => {
                if (btn.getAttribute('data-category') === category) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
        
        // Re-render projects
        renderProjects();
    }

    function showNoProjectsMessage() {
        if (!noProjectsMessage) return;
        
        if (projectsGrid) {
            projectsGrid.innerHTML = '';
        }
        noProjectsMessage.style.display = 'block';
    }

    function showErrorState() {
        if (!noProjectsMessage) return;
        
        if (projectsGrid) {
            projectsGrid.innerHTML = '';
        }
        noProjectsMessage.style.display = 'block';
        
        const emptyState = noProjectsMessage.querySelector('.empty-state');
        if (emptyState) {
            emptyState.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <h2>Oops! Something went wrong</h2>
                <p>We're having trouble loading our projects. Please try again later or contact us for assistance.</p>
            `;
        }
    }

    function truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substr(0, maxLength) + '...';
    }

    // Initialize the page
    initialize();

    // Event delegation for filter buttons
    if (filterButtonsContainer) {
        filterButtonsContainer.addEventListener('click', function(e) {
            if (e.target.classList.contains('filter-btn')) {
                const category = e.target.getAttribute('data-category');
                filterProjects(category);
            }
        });
    }
});