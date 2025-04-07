document.addEventListener('DOMContentLoaded', function() {
    const { API_URL, getAuthHeaders, handleApiError, showToast, toggleModal } = window.adminUtils;
    
    // Form elements
    const projectForm = document.getElementById('projectForm');
    const projectId = document.getElementById('projectId');
    const titleInput = document.getElementById('title');
    const slugInput = document.getElementById('slug');
    const generateSlugBtn = document.getElementById('generateSlugBtn');
    const projectTitle = document.getElementById('projectTitle');
    const formTitle = document.getElementById('formTitle');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveBtn = document.getElementById('saveBtn');
    
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
    const duplicateSlug = document.getElementById('duplicateSlug');
    const slugSuggestion = document.getElementById('slugSuggestion');
    const closeSlugModal = document.getElementById('closeSlugModal');
    const confirmSlugBtn = document.getElementById('confirmSlugBtn');
    
    // Check if editing existing project
    const urlParams = new URLSearchParams(window.location.search);
    const editMode = urlParams.has('id');
    
    // Current images array
    let currentImages = [];
    let originalSlug = '';
    
    // Load project data if in edit mode
    async function loadProject() {
        const id = urlParams.get('id');
        
        try {
            // Show loading state
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            
            const response = await fetch(`${API_URL}/projects/${id}`, {
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            const project = await response.json();
            
            if (!project || !project._id) {
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
            originalSlug = project.slug; // Store original slug for comparison
            
            document.getElementById('category').value = project.category;
            document.getElementById('location').value = project.location;
            document.getElementById('completed_year').value = project.completed_year;
            document.getElementById('overview').value = project.overview;
            document.getElementById('active').checked = project.active !== false; // Default to true if not specified
            document.getElementById('enable_feedback').checked = project.enable_feedback !== false; // Default to true if not specified
            
            // Fill scope of work
            scopeList.innerHTML = '';
            if (project.scope_of_work && project.scope_of_work.length > 0) {
                project.scope_of_work.forEach(scope => {
                    addScopeItem(scope);
                });
            } else {
                addScopeItem(); // Add empty row if no items
            }
            
            // Fill challenges
            challengesList.innerHTML = '';
            if (project.challenges && project.challenges.length > 0) {
                project.challenges.forEach((challenge, index) => {
                    addChallengeItem(challenge.challenge, challenge.solution, index + 1);
                });
            } else {
                addChallengeItem(); // Add empty row if no items
            }
            
            // Fill results
            resultsList.innerHTML = '';
            if (project.results && project.results.length > 0) {
                project.results.forEach(result => {
                    addResultItem(result);
                });
            } else {
                addResultItem(); // Add empty row if no items
            }
            
            // Fill images
            currentImages = project.images && project.images.length > 0 ? [...project.images] : [];
            updateImagePreview();
            
            // Reset save button
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Project';
            
        } catch (error) {
            console.error('Error loading project:', error);
            showToast('Failed to load project: ' + (error.message || 'Unknown error'), 'error');
            
            // Reset save button
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Project';
        }
    }
    
    // Add scope item
    function addScopeItem(value = '') {
        const item = document.createElement('div');
        item.className = 'dynamic-field-item';
        item.innerHTML = `
            <input type="text" class="admin-form-control scope-item" placeholder="Enter scope item..." value="${escapeHtml(value)}">
            <button type="button" class="dynamic-field-remove" title="Remove item">
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
                <button type="button" class="dynamic-field-remove" title="Remove item">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="admin-form-group">
                <label>Challenge</label>
                <input type="text" class="admin-form-control challenge-item" placeholder="Describe the challenge..." value="${escapeHtml(challenge)}">
            </div>
            <div class="admin-form-group">
                <label>Solution</label>
                <textarea class="admin-form-control solution-item" placeholder="Describe the solution..." rows="3">${escapeHtml(solution)}</textarea>
            </div>
        `;
        
        // Add remove event listener
        const removeBtn = item.querySelector('.dynamic-field-remove');
        removeBtn.addEventListener('click', function() {
            item.remove();
            // Update challenge numbers
            updateChallengeNumbers();
        });
        
        challengesList.appendChild(item);
    }
    
    // Update challenge numbers
    function updateChallengeNumbers() {
        const challenges = document.querySelectorAll('.challenge-solution-pair');
        challenges.forEach((challenge, index) => {
            const title = challenge.querySelector('.challenge-solution-title');
            title.textContent = `Challenge & Solution #${index + 1}`;
        });
    }
    
    // Add result item
    function addResultItem(value = '') {
        const item = document.createElement('div');
        item.className = 'dynamic-field-item';
        item.innerHTML = `
            <input type="text" class="admin-form-control result-item" placeholder="Enter result or benefit..." value="${escapeHtml(value)}">
            <button type="button" class="dynamic-field-remove" title="Remove item">
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
        
        if (currentImages.length === 0) {
            return; // No images to display
        }
        
        currentImages.forEach((image, index) => {
            const item = document.createElement('div');
            item.className = 'image-preview-item';
            item.innerHTML = `
                <img src="${image}" alt="Project Image ${index + 1}">
                <div class="image-preview-remove" data-index="${index}" title="Remove image">
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
        if (editMode && slug === originalSlug) {
            return true; // Same slug in edit mode is always available
        }
        
        try {
            const response = await fetch(`${API_URL}/projects/check-slug/${slug}`, {
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    // If endpoint doesn't exist, assume slug is available
                    return true;
                }
                await handleApiError(response);
                return false;
            }
            
            const data = await response.json();
            return data.available !== false;
            
        } catch (error) {
            console.error('Error checking slug:', error);
            // If there's an error, we'll assume it's available and let the server validation catch duplicates
            return true;
        }
    }
    
    // Generate slug suggestions
    function generateSlugSuggestions(baseSlug) {
        const suggestions = [];
        
        // Add a number suffix
        for (let i = 1; i <= 3; i++) {
            suggestions.push(`${baseSlug}-${i}`);
        }
        
        // Add a random suffix
        const randomSuffix = Math.random().toString(36).substring(2, 6);
        suggestions.push(`${baseSlug}-${randomSuffix}`);
        
        // Add today's date
        const today = new Date();
        const dateSuffix = `${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
        suggestions.push(`${baseSlug}-${dateSuffix}`);
        
        return suggestions;
    }
    
    // Show slug suggestions
    function showSlugSuggestions(slug) {
        duplicateSlug.textContent = slug;
        
        const suggestions = generateSlugSuggestions(slug);
        
        let html = `
            <p>Try one of these alternatives:</p>
            <div class="slug-options">
        `;
        
        suggestions.forEach((suggestion, index) => {
            html += `
                <div class="slug-option">
                    <input type="radio" id="slug-option-${index}" name="slug-option" value="${suggestion}" ${index === 0 ? 'checked' : ''}>
                    <label for="slug-option-${index}">${suggestion}</label>
                </div>
            `;
        });
        
        html += `</div>`;
        
        slugSuggestion.innerHTML = html;
        
        // Add event listeners to radio buttons
        const radioButtons = document.querySelectorAll('input[name="slug-option"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.checked) {
                    slugInput.value = this.value;
                }
            });
        });
        
        toggleModal(slugCheckModal, true);
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
            
            return data.url || data.path || data.location;
            
        } catch (error) {
            console.error('Error uploading image:', error);
            showToast('Failed to upload image: ' + (error.message || 'Unknown error'), 'error');
            return null;
        }
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
    
    // Handle form submission
    async function handleSubmit(e) {
        e.preventDefault();
        
        // Validate form
        if (!validateForm()) {
            return;
        }
        
        // Check slug availability if not in edit mode or if slug has changed
        if (!editMode || slugInput.value !== originalSlug) {
            const slugAvailable = await checkSlugAvailability(slugInput.value);
            if (!slugAvailable) {
                showSlugSuggestions(slugInput.value);
                return;
            }
        }
        
        // Show loading state
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        try {
            // Get form data
            const formData = {
                title: titleInput.value.trim(),
                slug: slugInput.value.trim(),
                category: document.getElementById('category').value.trim(),
                location: document.getElementById('location').value.trim(),
                completed_year: document.getElementById('completed_year').value.trim(),
                overview: document.getElementById('overview').value.trim(),
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
            
            let response;
            
            if (editMode) {
                // Update existing project
                response = await fetch(`${API_URL}/projects/${projectId.value}`, {
                    method: 'PUT',
                    headers: {
                        ...getAuthHeaders(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
            } else {
                // Create new project
                response = await fetch(`${API_URL}/projects`, {
                    method: 'POST',
                    headers: {
                        ...getAuthHeaders(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
            }
            
            await handleApiError(response);
            
            showToast(`Project ${editMode ? 'updated' : 'created'} successfully`, 'success');
            
            // Redirect to projects page
            setTimeout(() => {
                window.location.href = 'projects.html';
            }, 1000);
            
        } catch (error) {
            console.error('Error saving project:', error);
            showToast(`Failed to ${editMode ? 'update' : 'create'} project: ` + (error.message || 'Unknown error'), 'error');
            
            // Reset button
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Project';
        }
    }
    
    // Validate form
    function validateForm() {
        // Check required fields
        if (!titleInput.value.trim()) {
            showToast('Please enter a project title', 'error');
            titleInput.focus();
            return false;
        }
        
        if (!slugInput.value.trim()) {
            showToast('Please enter a project slug', 'error');
            slugInput.focus();
            return false;
        }
        
        if (!document.getElementById('category').value.trim()) {
            showToast('Please enter a category', 'error');
            document.getElementById('category').focus();
            return false;
        }
        
        if (!document.getElementById('location').value.trim()) {
            showToast('Please enter a location', 'error');
            document.getElementById('location').focus();
            return false;
        }
        
        if (!document.getElementById('completed_year').value.trim()) {
            showToast('Please enter the completed year', 'error');
            document.getElementById('completed_year').focus();
            return false;
        }
        
        if (!document.getElementById('overview').value.trim()) {
            showToast('Please enter a project overview', 'error');
            document.getElementById('overview').focus();
            return false;
        }
        
        // Check if at least one scope item exists
        const scopeItems = document.querySelectorAll('.scope-item');
        let hasValidScope = false;
        
        for (let i = 0; i < scopeItems.length; i++) {
            if (scopeItems[i].value.trim()) {
                hasValidScope = true;
                break;
            }
        }
        
        if (!hasValidScope) {
            showToast('Please add at least one scope of work item', 'error');
            if (scopeItems.length > 0) {
                scopeItems[0].focus();
            }
            return false;
        }
        
        // Check if at least one challenge/solution pair exists
        const challengeItems = document.querySelectorAll('.challenge-solution-pair');
        let hasValidChallenge = false;
        
        for (let i = 0; i < challengeItems.length; i++) {
            const challenge = challengeItems[i].querySelector('.challenge-item').value.trim();
            const solution = challengeItems[i].querySelector('.solution-item').value.trim();
            
            if (challenge && solution) {
                hasValidChallenge = true;
                break;
            }
        }
        
        if (!hasValidChallenge) {
            showToast('Please add at least one challenge and solution', 'error');
            const firstChallenge = document.querySelector('.challenge-item');
            if (firstChallenge) {
                firstChallenge.focus();
            }
            return false;
        }
        
        // Check if at least one result item exists
        const resultItems = document.querySelectorAll('.result-item');
        let hasValidResult = false;
        
        for (let i = 0; i < resultItems.length; i++) {
            if (resultItems[i].value.trim()) {
                hasValidResult = true;
                break;
            }
        }
        
        if (!hasValidResult) {
            showToast('Please add at least one result or benefit', 'error');
            if (resultItems.length > 0) {
                resultItems[0].focus();
            }
            return false;
        }
        
        return true;
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
            
            // Ensure slug is properly formatted
            this.value = generateSlug(this.value);
        });
    }
    
    if (generateSlugBtn) {
        generateSlugBtn.addEventListener('click', function() {
            if (titleInput.value.trim()) {
                slugInput.value = generateSlug(titleInput.value);
                slugInput.dataset.userEdited = 'true';
            } else {
                showToast('Please enter a title first', 'error');
                titleInput.focus();
            }
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
            toggleModal(slugCheckModal, false);
        });
    }
    
    if (confirmSlugBtn) {
        confirmSlugBtn.addEventListener('click', function() {
            toggleModal(slugCheckModal, false);
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
    }
    
    init();
});
