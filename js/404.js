document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://shivfabricator.onrender.com/api';
    const dynamicContent = document.getElementById('dynamic-content');
    const errorContent = document.getElementById('error-content');
    
    // Function to extract the path from the URL
    function getPath() {
        const path = window.location.pathname;
        return path;
    }
    
    // Function to check if the current path is a project page
    function isProjectPage() {
        const path = getPath();
        return path.startsWith('/projects/') && path.length > 10;
    }
    
    // Function to get the project slug from the URL
    function getProjectSlug() {
        const path = getPath();
        if (isProjectPage()) {
            return path.split('/projects/')[1];
        }
        return null;
    }
    
    // Function to check if this is a feedback page
    function isFeedbackPage() {
        const urlParams = new URLSearchParams(window.location.search);
        return window.location.pathname === '/feedback' && urlParams.has('code');
    }
    
    // Function to get the feedback code from the URL
    function getFeedbackCode() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('code');
    }
    
    // Load project details
    async function loadProject() {
        const slug = getProjectSlug();
        if (!slug) {
            showError();
            return;
        }
        
        try {
            const response = await fetch(`${API_URL}/projects/${slug}`);
            if (!response.ok) {
                throw new Error('Project not found');
            }
            
            const project = await response.json();
            renderProject(project);
            
            // Update page title and meta
            document.title = `${project.title} - Shiva Fabrications`;
            
            // Load feedback if available
            if (project.enable_feedback) {
                loadFeedback(project);
            }
            
            // Hide loader
            const loader = document.querySelector('.loader');
            if (loader) {
                loader.classList.add('hidden');
                setTimeout(() => loader.remove(), 500);
            }
        } catch (error) {
            console.error('Error loading project:', error);
            showError();
        }
    }
    
    // Render project details
    function renderProject(project) {
        // Create HTML for the project
        const projectHtml = `
            <section class="project-header">
                <div class="container">
                    <h1>${project.title}</h1>
                    <div class="project-meta">
                        <span><i class="fas fa-calendar-alt"></i> Completed: ${project.completed_year}</span>
                        <span><i class="fas fa-map-marker-alt"></i> Location: ${project.location}</span>
                        <span><i class="fas fa-tag"></i> Category: ${project.category}</span>
                    </div>
                </div>
            </section>
            
            <section class="project-details">
                <div class="container">
                    <div class="project-content">
                        <div class="project-overview">
                            <h2>Project Overview</h2>
                            <p>${project.overview}</p>
                        </div>
                        
                        <div class="project-gallery" id="projectGallery">
                            ${project.images.map(img => `
                                <a href="${img}" class="gallery-item" target="_blank">
                                    <img src="${img}" alt="${project.title}">
                                </a>
                            `).join('')}
                        </div>
                        
                        <div class="project-scope">
                            <h2>Scope of Work</h2>
                            <ul>
                                ${project.scope_of_work.map(item => `<li>${item}</li>`).join('')}
                            </ul>
                        </div>
                        
                        <div class="project-challenges">
                            <h2>Challenges & Solutions</h2>
                            ${project.challenges.map(item => `
                                <div class="challenge-item">
                                    <h3>Challenge: ${item.challenge}</h3>
                                    <p>${item.solution}</p>
                                </div>
                            `).join('')}
                        </div>
                        
                        <div class="project-results">
                            <h2>Results & Benefits</h2>
                            <ul>
                                ${project.results.map(item => `<li>${item}</li>`).join('')}
                            </ul>
                        </div>
                        
                        <div class="project-feedback" id="projectFeedback">
                            <h2>Client Testimonials</h2>
                            <div class="feedback-loading">
                                <div class="spinner"></div>
                                <p>Loading feedback...</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="project-sidebar">
                        <div class="sidebar-widget">
                            <h3>Project Specifications</h3>
                            <ul class="spec-list">
                                <li><strong>Category:</strong> ${project.category}</li>
                                <li><strong>Location:</strong> ${project.location}</li>
                                <li><strong>Completed:</strong> ${project.completed_year}</li>
                            </ul>
                        </div>
                        
                        <div class="sidebar-widget">
                            <h3>Need a Similar Solution?</h3>
                            <p>Contact us to discuss your project requirements and how we can help you achieve your goals.</p>
                            <a href="/contact.html" class="btn btn-primary">Contact Us</a>
                        </div>
                    </div>
                </div>
            </section>
            
            <section class="project-navigation">
                <div class="container">
                    <div class="nav-links">
                        <a href="/projects.html" class="back-to-projects"><i class="fas fa-th-large"></i> Back to All Projects</a>
                    </div>
                </div>
            </section>
        `;
        
        // Set the content
        dynamicContent.innerHTML = projectHtml;
    }
    
    // Load feedback for a project
    async function loadFeedback(project) {
        try {
            const response = await fetch(`${API_URL}/public/feedback/${project.slug}`);
            if (!response.ok) {
                throw new Error('Failed to load feedback');
            }
            
            const feedback = await response.json();
            const feedbackContainer = document.getElementById('projectFeedback');
            
            if (feedbackContainer) {
                // Remove loading indicator
                feedbackContainer.querySelector('.feedback-loading').remove();
                
                if (feedback.length === 0) {
                    // No feedback yet
                    feedbackContainer.innerHTML += `
                        <div class="no-feedback">
                            <i class="fas fa-comments"></i>
                            <p>No testimonials available for this project yet.</p>
                        </div>
                    `;
                } else {
                    // Render feedback
                    feedback.forEach(item => {
                        const testimonialHtml = `
                            <div class="testimonial-card">
                                <div class="quote-icon">
                                    <i class="fas fa-quote-left"></i>
                                </div>
                                <div class="rating">
                                    ${generateStarRating(item.rating)}
                                </div>
                                <p class="testimonial-text">${item.text}</p>
                                <div class="client-info">
                                    <h4>${item.author_name}</h4>
                                    <p>${item.company_name}</p>
                                </div>
                            </div>
                        `;
                        
                        feedbackContainer.innerHTML += testimonialHtml;
                    });
                }
            }
        } catch (error) {
            console.error('Error loading feedback:', error);
            const feedbackContainer = document.getElementById('projectFeedback');
            if (feedbackContainer) {
                // Remove loading indicator
                feedbackContainer.querySelector('.feedback-loading').remove();
                
                // Show error message
                feedbackContainer.innerHTML += `
                    <div class="no-feedback">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Unable to load testimonials at this time.</p>
                    </div>
                `;
            }
        }
    }
    
    // Generate star rating HTML
    function generateStarRating(rating) {
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
    
    // Load feedback submission form
    async function loadFeedbackForm() {
        const code = getFeedbackCode();
        if (!code) {
            showError();
            return;
        }
        
        try {
            dynamicContent.innerHTML = `
                <section class="page-header">
                    <div class="container">
                        <h1>Submit Your Feedback</h1>
                        <p>We value your opinion on our work</p>
                    </div>
                </section>
                
                <section class="feedback-form-section">
                    <div class="container">
                        <div class="feedback-form-container">
                            <div class="form-header">
                                <h2>Share Your Experience</h2>
                                <p>Please tell us about your experience working with Shiva Fabrications.</p>
                            </div>
                            <form id="feedbackForm" class="feedback-form">
                                <input type="hidden" id="feedbackCode" value="${code}">
                                
                                <div class="form-group">
                                    <label for="companyName">Company Name*</label>
                                    <input type="text" id="companyName" name="companyName" required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="authorName">Your Name*</label>
                                    <input type="text" id="authorName" name="authorName" required>
                                </div>
                                
                                <div class="form-group full-width">
                                    <label for="rating">How would you rate our service? (1-5)*</label>
                                    <div class="rating-selector">
                                        <div class="star-rating">
                                            <i class="far fa-star" data-rating="1"></i>
                                            <i class="far fa-star" data-rating="2"></i>
                                            <i class="far fa-star" data-rating="3"></i>
                                            <i class="far fa-star" data-rating="4"></i>
                                            <i class="far fa-star" data-rating="5"></i>
                                        </div>
                                        <input type="hidden" id="rating" name="rating" value="" required>
                                        <div class="rating-text">Select a rating</div>
                                    </div>
                                </div>
                                
                                <div class="form-group full-width">
                                    <label for="feedbackText">Your Feedback*</label>
                                    <textarea id="feedbackText" name="feedbackText" rows="6" required></textarea>
                                </div>
                                
                                <div class="form-group full-width">
                                    <button type="submit" class="btn btn-primary">Submit Feedback</button>
                                </div>
                            </form>
                            <div class="form-success" style="display: none;">
                                <div class="success-icon">
                                    <i class="fas fa-check-circle"></i>
                                </div>
                                <h2>Thank You for Your Feedback!</h2>
                                <p>Your feedback has been submitted successfully. We appreciate you taking the time to share your experience with us.</p>
                                <a href="/index.html" class="btn btn-primary">Back to Home</a>
                            </div>
                        </div>
                    </div>
                </section>
            `;
            
            // Setup star rating functionality
            const stars = document.querySelectorAll('.star-rating i');
            const ratingInput = document.getElementById('rating');
            const ratingText = document.querySelector('.rating-text');
            
            stars.forEach(star => {
                star.addEventListener('mouseover', function() {
                    const rating = this.getAttribute('data-rating');
                    highlightStars(rating);
                });
                
                star.addEventListener('mouseout', function() {
                    const currentRating = ratingInput.value || 0;
                    highlightStars(currentRating);
                });
                
                star.addEventListener('click', function() {
                    const rating = this.getAttribute('data-rating');
                    ratingInput.value = rating;
                    highlightStars(rating);
                    updateRatingText(rating);
                });
            });
            
            function highlightStars(rating) {
                stars.forEach(star => {
                    const starRating = star.getAttribute('data-rating');
                    if (starRating <= rating) {
                        star.className = 'fas fa-star';
                    } else {
                        star.className = 'far fa-star';
                    }
                });
            }
            
            function updateRatingText(rating) {
                const texts = [
                    'Select a rating',
                    'Poor',
                    'Fair',
                    'Good',
                    'Very Good',
                    'Excellent'
                ];
                ratingText.textContent = texts[rating] || texts[0];
            }
            
            // Setup form submission
            const feedbackForm = document.getElementById('feedbackForm');
            feedbackForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const submitBtn = feedbackForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
                submitBtn.disabled = true;
                
                const formData = {
                    company_name: document.getElementById('companyName').value,
                    author_name: document.getElementById('authorName').value,
                    rating: parseInt(document.getElementById('rating').value),
                    text: document.getElementById('feedbackText').value,
                    feedback_code: document.getElementById('feedbackCode').value
                };
                
                try {
                    const response = await fetch(`${API_URL}/feedback`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(formData)
                    });
                    
                    if (!response.ok) {
                        throw new Error('Failed to submit feedback');
                    }
                    
                    // Show success message
                    feedbackForm.style.display = 'none';
                    document.querySelector('.form-success').style.display = 'block';
                    document.querySelector('.form-header').style.display = 'none';
                    
                } catch (error) {
                    console.error('Error submitting feedback:', error);
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                    alert('There was an error submitting your feedback. Please try again.');
                }
            });
            
            // Update page title and meta
            document.title = 'Submit Feedback - Shiva Fabrications';
            
            // Hide loader
            const loader = document.querySelector('.loader');
            if (loader) {
                loader.classList.add('hidden');
                setTimeout(() => loader.remove(), 500);
            }
            
        } catch (error) {
            console.error('Error loading feedback form:', error);
            showError();
        }
    }
    
    // Show error content
    function showError() {
        dynamicContent.style.display = 'none';
        errorContent.style.display = 'block';
        
        // Hide loader
        const loader = document.querySelector('.loader');
        if (loader) {
            loader.classList.add('hidden');
            setTimeout(() => loader.remove(), 500);
        }
    }
    
    // Initialize the page based on the URL
    function initializePage() {
        if (isProjectPage()) {
            loadProject();
        } else if (isFeedbackPage()) {
            loadFeedbackForm();
        } else {
            showError();
        }
    }
    
    // Start the page initialization
    initializePage();
});