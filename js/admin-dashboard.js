document.addEventListener('DOMContentLoaded', function() {
    const { API_URL, getAuthHeaders, handleApiError, formatDate, showToast } = window.adminUtils;
    const statsCards = document.getElementById('statsCards');
    const recentMessages = document.getElementById('recentMessages');
    
    // Load dashboard data
    async function loadDashboardData() {
        try {
            const response = await fetch(`${API_URL}/stats`, {
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            const stats = await response.json();
            
            // Update stats cards
            updateStatsCards(stats);
            
            // Create charts
            createProjectsChart(stats.projects_by_category);
            createRatingChart(stats.average_rating);
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            showToast('Failed to load dashboard data', 'error');
        }
    }
    
    // Load recent messages
    async function loadRecentMessages() {
        try {
            const response = await fetch(`${API_URL}/contact?limit=5`, {
                headers: getAuthHeaders()
            });
            
            await handleApiError(response);
            const messages = await response.json();
            
            // Update recent messages table
            updateRecentMessages(messages);
            
        } catch (error) {
            console.error('Error loading recent messages:', error);
            recentMessages.innerHTML = `<tr><td colspan="5" class="text-center">Failed to load recent messages</td></tr>`;
        }
    }
    
    // Update stats cards
    function updateStatsCards(stats) {
        statsCards.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon blue">
                    <i class="fas fa-project-diagram"></i>
                </div>
                <div class="stat-content">
                    <div class="stat-value">${stats.total_projects}</div>
                    <div class="stat-label">Total Projects</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="stat-content">
                    <div class="stat-value">${stats.active_projects}</div>
                    <div class="stat-label">Active Projects</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon orange">
                    <i class="fas fa-envelope"></i>
                </div>
                <div class="stat-content">
                    <div class="stat-value">${stats.total_messages}</div>
                    <div class="stat-label">Messages</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon red">
                    <i class="fas fa-comments"></i>
                </div>
                <div class="stat-content">
                    <div class="stat-value">${stats.total_feedback}</div>
                    <div class="stat-label">Feedback</div>
                </div>
            </div>
        `;
    }
    
    // Update recent messages table
    function updateRecentMessages(messages) {
        if (messages.length === 0) {
            recentMessages.innerHTML = `<tr><td colspan="5" class="text-center">No messages found</td></tr>`;
            return;
        }
        
        let html = '';
        messages.forEach(message => {
            html += `
                <tr>
                    <td>${message.name}</td>
                    <td>${message.email}</td>
                    <td>${message.subject}</td>
                    <td>${formatDate(message.created_at)}</td>
                    <td>
                        <div class="actions">
                            <a href="messages.html?id=${message._id}" class="action-btn" title="View">
                                <i class="fas fa-eye"></i>
                            </a>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        recentMessages.innerHTML = html;
    }
    
    // Create projects by category chart
    function createProjectsChart(projectsByCategory) {
        const ctx = document.getElementById('projectsChart').getContext('2d');
        
        // Extract data
        const categories = Object.keys(projectsByCategory);
        const counts = Object.values(projectsByCategory);
        
        // Generate colors
        const colors = generateColors(categories.length);
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: categories,
                datasets: [{
                    label: 'Number of Projects',
                    data: counts,
                    backgroundColor: colors,
                    borderColor: colors.map(color => color.replace('0.7', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0,
                            color: '#b0b0b0'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#b0b0b0'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    // Create rating gauge chart
    function createRatingChart(averageRating) {
        const ctx = document.getElementById('ratingChart').getContext('2d');
        
        // Format average rating
        const formattedRating = parseFloat(averageRating).toFixed(1);
        document.getElementById('avgRating').textContent = formattedRating;
        
        // Calculate percentage for gauge
        const percentage = (averageRating / 5) * 100;
        
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Rating', 'Remaining'],
                datasets: [{
                    data: [percentage, 100 - percentage],
                    backgroundColor: [
                        'rgba(0, 198, 255, 0.8)',
                        'rgba(255, 255, 255, 0.05)'
                    ],
                    borderWidth: 0,
                    cutout: '80%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                }
            }
        });
    }
    
    // Generate colors for chart
    function generateColors(count) {
        const colors = [
            'rgba(0, 198, 255, 0.7)',  // Primary
            'rgba(255, 107, 107, 0.7)', // Secondary
            'rgba(76, 175, 80, 0.7)',   // Green
            'rgba(255, 152, 0, 0.7)',   // Orange
            'rgba(156, 39, 176, 0.7)',  // Purple
            'rgba(33, 150, 243, 0.7)'   // Blue
        ];
        
        // If we need more colors than we have, generate them
        if (count > colors.length) {
            for (let i = colors.length; i < count; i++) {
                const r = Math.floor(Math.random() * 255);
                const g = Math.floor(Math.random() * 255);
                const b = Math.floor(Math.random() * 255);
                colors.push(`rgba(${r}, ${g}, ${b}, 0.7)`);
            }
        }
        
        return colors.slice(0, count);
    }
    
    // Initialize dashboard
    function initDashboard() {
        loadDashboardData();
        loadRecentMessages();
    }
    
    initDashboard();
});