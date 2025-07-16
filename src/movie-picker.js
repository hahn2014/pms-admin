let selectedMovie = null; // Store TMDB movie ID globally
let tmdbApiKey = null; // Store TMDB API key globally

// Function to format runtime from minutes to "Xh Ym" format
function formatRuntime(minutes) {
    if (!minutes || minutes <= 0 || isNaN(minutes)) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours > 0 ? `${hours}h ` : ''}${mins}m`;
}

// Function to fetch TMDB API key from server
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

        const { tmdbApiKey } = await response.json();
        console.log('[DEBUG] TMDB API key retrieved successfully');
        return tmdbApiKey;
    } catch (error) {
        console.error('[DEBUG] Error fetching TMDB API key:', error.message);
        return null;
    }
}

// Function to open Plex web app
function openPlexWebApp() {
    if (!selectedMovie) {
        console.error('[DEBUG] No movie ID available for Plex navigation');
        alert('No movie selected. Please pick a movie first.');
        return;
    }
    // Construct Plex web app URL using TMDB ID for search
    // Note: This assumes the Plex server is configured to allow web access
    const plexUrl = `https://app.plex.tv/desktop/#!/search?query=${encodeURIComponent(selectedMovie)}`;
    console.log(`[DEBUG] Navigating to Plex URL: ${plexUrl}`);
    window.open(plexUrl, '_blank');
}

async function pickRandomMovie() {
    // Fetch TMDB API key if not already loaded
    if (!tmdbApiKey) {
        tmdbApiKey = await fetchTmdbApiKey();
        if (!tmdbApiKey) {
            console.error('[DEBUG] No TMDB API key available');
            document.querySelector('.movie-title').textContent = 'Error loading movie';
            document.querySelector('.movie-year').textContent = 'Year: N/A';
            document.querySelector('.movie-runtime').textContent = 'Runtime: N/A';
            document.querySelector('.movie-rating').textContent = 'Rating: N/A';
            document.querySelector('.movie-id').textContent = 'TMDB ID: N/A';
            document.querySelector('.movie-synopsis').textContent = 'Failed to load TMDB API key. Please try again.';
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
            document.querySelector('.movie-title').textContent = 'No movies found';
            document.querySelector('.movie-year').textContent = 'Year: N/A';
            document.querySelector('.movie-runtime').textContent = 'Runtime: N/A';
            document.querySelector('.movie-rating').textContent = 'Rating: N/A';
            document.querySelector('.movie-id').textContent = 'TMDB ID: N/A';
            document.querySelector('.movie-synopsis').textContent = 'Synopsis not available.';
            return;
        }

        const randomIndex = Math.floor(Math.random() * movies.length);
        const movie = movies[randomIndex];
        console.log(`[DEBUG] Selected movie: ${movie.title} (${movie.release_year})`);

        // Step 1: Search for the movie on TMDB
        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(movie.title)}&year=${movie.release_year}`;
        console.log(`[DEBUG] TMDB search URL: ${searchUrl}`);
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) {
            throw new Error('Failed to search for movie');
        }

        const searchData = await searchResponse.json();
        console.log(`[DEBUG] TMDB search results:`, searchData);
        if (searchData.results.length === 0) {
            console.log('[DEBUG] No matching movie found in TMDB');
            document.querySelector('.movie-title').textContent = 'Movie not found';
            document.querySelector('.movie-year').textContent = 'Year: N/A';
            document.querySelector('.movie-runtime').textContent = 'Runtime: N/A';
            document.querySelector('.movie-rating').textContent = 'Rating: N/A';
            document.querySelector('.movie-id').textContent = 'TMDB ID: N/A';
            document.querySelector('.movie-synopsis').textContent = 'Movie not found. Please pick another movie.';
            return;
        }

        // Take the first result (most likely match due to title and year filter)
        const tmdbMovie = searchData.results[0];
        const selectedMovieId = tmdbMovie.id; // Store TMDB movie ID
        console.log(`[DEBUG] Selected TMDB movie ID: ${selectedMovieId}`);

        // Step 2: Fetch detailed movie metadata
        const detailsUrl = `https://api.themoviedb.org/3/movie/${selectedMovieId}?api_key=${tmdbApiKey}`;
        console.log(`[DEBUG] TMDB details URL: ${detailsUrl}`);
        const detailsResponse = await fetch(detailsUrl);
        if (!detailsResponse.ok) {
            throw new Error('Failed to fetch movie details');
        }

        const movieDetails = await detailsResponse.json();
        console.log(`[DEBUG] TMDB movie details:`, movieDetails);
        selectedMovie = movieDetails.title;
        // Extract metadata
        const title = movieDetails.title;
        const releaseDate = movieDetails.release_date;
        const year = releaseDate ? releaseDate.split('-')[0] : 'N/A';
        const runtime = movieDetails.runtime;
        const rating = movieDetails.vote_average;
        const synopsis = movieDetails.overview;
        const posterPath = movieDetails.poster_path;
        const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : 'https://via.placeholder.com/200x300';

        // Step 3: Update the UI with movie metadata
        document.querySelector('.movie-title').textContent = title;
        document.querySelector('.movie-year').textContent = `Year: ${year}`;
        document.querySelector('.movie-poster').src = posterUrl;
        document.querySelector('.movie-synopsis').textContent = synopsis || 'Synopsis not available.';
        document.querySelector('.movie-runtime').textContent = `Runtime: ${formatRuntime(runtime)}`;
        document.querySelector('.movie-rating').textContent = `Rating: ${rating ? Math.round(rating) + '/10' : 'N/A'}`;
        document.querySelector('.movie-id').innerHTML = `TMDB ID: <a href="https://www.themoviedb.org/movie/${selectedMovieId}" target="_blank">${selectedMovieId}</a>`;
        console.log(`[DEBUG] Displayed movie: ${title} (${year})`);

    } catch (error) {
        console.error('[DEBUG] Error picking movie:', error);
        document.querySelector('.movie-title').textContent = 'Error loading movie';
        document.querySelector('.movie-year').textContent = 'Year: N/A';
        document.querySelector('.movie-runtime').textContent = 'Runtime: N/A';
        document.querySelector('.movie-rating').textContent = 'Rating: N/A';
        document.querySelector('.movie-id').textContent = 'TMDB ID: N/A';
        document.querySelector('.movie-synopsis').textContent = 'Failed to load movie details. Please pick another movie.';
        selectedMovieId = null; // Reset movie ID on error
    }
}

// Trigger on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOMContentLoaded fired for movie-picker');
    if (sessionStorage.getItem('isLoggedIn') !== 'true' || !sessionStorage.getItem('sessionToken')) {
        console.log('[DEBUG] Session invalid, redirecting to index.html');
        window.location.href = 'index.html';
        return;
    }
    // Attach event listener to Play on Plex button
    const plexButton = document.querySelector('.plex-stream');
    if (plexButton) {
        plexButton.addEventListener('click', openPlexWebApp);
    }
    // Attach event listener to Pick a Different Movie button
    const pickButton = document.querySelector('.pick-button');
    if (pickButton) {
        pickButton.addEventListener('click', pickRandomMovie);
    }
    pickRandomMovie();
});