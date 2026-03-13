// Constants
const API_BASE_URL = 'http://127.0.0.1:5000/api';

// Initialize Charts
let threatChart = null;

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    
    // Refresh button event listener
    document.getElementById('refresh-btn').addEventListener('click', () => {
        refreshData();
    });
    
    // Auto-refresh every 30 seconds
    setInterval(refreshData, 30000);
});

async function initDashboard() {
    await fetchStats();
    await fetchLogs();
    await fetchAlerts();
    initThreatChart();
}

async function refreshData() {
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
    refreshBtn.disabled = true;
    
    try {
        await Promise.all([
            fetchStats(),
            fetchLogs(),
            fetchAlerts()
        ]);
        
        // Update chart with some dummy movement for realism
        updateChartData();
        
    } catch (error) {
        console.error('Error refreshing data:', error);
    } finally {
        setTimeout(() => {
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Logs';
            refreshBtn.disabled = false;
        }, 500);
    }
}

async function fetchStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/stats`);
        const data = await response.json();
        
        document.getElementById('total-events').textContent = data.total_events.toLocaleString();
        document.getElementById('critical-alerts').textContent = data.critical_alerts.toLocaleString();
        document.getElementById('active-threats').textContent = data.active_threats.toLocaleString();
        document.getElementById('resolved-threats').textContent = data.resolved_threats.toLocaleString();
    } catch (error) {
        console.error('Failed to fetch stats:', error);
    }
}

async function fetchLogs() {
    try {
        const response = await fetch(`${API_BASE_URL}/logs`);
        const data = await response.json();
        
        renderLogsTable(data);
    } catch (error) {
        console.error('Failed to fetch logs:', error);
    }
}

async function fetchAlerts() {
    try {
        const response = await fetch(`${API_BASE_URL}/alerts`);
        const data = await response.json();
        
        renderAlertsList(data);
    } catch (error) {
        console.error('Failed to fetch alerts:', error);
    }
}

function renderLogsTable(logs) {
    const tableBody = document.getElementById('logs-table-body');
    tableBody.innerHTML = '';
    
    if (logs.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted)">No logs available</td></tr>';
        return;
    }
    
    logs.forEach(log => {
        const tr = document.createElement('tr');
        
        // Format time
        const time = new Date(log.timestamp).toLocaleTimeString();
        
        // Get severity class
        const severityClass = `severity-${log.severity}`;
        
        // Get status class
        const statusClass = `status-${log.status}`;
        
        tr.innerHTML = `
            <td class="monospaced">#${log.id}</td>
            <td>${time}</td>
            <td class="monospaced">${log.source_ip}</td>
            <td class="monospaced">${log.destination_ip}</td>
            <td>${log.event_type}</td>
            <td><span class="severity-badge ${severityClass}">${log.severity}</span></td>
            <td class="${statusClass}" style="text-transform: capitalize; font-weight: 600;">${log.status}</td>
        `;
        
        tableBody.appendChild(tr);
    });
}

function renderAlertsList(alerts) {
    const alertsContainer = document.getElementById('alerts-container');
    alertsContainer.innerHTML = '';
    
    if (alerts.length === 0) {
        alertsContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No high or critical alerts</div>';
        return;
    }
    
    // Sort by timestamp descending
    alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    alerts.slice(0, 10).forEach(alert => {
        const item = document.createElement('div');
        item.className = `alert-item ${alert.severity}`;
        
        const time = new Date(alert.timestamp).toLocaleTimeString();
        
        item.innerHTML = `
            <div class="alert-header">
                <div class="alert-title">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${alert.event_type}
                </div>
                <div class="alert-time">${time}</div>
            </div>
            <div class="alert-details">
                <strong>Source:</strong> <span class="monospaced">${alert.source_ip}</span> -> 
                <strong>Target:</strong> <span class="monospaced">${alert.destination_ip}</span>
                <br>
                ${alert.description || ''}
            </div>
            <div class="alert-actions">
                <button class="btn-small danger" onclick="blockIP('${alert.source_ip}')">
                    <i class="fas fa-ban"></i> Block IP
                </button>
            </div>
        `;
        
        alertsContainer.appendChild(item);
    });
}

async function blockIP(ip) {
    if (!confirm(`Are you sure you want to block IP address ${ip}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/block-ip`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ip: ip })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`Successfully blocked IP: ${ip}`);
            // Force refresh to update stats/logs
            refreshData();
        } else {
            alert(`Failed to block IP: ${result.message}`);
        }
    } catch (error) {
        console.error('Error blocking IP:', error);
        alert('An error occurred while communicating with the server.');
    }
}

function initThreatChart() {
    const ctx = document.getElementById('threatChart').getContext('2d');
    
    // Gradient for the chart
    const gradientArea = ctx.createLinearGradient(0, 0, 0, 400);
    gradientArea.addColorStop(0, 'rgba(0, 229, 255, 0.5)');
    gradientArea.addColorStop(1, 'rgba(0, 229, 255, 0.0)');
    
    const gradientArea2 = ctx.createLinearGradient(0, 0, 0, 400);
    gradientArea2.addColorStop(0, 'rgba(255, 0, 200, 0.5)');
    gradientArea2.addColorStop(1, 'rgba(255, 0, 200, 0.0)');

    // Generate times for labels
    const labels = [];
    let now = new Date();
    for (let i = 11; i >= 0; i--) {
        let t = new Date(now.getTime() - i * 5 * 60000);
        labels.push(`${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`);
    }

    threatChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Network Traffic (Mbs)',
                    data: [120, 132, 110, 150, 240, 210, 180, 260, 210, 190, 220, 180],
                    borderColor: '#00e5ff',
                    backgroundColor: gradientArea,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#0f001a',
                    pointBorderColor: '#00e5ff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Threat Alerts',
                    data: [5, 12, 8, 45, 18, 10, 5, 8, 15, 25, 12, 5],
                    borderColor: '#ff00c8',
                    backgroundColor: gradientArea2,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#0f001a',
                    pointBorderColor: '#ff00c8',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#e0e0e0',
                        font: {
                            family: 'Rajdhani',
                            size: 14
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 0, 26, 0.9)',
                    titleColor: '#00e5ff',
                    bodyColor: '#fff',
                    borderColor: '#bd00ff',
                    borderWidth: 1,
                    padding: 10,
                    titleFont: {
                        family: 'Rajdhani',
                        size: 14
                    },
                    bodyFont: {
                        family: 'Rajdhani',
                        size: 13
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(189, 0, 255, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#9b72cf',
                        font: {
                            family: 'Rajdhani'
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(189, 0, 255, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#9b72cf',
                        font: {
                            family: 'Rajdhani'
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
        }
    });
}

function updateChartData() {
    if (!threatChart) return;
    
    const datasets = threatChart.data.datasets;
    
    // Shift data left
    for (let j = 0; j < datasets.length; j++) {
        const data = datasets[j].data;
        for (let i = 0; i < data.length - 1; i++) {
            data[i] = data[i + 1];
        }
    }
    
    // Add new random point
    datasets[0].data[datasets[0].data.length - 1] = Math.floor(150 + Math.random() * 100);
    datasets[1].data[datasets[1].data.length - 1] = Math.floor(5 + Math.random() * 30);
    
    // Update last label
    const now = new Date();
    threatChart.data.labels.shift();
    threatChart.data.labels.push(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
    
    threatChart.update();
}
