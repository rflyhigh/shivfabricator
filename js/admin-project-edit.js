document.addEventListener('DOMContentLoaded', function() {
    const { API_URL, getAuthHeaders, handleApiError, showToast } = window.adminUtils;
    
    // Form elements
    const projectForm = document.getElementById('projectForm');
    const projectId = document.getElementById('projectId');
    const titleInput = document.getElementById('title');
    const slugInput = document.getElementById('slug');
    const projectTitle = document.getElementById('projectTitle');
    const formTitle = document.getElementById('formTitle');
    const cancelBtn = document.getElementById('cancelBtn');
    
    // Dynamic fields
    const scopeList = document.getElementById('scopeList');
    const addScope = document.getElementById('addScope');
    const challengesList = document.getElementById('challengesList');
    const addChallenge = document.getElementById('addChallenge');
    const resultsList = document.getElementById('resultsList');
    const addResult = document.getElementById('addResult');
    
    // Image upload
    const imageDropZone = document.getElementById('imageDropZone');
    const imageUpload = document.getElementById('imageUpload');
    const imagePreview = document.getElementById('imagePreview');
    
    // Slug check modal
    const slugCheckModal = document.getElementById('slugCheckModal');
    const closeSlugModal = document.getElementById('closeSlugModal');
    const confirmSlugBtn = document.getElementById('confirmSlugBtn');
    
    // Check if editing existing project
    const urlParams = new URLSearchParams(window.location.search);
    const editMode = urlParams.has('id');
    
    // Current images array
    let currentImages = [];
    
    // Load project data if in edit mode
    async function loadProject() {
        const id = urlParams.get('id');
        
        try {
            const response = await fetch(`${API_URL}/projects`, {
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            const projects = await response.json();
            
            const project = projects.find(p => p._id === id);
            if (!project) {
                showToast('Project not found', 'error');
                window.location.href = 'projects.html';
                return;
            }
            
            // Update page title
            projectTitle.textContent = `Edit Project: ${project.title}`;
            formTitle.textContent = 'Edit Project';
            
            // Fill form with project data
            projectId.value = project._id;
            titleInput.value = project.title;
            slugInput.value = project.slug;
            document.getElementById('category').value = project.category;
            document.getElementById('location').value = project.location;
            document.getElementById('completed_year').value = project.completed_year;
            document.getElementById('overview').value = project.overview;
            document.getElementById('active').checked = project.active;
            document.getElementById('enable_feedback').checked = project.enable_feedback;
            
            // Fill scope of work
            scopeList.innerHTML = '';
            project.scope_of_work.forEach(scope => {
                addScopeItem(scope);
            });
            
            // Fill challenges
            challengesList.innerHTML = '';
            project.challenges.forEach((challenge, index) => {
                addChallengeItem(challenge.challenge, challenge.solution, index + 1);
            });
            
            // Fill results
            resultsList.innerHTML = '';
            project.results.forEach(result => {
                addResultItem(result);
            });
            
            // Fill images
            currentImages = [...project.images];
            updateImagePreview();
            
        } catch (error) {
            console.error('Error loading project:', error);
            showToast('Failed to load project', 'error');
        }
    }
    
    // Add scope item
    function addScopeItem(value = '') {
        const item = document.createElement('div');
        item.className = 'dynamic-field-item';
        item.innerHTML = `
            <input type="text" class="admin-form-control scope-item" placeholder="Enter scope item..." value="${value}">
            <button type="button" class="dynamic-field-remove">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add remove event listener
        const removeBtn = item.querySelector('.dynamic-field-remove');
        removeBtn.addEventListener('click', function() {
            item.remove();
        });
        
        scopeList.appendChild(item);
    }
    
    // Add challenge item
    function addChallengeItem(challenge = '', solution = '', index = null) {
        const count = index || document.querySelectorAll('.challenge-solution-pair').length + 1;
        
        const item = document.createElement('div');
        item.className = 'challenge-solution-pair';
        item.innerHTML = `
            <div class="challenge-solution-header">
                <div class="challenge-solution-title">Challenge & Solution #${count}</div>
                <button type="button" class="dynamic-field-remove">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="admin-form-group">
                <label>Challenge</label>
                <input type="text" class="admin-form-control challenge-item" placeholder="Describe the challenge..." value="${challenge}">
            </div>
            <div class="admin-form-group">
                <label>Solution</label>
                <textarea class="admin-form-control solution-item" placeholder="Describe the solution...">${solution}</textarea>
            </div>
        `;
        
        // Add remove event listener
        const removeBtn = item.querySelector('.dynamic-field-remove');
        removeBtn.addEventListener('click', function() {
            item.remove();
        });
        
        challengesList.appendChild(item);
    }
    
    // Add result item
    function addResultItem(value = '') {
        const item = document.createElement('div');
        item.className = 'dynamic-field-item';
        item.innerHTML = `
            <input type="text" class="admin-form-control result-item" placeholder="Enter result or benefit..." value="${value}">
            <button type="button" class="dynamic-field-remove">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add remove event listener
        const removeBtn = item.querySelector('.dynamic-field-remove');
        removeBtn.addEventListener('click', function() {
            item.remove();
        });
        
        resultsList.appendChild(item);
    }
    
    // Update image preview
    function updateImagePreview() {
        imagePreview.innerHTML = '';
        
        currentImages.forEach((image, index) => {
            const item = document.createElement('div');
            item.className = 'image-preview-item';
            item.innerHTML = `
                <img src="${image}" alt="Project Image ${index + 1}">
                <div class="image-preview-remove" data-index="${index}">
                    <i class="fas fa-times"></i>
                </div>
            `;
            
            // Add remove event listener
            const removeBtn = item.querySelector('.image-preview-remove');
            removeBtn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                currentImages.splice(index, 1);
                updateImagePreview();
            });
            
            imagePreview.appendChild(item);
        });
    }
    
    // Generate slug from title
    function generateSlug(title) {
        return title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remove special characters
            .replace(/\s+/g, '-')     // Replace spaces with hyphens
            .replace(/-+/g, '-')      // Replace multiple hyphens with single hyphen
            .trim();
    }
    
    // Check if slug is available
    async function checkSlugAvailability(slug) {
        try {
            const response = await fetch(`${API_URL}/check-slug/${slug}`, {
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            const data = await response.json();
            
            return data.available;
            
        } catch (error) {
            console.error('Error checking slug:', error);
            return false;
        }
    }
    
    // Upload image to server
    async function uploadImage(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: formData
            });
            
            await handleApiError(response);
            const data = await response.json();
            
            return data.url;
            
        } catch (error) {
            console.error('Error uploading image:', error);
            showToast('Failed to upload image', 'error');
            return null;
        }
    }
    
    // Handle form submission
    async function handleSubmit(e) {
        e.preventDefault();
        
        // Get form data
        const formData = {
            title: titleInput.value,
            slug: slugInput.value,
            category: document.getElementById('category').value,
            location: document.getElementById('location').value,
            completed_year: document.getElementById('completed_year').value,
            overview: document.getElementById('overview').value,
            active: document.getElementById('active').checked,
            enable_feedback: document.getElementById('enable_feedback').checked,
            scope_of_work: [],
            challenges: [],
            results: [],
            images: currentImages
        };
        
        // Get scope of work
        document.querySelectorAll('.scope-item').forEach(item => {
            if (item.value.trim()) {
                formData.scope_of_work.push(item.value.trim());
            }
        });
        
        // Get challenges
        const challengeItems = document.querySelectorAll('.challenge-solution-pair');
        for (let i = 0; i < challengeItems.length; i++) {
            const challenge = challengeItems[i].querySelector('.challenge-item').value.trim();
            const solution = challengeItems[i].querySelector('.solution-item').value.trim();
            
            if (challenge && solution) {
                formData.challenges.push({
                    challenge: challenge,
                    solution: solution
                });
            }
        }
        
        // Get results
        document.querySelectorAll('.result-item').forEach(item => {
            if (item.value.trim()) {
                formData.results.push(item.value.trim());
            }
        });
        
        // Validate form
        if (!formData.title || !formData.slug || !formData.category || 
            !formData.location || !formData.completed_year || !formData.overview) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        if (formData.scope_of_work.length === 0) {
            showToast('Please add at least one scope of work item', 'error');
            return;
        }
        
        if (formData.challenges.length === 0) {
            showToast('Please add at least one challenge and solution', 'error');
            return;
        }
        
        if (formData.results.length === 0) {
            showToast('Please add at least one result or benefit', 'error');
            return;
        }
        
        // Check slug availability if creating new project
        if (!editMode) {
            const slugAvailable = await checkSlugAvailability(formData.slug);
            if (!slugAvailable) {
                slugCheckModal.classList.add('active');
                return;
            }
        }
        
        // Show loading state
        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn.textContent;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveBtn.disabled = true;
        
        try {
            let response;
            
            if (editMode) {
                // Update existing project
                response = await fetch(`${API_URL}/projects/${slugInput.value}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(formData)
                });
            } else {
                // Create new project
                response = await fetch(`${API_URL}/projects`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(formData)
                });
            }
            
            await handleApiError(response);
            
            showToast(`Project ${editMode ? 'updated' : 'created'} successfully`, 'success');
            
            // Redirect to projects page
            window.location.href = 'projects.html';
            
        } catch (error) {
            console.error('Error saving project:', error);
            showToast(`Failed to ${editMode ? 'update' : 'create'} project`, 'error');
            
            // Reset button
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }
    
    // Event listeners
    if (titleInput) {
        titleInput.addEventListener('input', function() {
            if (!editMode && !slugInput.dataset.userEdited) {
                slugInput.value = generateSlug(this.value);
            }
        });
    }
    
    if (slugInput) {
        slugInput.addEventListener('input', function() {
            this.dataset.userEdited = 'true';
        });
    }
    
    if (addScope) {
        addScope.addEventListener('click', function() {
            addScopeItem();
        });
    }
    
    if (addChallenge) {
        addChallenge.addEventListener('click', function() {
            addChallengeItem();
        });
    }
    
    if (addResult) {
        addResult.addEventListener('click', function() {
            addResultItem();
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            window.location.href = 'projects.html';
        });
    }
    
    if (closeSlugModal) {
        closeSlugModal.addEventListener('click', function() {
            slugCheckModal.classList.remove('active');
        });
    }
    
    if (confirmSlugBtn) {
        confirmSlugBtn.addEventListener('click', function() {
            slugCheckModal.classList.remove('active');
        });
    }
    
    // Image upload handling
    if (imageDropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            imageDropZone.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        ['dragenter', 'dragover'].forEach(eventName => {
            imageDropZone.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            imageDropZone.addEventListener(eventName, unhighlight, false);
        });
        
        function highlight() {
            imageDropZone.classList.add('highlight');
        }
        
        function unhighlight() {
            imageDropZone.classList.remove('highlight');
        }
        
        imageDropZone.addEventListener('drop', handleDrop, false);
        
        async function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            handleFiles(files);
        }
        
        imageDropZone.addEventListener('click', function() {
            imageUpload.click();
        });
        
        imageUpload.addEventListener('change', function() {
            handleFiles(this.files);
        });
        
        async function handleFiles(files) {
            const validFiles = [...files].filter(file => file.type.startsWith('image/'));
            
            if (validFiles.length === 0) {
                showToast('Please upload valid image files', 'error');
                return;
            }
            
            // Show loading state
            const prompt = imageDropZone.querySelector('.drop-zone-prompt');
            const originalText = prompt.innerHTML;
            prompt.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Uploading images...</span>';
            
            for (let i = 0; i < validFiles.length; i++) {
                const file = validFiles[i];
                const imageUrl = await uploadImage(file);
                
                if (imageUrl) {
                    currentImages.push(imageUrl);
                }
            }
            
            // Reset prompt
            prompt.innerHTML = originalText;
            
            // Update image preview
            updateImagePreview();
        }
    }
    
    // Initialize page
    function init() {
        if (editMode) {
            loadProject();
        } else {
            // Add initial empty fields
            addScopeItem();
            addChallengeItem();
            addResultItem();
        }
        
        // Set up form submission
        if (projectForm) {
            projectForm.addEventListener('submit', handleSubmit);
        }
        
        // Add CSS for drop zone
        const dropZoneStyle = document.createElement('style');
        dropZoneStyle.textContent = `
            .drop-zone.highlight {
                border-color: var(--primary-color);
                background-color: rgba(0, 198, 255, 0.05);
            }
            
            .challenge-solution-pair {
                background-color: rgba(255, 255, 255, 0.03);
                border-radius: var(--border-radius);
                padding: 20px;
                margin-bottom: 20px;
                border: 1px solid rgba(255, 255, 255, 0.05);
            }
            
            .challenge-solution-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            }
            
            .challenge-solution-title {
                font-weight: 600;
                color: var(--text-primary);
            }
        `;
        document.head.appendChild(dropZoneStyle);
    }
    
    init();
});