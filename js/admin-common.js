// Common functionality for all admin pages
document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://shivfabricator.onrender.com/api';
    const adminSidebar = document.getElementById('adminSidebar');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    const toggleSidebar = document.getElementById('toggleSidebar');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminNameElement = document.getElementById('adminName');
    
    // Check authentication
    function checkAuth() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            // Redirect to login page if no token
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }
    
    // Redirect to login page
    function redirectToLogin() {
        window.location.href = 'login.html';
    }
    
    // Set admin name from localStorage
    if (adminNameElement) {
        const email = localStorage.getItem('adminEmail');
        if (email) {
            // Extract name from email (before @)
            const name = email.split('@')[0];
            // Capitalize first letter
            adminNameElement.textContent = name.charAt(0).toUpperCase() + name.slice(1);
        }
    }
    
    // Toggle sidebar on mobile
    if (toggleSidebar && adminSidebar) {
        toggleSidebar.addEventListener('click', function() {
            adminSidebar.classList.toggle('active');
            sidebarBackdrop.classList.toggle('active');
            document.body.classList.toggle('no-scroll');
        });
        
        // Close sidebar when clicking outside
        if (sidebarBackdrop) {
            sidebarBackdrop.addEventListener('click', function() {
                adminSidebar.classList.remove('active');
                sidebarBackdrop.classList.remove('active');
                document.body.classList.remove('no-scroll');
            });
        }
    }
    
    // Handle logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('authToken');
            localStorage.removeItem('adminEmail');
            window.location.href = 'login.html';
        });
    }
    
    // Helper function to get auth headers
    function getAuthHeaders() {
        const token = localStorage.getItem('authToken');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }
    
    // Helper function to handle API errors
    async function handleApiError(response) {
        if (!response.ok) {
            // If unauthorized, redirect to login
            if (response.status === 401) {
                localStorage.removeItem('authToken');
                window.location.href = 'login.html';
                return;
            }
            
            // Try to get error message from response
            try {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'An error occurred');
            } catch (e) {
                throw new Error(`API Error: ${response.status}`);
            }
        }
    }
    
    // Format date helper
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // Show toast notification
    function showToast(message, type = 'success') {
        // Create toast element if it doesn't exist
        let toast = document.getElementById('adminToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'adminToast';
            toast.className = 'admin-toast';
            document.body.appendChild(toast);
        }
        
        // Set toast content and type
        toast.innerHTML = `
            <div class="admin-toast-content ${type}">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Show toast
        toast.classList.add('show');
        
        // Hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    // Toggle modal visibility
    function toggleModal(modal, show) {
        if (show) {
            modal.classList.add('active');
            document.body.classList.add('no-scroll');
        } else {
            modal.classList.remove('active');
            document.body.classList.remove('no-scroll');
        }
    }
    
    // Fetch with authentication token
    async function fetchWithAuth(url, options = {}) {
        const token = localStorage.getItem('authToken');
        if (!token) {
            redirectToLogin();
            return;
        }

        const headers = options.headers || {};
        headers['Authorization'] = `Bearer ${token}`;
        
        // Ensure the URL has the correct base
        let fullUrl = url;
        if (!url.startsWith('http')) {
            fullUrl = API_URL + (url.startsWith('/') ? url : '/' + url);
        }

        return fetch(fullUrl, {
            ...options,
            headers
        });
    }

    // Debounce function to limit how often a function can be called
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

    // Escape HTML to prevent XSS
    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    // Add CSS for toast if not already in the main CSS
    const toastStyle = document.createElement('style');
    toastStyle.textContent = `
        .admin-toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            transform: translateY(100px);
            opacity: 0;
            transition: all 0.3s ease;
        }
        
        .admin-toast.show {
            transform: translateY(0);
            opacity: 1;
        }
        
        .admin-toast-content {
            background-color: var(--card-bg);
            color: var(--text-primary);
            padding: 15px 20px;
            border-radius: var(--border-radius);
            box-shadow: var(--box-shadow);
            display: flex;
            align-items: center;
            border-left: 4px solid var(--primary-color);
        }
        
        .admin-toast-content.success {
            border-color: #4caf50;
        }
        
        .admin-toast-content.error {
            border-color: #f44336;
        }
        
        .admin-toast-content i {
            margin-right: 10px;
            font-size: 1.2rem;
        }
        
        .admin-toast-content.success i {
            color: #4caf50;
        }
        
        .admin-toast-content.error i {
            color: #f44336;
        }
    `;
    document.head.appendChild(toastStyle);
    
    // Export utilities
    window.adminUtils = {
        API_URL,
        checkAuth,
        getAuthHeaders,
        handleApiError,
        formatDate,
        showToast,
        toggleModal,
        fetchWithAuth,
        debounce,
        escapeHtml,
        redirectToLogin
    };
    
    // Make functions globally available
    window.showToast = showToast;
    window.toggleModal = toggleModal;
    window.fetchWithAuth = fetchWithAuth;
    window.debounce = debounce;
    window.escapeHtml = escapeHtml;
    
    // Check auth on page load
    checkAuth();
});