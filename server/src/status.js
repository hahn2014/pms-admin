/**
 * Shows a custom confirmation modal and returns a promise resolving to the user's choice.
 * @param {string} message - The message to display in the modal.
 * @returns {Promise<boolean>} Resolves to true if confirmed, false if canceled.
 */
function showConfirmModal(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const modalMessage = document.getElementById('confirm-message');
        const confirmButton = document.getElementById('confirm-yes');
        const cancelButton = document.getElementById('confirm-no');

        modalMessage.textContent = message;
        modal.classList.remove('hidden');

        const closeModal = (result) => {
            modal.classList.add('hidden');
            confirmButton.removeEventListener('click', confirmHandler);
            cancelButton.removeEventListener('click', cancelHandler);
            resolve(result);
        };

        const confirmHandler = () => closeModal(true);
        const cancelHandler = () => closeModal(false);

        confirmButton.addEventListener('click', confirmHandler, { once: true });
        cancelButton.addEventListener('click', cancelHandler, { once: true });
    });
}

/**
 * Fetches and displays the status of NAS services and drives with visual indicators.
 */
async function fetchServiceStatuses() {
    // Maintain a set of items to skip until page refresh
    const skippedItems = new Set();

    try {
        const response = await fetch('/api/service-status', {
            headers: { 'X-Session-Token': sessionStorage.getItem('sessionToken') || '' }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch service statuses');
        }
        const data = await response.json();
        const { services, drives, noDrivesFound } = data;

        // Update UI for services
        const serviceElements = {
            'plexmediaserver': {
                status: document.getElementById('plex-status'),
                error: document.getElementById('plex-error')
            },
            'tautulli': {
                status: document.getElementById('tautulli-status'),
                error: document.getElementById('tautulli-error')
            },
            'overseer': {
                status: document.getElementById('overseer-status'),
                error: document.getElementById('overseer-error')
            },
            'cloudflared': {
                status: document.getElementById('cloudflared-status'),
                error: document.getElementById('cloudflared-error')
            }
        };

        for (const [service, status] of Object.entries(services)) {
            const elements = serviceElements[service];
            if (elements) {
                elements.error.textContent = '';
                elements.error.classList.add('hidden');

                if (status === 'not-installed' || status === 'timeout') {
                    elements.status.textContent = '';
                    elements.error.textContent = status === 'not-installed'
                        ? `${service} is not installed`
                        : `${service} check timed out`;
                    elements.error.classList.remove('hidden');
                    const restartButton = document.getElementById(`${service}-restart`);
                    if (restartButton) {
                        restartButton.disabled = true;
                        restartButton.style.opacity = '0.5';
                    }
                    skippedItems.add(`service:${service}`);
                } else {
                    elements.status.textContent = `Status: ${status}`;
                    elements.status.className = 'status-text';
                    elements.status.classList.add(
                        status === 'active' ? 'status-active' :
                            status === 'inactive' ? 'status-inactive' : 'status-failed'
                    );
                }
            }
        }

        // Update UI for drives
        const container = document.getElementById('drive-status-container');
        if (noDrivesFound) {
            container.innerHTML = '<p class="error-message">No disks found. Please check the MONITORED_DRIVES variable in the .env file.</p>';
            clearInterval(window.statusInterval); // Stop periodic checks if no drives
            return;
        }

        const driveElements = {};
        drives && Object.keys(drives).forEach(drive => {
            driveElements[drive] = {
                status: document.getElementById(`drive-${drive.replace(/[^a-zA-Z0-9]/g, '-')}-status`),
                error: document.getElementById(`drive-${drive.replace(/[^a-zA-Z0-9]/g, '-')}-error`)
            };
        });

        for (const [drive, status] of Object.entries(drives || {})) {
            const elements = driveElements[drive];
            if (elements) {
                elements.error.textContent = '';
                elements.error.classList.add('hidden');

                if (status === 'not-found' || status === 'timeout') {
                    elements.status.textContent = '';
                    elements.error.textContent = status === 'not-found'
                        ? `Drive ${drive} not found`
                        : `Drive ${drive} check timed out`;
                    elements.error.classList.remove('hidden');
                    skippedItems.add(`drive:${drive}`);
                } else {
                    elements.status.textContent = `Status: ${status}`;
                    elements.status.className = 'status-text';
                    elements.status.classList.add(
                        status === 'mounted' ? 'status-active' : 'status-failed'
                    );
                }
            }
        }

        // Update interval to skip failed items
        clearInterval(window.statusInterval);
        window.statusInterval = setInterval(() => {
            const activeItems = [
                ...Object.keys(services).map(s => `service:${s}`),
                ...Object.keys(drives || {}).map(d => `drive:${d}`)
            ].filter(item => !skippedItems.has(item));
            if (activeItems.length > 0) {
                fetchActiveServiceStatuses(activeItems);
            }
        }, 30000);
    } catch (error) {
        console.error('Error fetching service statuses:', error);
        alert('Failed to fetch service statuses: ' + error.message);
    }
}

/**
 * Fetches statuses for active services and drives only.
 * @param {string[]} activeItems - Array of item identifiers (service: or drive: prefix).
 */
async function fetchActiveServiceStatuses(activeItems) {
    try {
        const response = await fetch('/api/service-status', {
            headers: { 'X-Session-Token': sessionStorage.getItem('sessionToken') || '' }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch service statuses');
        }
        const data = await response.json();
        const { services, drives, noDrivesFound } = data;

        if (noDrivesFound) {
            return; // No need to update drives if none are found
        }

        const serviceElements = {
            'plexmediaserver': {
                status: document.getElementById('plex-status'),
                error: document.getElementById('plex-error')
            },
            'tautulli': {
                status: document.getElementById('tautulli-status'),
                error: document.getElementById('tautulli-error')
            },
            'overseer': {
                status: document.getElementById('overseer-status'),
                error: document.getElementById('overseer-error')
            },
            'cloudflared': {
                status: document.getElementById('cloudflared-status'),
                error: document.getElementById('cloudflared-error')
            }
        };

        const driveElements = {};
        drives && Object.keys(drives).forEach(drive => {
            driveElements[drive] = {
                status: document.getElementById(`drive-${drive.replace(/[^a-zA-Z0-9]/g, '-')}-status`),
                error: document.getElementById(`drive-${drive.replace(/[^a-zA-Z0-9]/g, '-')}-error`)
            };
        });

        for (const item of activeItems) {
            const [type, name] = item.split(':');
            const elements = type === 'service' ? serviceElements[name] : driveElements[name];
            const status = type === 'service' ? services[name] : drives[name];
            if (elements && status) {
                elements.error.textContent = '';
                elements.error.classList.add('hidden');
                elements.status.textContent = `Status: ${status}`;
                elements.status.className = 'status-text';
                elements.status.classList.add(
                    status === 'active' || status === 'mounted' ? 'status-active' :
                        status === 'inactive' ? 'status-inactive' : 'status-failed'
                );
            }
        }
    } catch (error) {
        console.error('Error fetching active service statuses:', error);
    }
}

/**
 * Restarts a specified service.
 * @param {string} service - The name of the service to restart.
 */
async function restartService(service) {
    const confirmed = await showConfirmModal(`Are you sure you want to restart the ${service} service?`);
    if (!confirmed) {
        return;
    }
    try {
        const response = await fetch('/api/restart-service', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionStorage.getItem('sessionToken') || ''
            },
            body: JSON.stringify({ service })
        });
        if (!response.ok) {
            throw new Error('Failed to restart service');
        }
        const data = await response.json();
        alert(data.message);
        await fetchServiceStatuses(); // Refresh statuses after restart
    } catch (error) {
        console.error(`Error restarting ${service}:`, error);
        alert(`Failed to restart ${service}: ${error.message}`);
    }
}

/**
 * Initiates a NAS server reboot with confirmation.
 */
async function rebootServer() {
    const confirmed = await showConfirmModal('Are you sure you want to reboot the NAS server? This will disconnect all users.');
    if (!confirmed) {
        return;
    }
    try {
        const response = await fetch('/api/reboot', {
            method: 'POST',
            headers: { 'X-Session-Token': sessionStorage.getItem('sessionToken') || '' }
        });
        if (!response.ok) {
            throw new Error('Failed to initiate reboot');
        }
        // The server will redirect to error.html with "Server offline" message
    } catch (error) {
        console.error('Error initiating reboot:', error);
        alert(`Failed to reboot server: ${error.message}`);
    }
}

// Dynamically add drive status elements based on API response
async function initDriveStatuses() {
    try {
        const response = await fetch('/api/service-status', {
            headers: { 'X-Session-Token': sessionStorage.getItem('sessionToken') || '' }
        });
        if (response.ok) {
            const { drives, noDrivesFound } = await response.json();
            const container = document.getElementById('drive-status-container');
            if (noDrivesFound) {
                container.innerHTML = '<p class="error-message">No disks found. Please check the MONITORED_DRIVES variable in the .env file.</p>';
            } else {
                container.innerHTML = ''; // Clear placeholder
                Object.keys(drives).forEach(drive => {
                    const safeDriveId = drive.replace(/[^a-zA-Z0-9]/g, '-');
                    const div = document.createElement('div');
                    div.className = 'grid-item';
                    div.innerHTML = `
                                <h3>Drive ${drive} <span id="drive-${safeDriveId}-status" class="status-text">Status: unknown</span></h3>
                                <p id="drive-${safeDriveId}-error" class="error-message hidden"></p>
                            `;
                    container.appendChild(div);
                });
            }
        }
    } catch (error) {
        console.error('Error initializing drive statuses:', error);
        document.getElementById('drive-status-container').innerHTML = '<p class="error-message">Failed to check drives. Please try again.</p>';
    }
}
//document.addEventListener('DOMContentLoaded', initDriveStatuses);

/**
 * Initializes the status page.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Check session separately
    try {
        const response = await fetch('/api/check-session', {
            headers: { 'X-Session-Token': sessionStorage.getItem('sessionToken') || '' }
        });
        if (!response.ok) {
            sessionStorage.clear();
            window.location.href = 'index.html';
            return;
        }
    } catch (error) {
        console.error('Error checking session:', error);
        sessionStorage.clear();
        window.location.href = 'index.html';
        return;
    }

    // Fetch initial service and drive statuses
    await fetchServiceStatuses();

    // Set up event listeners for restart buttons
    document.getElementById('plex-restart').addEventListener('click', () => restartService('plexmediaserver'));
    document.getElementById('tautulli-restart').addEventListener('click', () => restartService('tautulli'));
    document.getElementById('overseer-restart').addEventListener('click', () => restartService('overseer'));
    document.getElementById('cloudflared-restart').addEventListener('click', () => restartService('cloudflared'));
    document.getElementById('reboot-server').addEventListener('click', rebootServer);
});