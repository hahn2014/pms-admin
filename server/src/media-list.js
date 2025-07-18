document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOMContentLoaded fired for media-list');
    if (sessionStorage.getItem('isLoggedIn') !== 'true' || !sessionStorage.getItem('sessionToken')) {
        console.log('[DEBUG] Session invalid, redirecting to index.html');
        window.location.href = 'index.html';
        return;
    }
    loadMediaList();
    setupScrollListener();
    setupReturnToTop();
    updateTabIndicator();

    // Update tab indicator on window resize
    window.addEventListener('resize', updateTabIndicator);
});

let mediaData = { movies: [], tv_shows: [], songs: [] };
let displayedRows = { movies: 0, tv_shows: 0, songs: 0 };
const ROWS_PER_PAGE = 100;
let currentTab = 'movies';
let isLoading = false;

// Debounce function to limit scroll event frequency
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

async function loadMediaList() {
    try {
        console.log('[DEBUG] Checking session with /api/check-session');
        const sessionResponse = await fetch('/api/check-session', {
            headers: { 'X-Session-Token': sessionStorage.getItem('sessionToken') || '' }
        });
        if (!sessionResponse.ok) {
            console.error('[DEBUG] Session check failed with status:', sessionResponse.status);
            sessionStorage.clear();
            window.location.href = 'index.html';
            return;
        }

        console.log('[DEBUG] Fetching media list from /api/media-list');
        const response = await fetch('/api/media-list', {
            headers: { 'X-Session-Token': sessionStorage.getItem('sessionToken') || '' }
        });
        if (!response.ok) {
            if (response.status === 401) {
                console.error('[DEBUG] Unauthorized access to media list API');
                sessionStorage.clear();
                window.location.href = 'index.html';
                return;
            }
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch media list');
        }

        const { media } = await response.json();
        mediaData = {
            movies: media.filter(item => item.type === 'movie'),
            tv_shows: media.filter(item => item.type === 'tv_show'),
            songs: media.filter(item => item.type === 'song')
        };

        displayedRows = { movies: 0, tv_shows: 0, songs: 0 };
        updateTable(currentTab);
        // Ensure page starts at the top after initial load
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'instant' });
            console.log('[DEBUG] Scrolled to top after initial load');
        }, 0);
        console.log('[DEBUG] Media list loaded successfully');
        console.log(`[DEBUG] Loaded media: ${mediaData.movies.length} movies, ${mediaData.tv_shows.length} TV shows, ${mediaData.songs.length} songs`);
    } catch (error) {
        console.error('[DEBUG] Error loading media list:', error);
        const tableBody = document.getElementById(`${currentTab}-table-body`);
        tableBody.innerHTML = `<tr><td colspan="${getColumnCount(currentTab)}" class="warning-message">Error: ${error.message || 'Failed to load media list. Please try again.'}</td></tr>`;
    }
}

async function refreshMediaList() {
    if (sessionStorage.getItem('isLoggedIn') !== 'true' || !sessionStorage.getItem('sessionToken')) {
        window.location.href = 'index.html';
        return;
    }
    const refreshButton = document.getElementById('refresh-media');
    if (!refreshButton) return;
    refreshButton.disabled = true;
    refreshButton.textContent = 'Refreshing...';
    try {
        console.log('[DEBUG] Triggering media list refresh with /api/refresh-media');
        const response = await fetch('/api/refresh-media', {
            method: 'POST',
            headers: { 'X-Session-Token': sessionStorage.getItem('sessionToken') || '' }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to refresh media list');
        }
        console.log('[DEBUG] Media list refreshed successfully');
        alert('Media list refreshed successfully');
        await loadMediaList();
    } catch (error) {
        console.error('[DEBUG] Error refreshing media list:', error);
        alert('Failed to refresh media list: ' + error.message);
    } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = 'Refresh Media List';
    }
}

function updateTable(tab) {
    if (isLoading) {
        console.log(`[DEBUG] Skipping updateTable for ${tab} due to active loading`);
        return;
    }
    isLoading = true;
    const tableBody = document.getElementById(`${tab}-table-body`);
    const data = mediaData[tab];
    if (!data || data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${getColumnCount(tab)}" class="warning-message">No ${tab.replace('_', ' ')} found in the database.</td></tr>`;
        isLoading = false;
        return;
    }

    const start = displayedRows[tab];
    const end = Math.min(start + ROWS_PER_PAGE, data.length);
    console.log(`[DEBUG] Updating ${tab} table: start=${start}, end=${end}, total=${data.length}`);

    // Get the last visible row’s position before adding new rows
    const lastRowIndex = start > 0 ? start - 1 : 0;
    const lastRow = tableBody.children[lastRowIndex];
    const lastRowTop = lastRow ? lastRow.getBoundingClientRect().top + window.scrollY : window.scrollY;

    // Add new rows
    for (let i = start; i < end; i++) {
        const item = data[i];
        const row = document.createElement('tr');
        if (tab === 'movies') {
            row.innerHTML = `
                <td>${item.details.title || 'Unknown'}</td>
                <td>${item.details.release_year || 'Unknown'}</td>
                <td>${item.drive}</td>
                <td>${item.file_path}</td>
                <td>${formatSize(item.size)}</td>
                <td>${item.extension}</td>
            `;
        } else if (tab === 'tv_shows') {
            row.innerHTML = `
                <td>${item.details.show_title || 'Unknown'}</td>
                <td>${item.details.season || 'Unknown'}</td>
                <td>${item.details.episode || 'Unknown'}</td>
                <td>${item.details.episode_title || 'Unknown'}</td>
                <td>${item.details.release_year || 'Unknown'}</td>
                <td>${item.drive}</td>
                <td>${item.file_path}</td>
                <td>${formatSize(item.size)}</td>
                <td>${item.extension}</td>
            `;
        } else if (tab === 'songs') {
            row.innerHTML = `
                <td>${item.details.song_title || 'Unknown'}</td>
                <td>${item.details.artist || 'Unknown'}</td>
                <td>${item.details.album || 'Unknown'}</td>
                <td>${item.details.release_year || 'Unknown'}</td>
                <td>${item.drive}</td>
                <td>${item.file_path}</td>
                <td>${formatSize(item.size)}</td>
                <td>${item.extension}</td>
            `;
        }
        tableBody.appendChild(row);
    }
    displayedRows[tab] = end;

    // Adjust scroll position to keep the last visible row in view
    setTimeout(() => {
        const newLastRow = tableBody.children[lastRowIndex];
        const newLastRowTop = newLastRow ? newLastRow.getBoundingClientRect().top + window.scrollY : window.scrollY;
        const scrollAdjustment = newLastRowTop - lastRowTop;
        if (scrollAdjustment > 0) {
            window.scrollBy({ top: scrollAdjustment, behavior: 'instant' });
            console.log(`[DEBUG] Adjusted scroll position: lastRowIndex=${lastRowIndex}, scrollAdjustment=${scrollAdjustment}, newLastRowTop=${newLastRowTop}, lastRowTop=${lastRowTop}`);
        }
        isLoading = false;
        console.log(`[DEBUG] Updated ${tab} table: ${end - start} rows added, total displayed=${displayedRows[tab]}`);
    }, 100);
}

function switchTab(tab) {
    if (tab === currentTab) return;
    const prevTabPane = document.getElementById(`${currentTab}-tab`);
    const newTabPane = document.getElementById(`${tab}-tab`);
    const prevButton = document.querySelector(`.tab-button[onclick="switchTab('${currentTab}')"]`);
    const newButton = document.querySelector(`.tab-button[onclick="switchTab('${tab}')"]`);

    const tabs = ['movies', 'tv_shows', 'songs'];
    const prevIndex = tabs.indexOf(currentTab);
    const newIndex = tabs.indexOf(tab);
    const direction = newIndex > prevIndex ? 'slide-right' : 'slide-left';

    prevTabPane.classList.add(direction);
    setTimeout(() => {
        prevTabPane.classList.remove('active', direction);
        prevButton.classList.remove('active');

        newTabPane.classList.add('active', direction === 'slide-right' ? 'slide-left' : 'slide-right');
        newButton.classList.add('active');
        setTimeout(() => {
            newTabPane.classList.remove(direction === 'slide-right' ? 'slide-left' : 'slide-right');
            updateTable(tab);
            currentTab = tab;
            updateTabIndicator();
            // Ensure scroll to top after tab switch
            window.scrollTo({ top: 0, behavior: 'instant' });
            console.log('[DEBUG] Scrolled to top after tab switch');
        }, 500);
    }, 500);
}

function updateTabIndicator() {
    const activeButton = document.querySelector('.tab-button.active');
    const tabIndicator = document.querySelector('.tab-indicator');
    if (activeButton && tabIndicator) {
        const buttonRect = activeButton.getBoundingClientRect();
        const containerRect = document.querySelector('.tab-buttons').getBoundingClientRect();
        tabIndicator.style.width = `${buttonRect.width}px`;
        tabIndicator.style.left = `${buttonRect.left - containerRect.left}px`;
    }
}

function setupScrollListener() {
    const debouncedScroll = debounce(() => {
        const scrollBottom = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
        console.log(`[DEBUG] Scroll event: scrollY=${window.scrollY}, innerHeight=${window.innerHeight}, scrollHeight=${document.documentElement.scrollHeight}, scrollBottom=${scrollBottom}`);

        if (scrollBottom < 200 && displayedRows[currentTab] < mediaData[currentTab].length && !isLoading) {
            console.log(`[DEBUG] Triggering load for ${currentTab}: displayed=${displayedRows[currentTab]}, total=${mediaData[currentTab].length}`);
            updateTable(currentTab);
        }

        const returnToTop = document.getElementById('return-to-top');
        if (window.scrollY > 200) {
            returnToTop.classList.remove('hidden');
        } else {
            returnToTop.classList.add('hidden');
        }
    }, 200);

    window.addEventListener('scroll', debouncedScroll);
}

function setupReturnToTop() {
    const returnToTop = document.getElementById('return-to-top');
    returnToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        returnToTop.classList.add('hidden');
    });
}

function getColumnCount(tab) {
    return tab === 'movies' ? 6 : tab === 'tv_shows' ? 9 : 8;
}

function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}