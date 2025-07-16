let selectedMovieTitle = null; // Stores the selected movie title for Plex navigation
let tmdbApiKey = null;         // Stores the TMDB API key globally

/**
 * Formats runtime from minutes to a human-readable string (e.g., "1h 30m").
 * @param {number} minutes - The runtime in minutes.
 * @returns {string} The formatted runtime, or 'N/A' if invalid.
 */
function formatRuntime(minutes) {
    if (!minutes || minutes <= 0 || isNaN(minutes)) {
        return 'N/A';
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours > 0 ? `${hours}h ` : ''}${mins}m`;
}

/**
 * Fetches the TMDB API key from the server.
 * @returns {Promise<string|null>} The TMDB API key, or null if the fetch fails.
 */
async function fetchTmdbApiKey() {
    console.log('[DEBUG] Fetching TMDB API key from /api/config');
    try {
        const response = await fetch('/api/config', {
            headers: {
                'X-Session-Token': sessionStorage.getItem('sessionToken') || ''
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                console.error('[DEBUG] Unauthorized access to /api/config');
                sessionStorage.clear();
                window.location.href = 'index.html';
                return null;
            }
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch TMDB API key');
        }

        const { tmdbApiKey: apiKey } = await response.json();
        console.log('[DEBUG] TMDB API key retrieved successfully');
        return apiKey;
    } catch (error) {
        console.error('[DEBUG] Error fetching TMDB API key:', error.message);
        return null;
    }
}

/**
 * Opens the selected movie in the Plex web app using its title.
 */
function openPlexWebApp() {
    if (!selectedMovieTitle) {
        console.error('[DEBUG] No movie title available for Plex navigation');
        alert('No movie selected. Please pick a movie first.');
        return;
    }
    const plexUrl = `https://app.plex.tv/desktop/#!/search?query=${encodeURIComponent(selectedMovieTitle)}`;
    console.log(`[DEBUG] Navigating to Plex URL: ${plexUrl}`);
    window.open(plexUrl, '_blank');
}

/**
 * Picks a random movie, fetches its TMDB details, and updates the UI.
 */
async function pickRandomMovie() {
    if (!tmdbApiKey) {
        tmdbApiKey = await fetchTmdbApiKey();
        if (!tmdbApiKey) {
            console.error('[DEBUG] No TMDB API key available');
            updateUIWithError('Failed to load TMDB API key. Please try again.');
            return;
        }
    }

    console.log('[DEBUG] Fetching movies from /api/movies');
    try {
        const response = await fetch('/api/movies', {
            headers: {
                'X-Session-Token': sessionStorage.getItem('sessionToken') || ''
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                console.error('[DEBUG] Unauthorized access to movies API');
                sessionStorage.clear();
                window.location.href = 'index.html';
                return;
            }
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch movies');
        }

        const { movies } = await response.json();
        if (movies.length === 0) {
            console.log('[DEBUG] No movies found');
            updateUIWithError('No movies found in the database.');
            return;
        }

        const randomIndex = Math.floor(Math.random() * movies.length);
        const movie = movies[randomIndex];
        console.log(`[DEBUG] Selected movie: ${movie.title} (${movie.release_year})`);

        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(movie.title)}&year=${movie.release_year}`;
        console.log(`[DEBUG] TMDB search URL: ${searchUrl}`);
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) {
            throw new Error('Failed to search for movie on TMDB');
        }

        const searchData = await searchResponse.json();
        console.log(`[DEBUG] TMDB search results:`, searchData);
        if (searchData.results.length === 0) {
            console.log('[DEBUG] No matching movie found in TMDB');
            updateUIWithError('Movie not found on TMDB. Please pick another.');
            return;
        }

        const tmdbMovie = searchData.results[0];
        const movieId = tmdbMovie.id;
        console.log(`[DEBUG] Selected TMDB movie ID: ${movieId}`);

        const detailsUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbApiKey}`;
        console.log(`[DEBUG] TMDB details URL: ${detailsUrl}`);
        const detailsResponse = await fetch(detailsUrl);
        if (!detailsResponse.ok) {
            throw new Error('Failed to fetch movie details from TMDB');
        }

        const movieDetails = await detailsResponse.json();
        console.log(`[DEBUG] TMDB movie details:`, movieDetails);
        selectedMovieTitle = movieDetails.title;
        updateUIWithMovieDetails(movieDetails, movieId);
    } catch (error) {
        console.error('[DEBUG] Error picking movie:', error);
        updateUIWithError('Failed to load movie details. Please try again.');
        selectedMovieTitle = null;
    }
}

/**
 * Updates the UI with movie details from TMDB.
 * @param {Object} movieDetails - The movie details object from TMDB.
 * @param {number} movieId - The TMDB movie ID.
 */
function updateUIWithMovieDetails(movieDetails, movieId) {
    const title = movieDetails.title;
    const releaseDate = movieDetails.release_date;
    const year = releaseDate ? releaseDate.split('-')[0] : 'N/A';
    const runtime = movieDetails.runtime;
    const rating = movieDetails.vote_average;
    const synopsis = movieDetails.overview || 'Synopsis not available.';
    const posterPath = movieDetails.poster_path;
    const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : 'https://via.placeholder.com/200x300';

    document.querySelector('.movie-title').textContent = title;
    document.querySelector('.movie-year').textContent = `Year: ${year}`;
    document.querySelector('.movie-poster').src = posterUrl;
    document.querySelector('.movie-synopsis').textContent = synopsis;
    document.querySelector('.movie-runtime').textContent = `Runtime: ${formatRuntime(runtime)}`;
    document.querySelector('.movie-rating').textContent = `Rating: ${rating ? Math.round(rating) + '/10' : 'N/A'}`;
    document.querySelector('.movie-id').innerHTML = `TMDB ID: <a href="https://www.themoviedb.org/movie/${movieId}" target="_blank">${movieId}</a>`;
    console.log(`[DEBUG] Displayed movie: ${title} (${year})`);
}

/**
 * Updates the UI with an error message.
 * @param {string} message - The error message to display.
 */
function updateUIWithError(message) {
    document.querySelector('.movie-title').textContent = 'Error loading movie';
    document.querySelector('.movie-year').textContent = 'Year: N/A';
    document.querySelector('.movie-runtime').textContent = 'Runtime: N/A';
    document.querySelector('.movie-rating').textContent = 'Rating: N/A';
    document.querySelector('.movie-id').textContent = 'TMDB ID: N/A';
    document.querySelector('.movie-synopsis').textContent = message;
}

/**
 * Initializes the page, checks session, and sets up event listeners.
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOMContentLoaded fired for movie-picker');
    if (sessionStorage.getItem('isLoggedIn') !== 'true' || !sessionStorage.getItem('sessionToken')) {
        console.log('[DEBUG] Session invalid, redirecting to index.html');
        window.location.href = 'index.html';
        return;
    }

    const plexButton = document.querySelector('.plex-stream');
    if (plexButton) {
        plexButton.addEventListener('click', openPlexWebApp);
    }

    const pickButton = document.querySelector('.pick-button');
    if (pickButton) {
        pickButton.addEventListener('click', pickRandomMovie);
    }

    pickRandomMovie();
});