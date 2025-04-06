document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://shivfabricator.onrender.com/api';
    const contactForm = document.getElementById('contactForm');
    const formSuccess = document.querySelector('.form-success');
    
    // Hide loader when page is loaded
    const loader = document.querySelector('.loader');
    if (loader) {
        setTimeout(() => {
            loader.classList.add('hidden');
            setTimeout(() => loader.remove(), 500);
        }, 800);
    }
    
    // Handle form submission
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Show loading state
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            submitBtn.disabled = true;
            
            // Get form data
            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                company: document.getElementById('company').value || '',
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value
            };
            
            try {
                // Send data to API
                const response = await fetch(`${API_URL}/contact`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                
                if (!response.ok) {
                    throw new Error('Failed to send message');
                }
                
                // Show success message
                contactForm.style.display = 'none';
                formSuccess.style.display = 'block';
                
            } catch (error) {
                console.error('Error sending message:', error);
                
                // Reset button
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                
                // Show error toast
                showToast('Error', 'There was a problem sending your message. Please try again later.', 'error');
            }
        });
    }
    
    // REMOVED FAQ functionality - this is now handled by script.js
    
    // Toast notification function
    function showToast(title, message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastTitle = toast.querySelector('.toast-title');
        const toastMessage = toast.querySelector('.toast-message');
        const toastIcon = toast.querySelector('.toast-icon i');
        
        // Set content
        toastTitle.textContent = title;
        toastMessage.textContent = message;
        
        // Set icon based on type
        if (type === 'success') {
            toastIcon.className = 'fas fa-check-circle';
            toast.style.borderLeft = '4px solid #4caf50';
        } else if (type === 'error') {
            toastIcon.className = 'fas fa-exclamation-circle';
            toast.style.borderLeft = '4px solid #f44336';
        } else if (type === 'warning') {
            toastIcon.className = 'fas fa-exclamation-triangle';
            toast.style.borderLeft = '4px solid #ff9800';
        } else {
            toastIcon.className = 'fas fa-info-circle';
            toast.style.borderLeft = '4px solid #00c6ff';
        }
        
        // Show toast
        toast.classList.add('show');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 5000);
        
        // Close on click
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            toast.classList.remove('show');
        });
    }
});