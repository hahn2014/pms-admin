/**
 * Fetches the application version from the server.
 * @returns {Promise<string|null>} The version number, or null if the fetch fails.
 */
async function fetchVersion() {
    console.log('[DEBUG] Fetching version number from /api/version');
    try {
        const response = await fetch('/api/version', {
            headers: {
                'X-Session-Token': sessionStorage.getItem('sessionToken') || ''
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                console.error('[DEBUG] Unauthorized access to /api/version');
                sessionStorage.clear();
                window.location.href = 'index.html';
                return null;
            }
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch version number');
        }
        const { version } = await response.json();
        console.log(`[DEBUG] Version number retrieved: ${version}`);
        return version;
    } catch (error) {
        console.error('[DEBUG] Error fetching version number:', error.message);
        return null;
    }
}

/**
 * Updates the version number in the UI.
 * @param {string} version - The version number to display.
 */
function updateVersionInUI(version) {
    const devLine = document.getElementById('dev-line');
    if (devLine) {
        devLine.textContent = `Developed by HahnSolo. v${version || 'N/A'} update July 2025`;
        console.log(`[DEBUG] Updated dev-line with version: ${version || 'N/A'}`);
    } else {
        console.error('[DEBUG] Element with id "dev-line" not found');
    }
}

async function initialize() {
    const version = await fetchVersion();
    console.log(`[DEBUG] Version number: ${version || 'N/A'}`);
    updateVersionInUI(version);
}

initialize();
