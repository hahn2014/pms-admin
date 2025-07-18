let charts = {}; // Store chart instances to prevent reinitialization

async function fetchStats() {
    // Get the session token from sessionStorage
    const sessionToken = sessionStorage.getItem('sessionToken');

    // Check if the token exists
    if (!sessionToken) {
        console.error('No session token found. Please log in.');
        // Redirect to login page if no token
        window.location.href = 'index.html';
        return;
    }

    // Make the fetch request with the session token in the headers
    const response = await fetch('/api/stats', {
        headers: {
            'X-Session-Token': sessionToken
        }
    });

    // Check if the request was successful
    if (!response.ok) {
        if (response.status === 401) {
            console.error('Unauthorized: Invalid or expired session token.');
            // Clear session and redirect to login
            sessionStorage.clear();
            window.location.href = 'index.html';
        } else {
            console.error(`Error fetching stats: ${response.statusText}`);
        }
        return;
    }

    // Parse and process the data
    const data = await response.json();

    // Common chart options
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            datalabels: {
                color: '#000',
                anchor: 'end',
                align: 'start',
                formatter: (value) => value
            },
            title: {
                display: true,
                font: { size: 16 },
                padding: { top: 10, bottom: 10 }
            }
        }
    };

    // Helper function to create or update charts
    function createChart(canvasId, config) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas with ID ${canvasId} not found`);
            return;
        }
        // Destroy existing chart if it exists
        if (charts[canvasId]) {
            charts[canvasId].destroy();
        }
        charts[canvasId] = new Chart(canvas.getContext('2d'), config);
    }

    // Storage Sizes Chart
    createChart('storageChart', {
        type: 'bar',
        data: {
            labels: data.drives.map(d => d.name),
            datasets: [{
                label: 'Storage Used (GiB)',
                data: data.drives.map(d => d.totalSize),
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                title: { ...commonOptions.plugins.title, text: 'Storage Used by Drive (GiB)' }
            }
        }
    });

    // Media Type Chart (stacked bar)
    createChart('mediaTypeChart', {
        type: 'bar',
        data: {
            labels: data.drives.map(d => d.name),
            datasets: [
                {
                    label: 'Movies',
                    data: data.drives.map(d => d.movies),
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                },
                {
                    label: 'TV Shows',
                    data: data.drives.map(d => d.tvShows),
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                title: { ...commonOptions.plugins.title, text: 'Media Types by Drive (Movies & TV Shows)' }
            }
        }
    });

    // Total Files Chart
    createChart('totalFilesChart', {
        type: 'bar',
        data: {
            labels: data.drives.map(d => d.name),
            datasets: [{
                label: 'Total Files',
                data: data.drives.map(d => d.totalFiles),
                backgroundColor: 'rgba(153, 102, 255, 0.2)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1
            }]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                title: { ...commonOptions.plugins.title, text: 'Total Files by Drive' }
            }
        }
    });

    // Free Space Chart (with logarithmic scale)
    createChart('freeSpaceChart', {
        type: 'bar',
        data: {
            labels: data.drives.map(d => d.name),
            datasets: [{
                label: 'Free Space (GiB)',
                data: data.drives.map(d => d.freeSpace === 0 ? 0.01 : d.freeSpace), // Add small offset for zero values
                backgroundColor: data.drives.map(d => d.freeSpace === 0 ? 'rgba(255, 0, 0, 0.5)' : 'rgba(255, 159, 64, 0.2)'), // Red for out-of-space drives
                borderColor: data.drives.map(d => d.freeSpace === 0 ? 'rgba(255, 0, 0, 1)' : 'rgba(255, 159, 64, 1)'),
                borderWidth: 1
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                y: {
                    type: 'logarithmic',
                    min: 0.1, // Ensure zero-like values are visible
                    max: Math.max(...data.drives.map(d => d.freeSpace === 0 ? 0.1 : d.freeSpace)) * 1.5, // Extend max for visibility
                    ticks: {
                        callback: function(value) {
                            return value === 0.1 ? '0' : value.toFixed(2);
                        }
                    }
                }
            },
            plugins: {
                ...commonOptions.plugins,
                title: { ...commonOptions.plugins.title, text: 'Free Space by Drive (GiB)' }
            }
        }
    });

    // Populate raw data table
    const table = document.querySelector('#tableView table');
    table.innerHTML = `<tr><th>Drive</th><th>Movies</th><th>TV Shows</th><th>Total Files</th><th>Free Space</th></tr>`;
    data.drives.forEach(drive => {
        table.innerHTML += `<tr><td>${drive.name}</td><td>${drive.movies}</td><td>${drive.tvShows}</td><td>${drive.totalFiles}</td><td>${drive.freeSpace.toFixed(2)} GiB</td></tr>`;
    });
}

document.getElementById('toggleView').addEventListener('click', () => {
    const headerText = document.getElementById('headertxt');
    const rawData = document.getElementById('tableView');
    const barGraph = document.getElementById('graphView');
    const button = document.getElementById('toggleView');
    if (rawData.classList.contains('hidden')) {
        rawData.classList.remove('hidden');
        barGraph.classList.add('hidden');
        button.textContent = 'Switch to Bar Graph';
        headerText.textContent = 'Media and Storage Analytics - Raw Data';
    } else {
        rawData.classList.add('hidden');
        barGraph.classList.remove('hidden');
        button.textContent = 'Switch to Raw Data';
        headerText.textContent = 'Media and Storage Analytics - Bar Graph Data';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    fetchStats();
}, { once: true });