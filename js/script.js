document.addEventListener('DOMContentLoaded', function() {
    // Theme Toggle - Check for saved theme before any other operations
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Create theme toggle button
    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.innerHTML = savedTheme === 'light' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    themeToggle.setAttribute('aria-label', 'Toggle theme');
    themeToggle.setAttribute('title', savedTheme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
    document.body.appendChild(themeToggle);
    
    // Handle theme toggle
    themeToggle.addEventListener('click', function() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        // Update icon and title
        this.innerHTML = newTheme === 'light' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
        this.setAttribute('title', newTheme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
        
        // Apply theme
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Show toast notification
        showToast(
            newTheme === 'light' ? 'Light Theme Activated' : 'Dark Theme Activated', 
            `You've switched to ${newTheme} mode.`, 
            'info'
        );
    });

    // Add loading animation
    const loader = document.createElement('div');
    loader.className = 'loader';
    loader.innerHTML = `
        <div class="loader-content">
            <img src="/logo.png" alt="Shiva Fabrications Logo" class="loader-logo">
            <div class="loader-spinner"></div>
            <div class="loader-text">LOADING</div>
        </div>
    `;
    document.body.appendChild(loader);

    // Hide loader after page is loaded
    window.addEventListener('load', function() {
        setTimeout(function() {
            loader.classList.add('hidden');
            setTimeout(function() {
                loader.remove();
            }, 500);
        }, 1000);
    });

    // Header scroll effect
    const header = document.querySelector('header');
    
    function handleScroll() {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }
    
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Call on load

    // Mobile Navigation Toggle
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const body = document.body;

    if (hamburger) {
        // Add close button to mobile nav
        const closeBtn = document.createElement('button');
        closeBtn.className = 'mobile-nav-close';
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.setAttribute('aria-label', 'Close menu');
        
        // Only add the close button if it doesn't already exist
        if (!navLinks.querySelector('.mobile-nav-close')) {
            navLinks.insertBefore(closeBtn, navLinks.firstChild);
        }
        
        // Handle hamburger click
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
            body.classList.toggle('no-scroll');
            
            // If sidebar is opening, add overlay
            if (navLinks.classList.contains('active')) {
                const overlay = document.createElement('div');
                overlay.className = 'mobile-nav-overlay';
                document.body.appendChild(overlay);
                
                // Close menu when clicking on overlay
                overlay.addEventListener('click', closeMobileMenu);
            } else {
                // Remove overlay when closing
                const overlay = document.querySelector('.mobile-nav-overlay');
                if (overlay) overlay.remove();
            }
        });
        
        // Close button functionality
        closeBtn.addEventListener('click', closeMobileMenu);
    }
    
    // Close mobile nav when clicking on a nav link
    const navItems = document.querySelectorAll('.nav-links a');
    navItems.forEach(item => {
        item.addEventListener('click', closeMobileMenu);
    });
    
    // Function to close mobile menu
    function closeMobileMenu() {
        const hamburger = document.querySelector('.hamburger');
        const navLinks = document.querySelector('.nav-links');
        const body = document.body;
        const overlay = document.querySelector('.mobile-nav-overlay');
        
        if (hamburger && hamburger.classList.contains('active')) {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
            body.classList.remove('no-scroll');
            
            // Remove overlay
            if (overlay) overlay.remove();
        }
    }

    // Project Filtering
    const filterBtns = document.querySelectorAll('.filter-btn');
    const projectItems = document.querySelectorAll('.project-item');

    if (filterBtns.length > 0) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                // Remove active class from all buttons
                filterBtns.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked button
                this.classList.add('active');
                
                const filterValue = this.getAttribute('data-filter');
                
                projectItems.forEach(item => {
                    if (filterValue === 'all' || item.getAttribute('data-category') === filterValue) {
                        item.style.display = 'block';
                        setTimeout(() => {
                            item.style.opacity = '1';
                            item.style.transform = 'translateY(0)';
                        }, 100);
                    } else {
                        item.style.opacity = '0';
                        item.style.transform = 'translateY(20px)';
                        setTimeout(() => {
                            item.style.display = 'none';
                        }, 300);
                    }
                });
            });
        });
    }

    // FAQ Accordion
    const faqItems = document.querySelectorAll('.faq-item');
    
    if (faqItems.length > 0) {
        faqItems.forEach(item => {
            const question = item.querySelector('.faq-question');
            
            question.addEventListener('click', function() {
                // Toggle active class for current item
                item.classList.toggle('active');
                
                // Close other items
                faqItems.forEach(otherItem => {
                    if (otherItem !== item) {
                        otherItem.classList.remove('active');
                    }
                });
            });
        });
    }

    // Form Submission Handling
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Show loading state
            const submitButton = contactForm.querySelector('button[type="submit"]');
            const originalText = submitButton.innerHTML;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            submitButton.disabled = true;
            
            // Simulate form submission delay
            setTimeout(function() {
                // Reset button
                submitButton.innerHTML = originalText;
                submitButton.disabled = false;
                
                // Show success toast
                showToast('Success!', 'Your message has been sent successfully. We will get back to you soon.', 'success');
                
                // Reset form
                contactForm.reset();
                
                // Uncomment below to show Google Form instead
                // contactForm.style.display = 'none';
                // document.querySelector('.google-form-embed').style.display = 'block';
            }, 2000);
        });
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId !== '#') {
                e.preventDefault();
                
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    const headerHeight = document.querySelector('header').offsetHeight;
                    const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // Scroll to top button
    const scrollToTopBtn = document.createElement('button');
    scrollToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    scrollToTopBtn.className = 'scroll-to-top';
    document.body.appendChild(scrollToTopBtn);

    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            scrollToTopBtn.classList.add('show');
        } else {
            scrollToTopBtn.classList.remove('show');
        }
    });

    scrollToTopBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // Initialize lightgallery if present
    if (typeof lightGallery === 'function' && document.getElementById('lightgallery')) {
        lightGallery(document.getElementById('lightgallery'), {
            speed: 500,
            download: false
        });
    }

    // Add animation on scroll
    const animateElements = document.querySelectorAll('.service-card, .project-card, .feature-card, .stat-item, .workforce-card, .benefit-card, .contact-card');
    
    function checkIfInView() {
        const windowHeight = window.innerHeight;
        const windowTopPosition = window.scrollY;
        const windowBottomPosition = (windowTopPosition + windowHeight);
        
        animateElements.forEach(function(element) {
            const elementHeight = element.offsetHeight;
            const elementTopPosition = element.getBoundingClientRect().top + windowTopPosition;
            const elementBottomPosition = (elementTopPosition + elementHeight);
            
            // Check if element is in view
            if ((elementBottomPosition >= windowTopPosition) && 
                (elementTopPosition <= windowBottomPosition)) {
                element.classList.add('animate');
            }
        });
    }
    
    window.addEventListener('scroll', checkIfInView);
    window.addEventListener('resize', checkIfInView);
    checkIfInView();

    // Toast notification function
    function showToast(title, message, type = 'info') {
        // Remove any existing toasts
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => toast.remove());
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'toast';
        
        // Set icon based on type
        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'exclamation-circle';
        if (type === 'warning') icon = 'exclamation-triangle';
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas fa-${icon}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <div class="toast-close">
                <i class="fas fa-times"></i>
            </div>
        `;
        
        // Add to body
        document.body.appendChild(toast);
        
        // Show toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        // Close toast when clicking close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        });
        
        // Auto-close after 5 seconds
        setTimeout(() => {
            if (document.body.contains(toast)) {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (document.body.contains(toast)) {
                        toast.remove();
                    }
                }, 300);
            }
        }, 5000);
    }

    // Add animation classes to elements for scroll effects
    const addAnimationStyles = document.createElement('style');
    addAnimationStyles.innerHTML = `
        .service-card, .project-card, .feature-card, .stat-item, .workforce-card, .benefit-card, .contact-card {
            opacity: 0;
            transform: translateY(30px);
            transition: opacity 0.6s ease, transform 0.6s ease;
        }
        
        .service-card.animate, .project-card.animate, .feature-card.animate, .stat-item.animate, .workforce-card.animate, .benefit-card.animate, .contact-card.animate {
            opacity: 1;
            transform: translateY(0);
        }
        
        .service-card:nth-child(2), .project-card:nth-child(2), .feature-card:nth-child(2), .stat-item:nth-child(2), .workforce-card:nth-child(2), .benefit-card:nth-child(2), .contact-card:nth-child(2) {
            transition-delay: 0.2s;
        }
        
        .service-card:nth-child(3), .project-card:nth-child(3), .feature-card:nth-child(3), .stat-item:nth-child(3), .workforce-card:nth-child(3), .benefit-card:nth-child(3), .contact-card:nth-child(3) {
            transition-delay: 0.4s;
        }
        
        .service-card:nth-child(4), .project-card:nth-child(4), .feature-card:nth-child(4), .stat-item:nth-child(4), .workforce-card:nth-child(4), .benefit-card:nth-child(4), .contact-card:nth-child(4) {
            transition-delay: 0.6s;
        }
    `;
    document.head.appendChild(addAnimationStyles);
});