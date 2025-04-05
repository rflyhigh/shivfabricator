document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://shivfabricator.onrender.com/api';
    const loginForm = document.getElementById('loginForm');
    const loginError = document.querySelector('.login-error');
    const togglePasswordBtn = document.querySelector('.toggle-password');
    const passwordInput = document.getElementById('password');
    
    // Toggle password visibility
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Toggle icon
            const icon = this.querySelector('i');
            if (type === 'text') {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    }
    
    // Handle form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Hide previous error
            loginError.style.display = 'none';
            
            // Get form data
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            // Show loading state
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
            submitBtn.disabled = true;
            
            try {
                // Send login request
                const response = await fetch(`${API_URL}/token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        'username': email,
                        'password': password
                    })
                });
                
                if (!response.ok) {
                    throw new Error('Login failed');
                }
                
                const data = await response.json();
                
                // Store token in localStorage
                localStorage.setItem('authToken', data.access_token);
                localStorage.setItem('adminEmail', email);
                
                // Redirect to dashboard
                window.location.href = 'index.html';
                
            } catch (error) {
                console.error('Login error:', error);
                
                // Show error message
                loginError.style.display = 'flex';
                
                // Reset button
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }
    
    // Check if user is already logged in
    function checkAuth() {
        const token = localStorage.getItem('authToken');
        if (token) {
            // If on login page, redirect to dashboard
            if (window.location.pathname.includes('login.html')) {
                window.location.href = 'index.html';
            }
        } else {
            // If not on login page, redirect to login
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = 'login.html';
            }
        }
    }
    
    // Check authentication status
    checkAuth();
});