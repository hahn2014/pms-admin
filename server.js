require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fileUpload = require('express-fileupload');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const app = express();
const port = 3000;
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

// Environment and configuration setup
const isDev = process.env.NODE_ENV === 'development';
const mediaRoot = process.env.MEDIA_ROOT || '/usb';
const sessions = new Set(); // Store active session tokens
const nasStatsPath = path.join(__dirname, 'nas-stats.json');
const mockNasPath = path.join(__dirname, 'mock_usb');
const monitoredDrives = process.env.MONITORED_DRIVES ? process.env.MONITORED_DRIVES.split(',').map(drive => drive.trim()) : [];

// Middleware to block access to sensitive files
app.use((req, res, next) => {
    const sensitiveFiles = ['users.db', 'media.db', '.env', 'nas-stats.json'];
    const requestedPath = path.basename(req.path);
    if (sensitiveFiles.includes(requestedPath)) {
        if (isDev) console.log(`[DEBUG] Blocked access to sensitive file: ${req.path}`);
        return sendError(res, 403, 'Access to this file is forbidden');
    }
    next();
});

// General middleware setup
app.use(express.static(path.join(__dirname)));
app.use(fileUpload());
app.use(express.json());

// Users database setup
const dbPath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath);
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
                                                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                 username TEXT UNIQUE,
                                                 password TEXT
            )`);
});

// Media database setup
const mediaDbPath = path.join(__dirname, 'media.db');
const mediaDb = new sqlite3.Database(mediaDbPath);
mediaDb.serialize(() => {
    mediaDb.run(`CREATE TABLE IF NOT EXISTS media (
                                                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                      type TEXT,
                                                      file_path TEXT UNIQUE,
                                                      drive TEXT,
                                                      size INTEGER,
                                                      extension TEXT
                 )`);
    mediaDb.run(`CREATE TABLE IF NOT EXISTS movies (
                                                       media_id INTEGER PRIMARY KEY,
                                                       title TEXT,
                                                       release_year INTEGER,
                                                       FOREIGN KEY (media_id) REFERENCES media(id)
        )`);
    mediaDb.run(`CREATE TABLE IF NOT EXISTS tv_shows (
                                                         media_id INTEGER PRIMARY KEY,
                                                         show_title TEXT,
                                                         release_year INTEGER,
                                                         season INTEGER,
                                                         episode INTEGER,
                                                         episode_title TEXT,
                                                         FOREIGN KEY (media_id) REFERENCES media(id)
        )`);
    mediaDb.run(`CREATE TABLE IF NOT EXISTS songs (
                                                      media_id INTEGER PRIMARY KEY,
                                                      artist TEXT,
                                                      album TEXT,
                                                      release_year INTEGER,
                                                      song_title TEXT,
                                                      FOREIGN KEY (media_id) REFERENCES media(id)
        )`);
});

// Session middleware for protected routes
app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/index.html' || req.path === '/api/login' || req.path === '/api/stream' || req.path === '/error.html') {
        if (isDev) console.log(`[DEBUG] Bypassing session check for path: ${req.path}`);
        return next();
    }
    const sessionToken = req.headers['x-session-token'];
    if (!sessionToken || !sessions.has(sessionToken)) {
        return sendError(res, 401, 'Unauthorized');
    }
    next();
});

/**
 * Centralized error handling function to serve error.html with status and message.
 * @param {Object} res - Express response object.
 * @param {number} status - HTTP status code.
 * @param {string} message - Error message to display.
 */
function sendError(res, status, message) {
    if (isDev) console.log(`[DEBUG] Sending error: ${status} - ${message}`);
    res.status(status).redirect(`/error.html?status=${status}&message=${encodeURIComponent(message)}`);
}

/**
 * Serves the TMDB API key for client-side use.
 * @returns {Object} JSON object containing the TMDB API key.
 */
app.get('/api/config', (req, res) => {
    if (isDev) console.log('[DEBUG] Serving TMDB API key via /api/config');
    res.json({ tmdbApiKey: process.env.TMDB_API_KEY || '' });
});

/**
 * Serves the nas-stats.json file.
 * @returns {Object} JSON object containing the nas-stats data.
 */
app.get('/api/nas-stats', async (req, res) => {
    try {
        const stats = await fs.readFile(nasStatsPath, 'utf8');
        res.json(JSON.parse(stats));
    } catch (error) {
        if (isDev) console.error('[DEBUG] Error fetching nas-stats:', error.message);
        sendError(res, 500, `Failed to fetch nas-stats: ${error.message}`);
    }
});

/**
 * Updates nas-stats.json by removing a deleted duplicate file.
 * @param {string} deletedFile - Body parameter for the deleted file path.
 */
app.post('/api/update-nas-stats', async (req, res) => {
    const sessionToken = req.headers['x-session-token'];
    if (!sessionToken || !sessions.has(sessionToken)) {
        if (isDev) console.log('[DEBUG] Invalid or missing session token');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { deletedFile } = req.body;
    if (!deletedFile) {
        if (isDev) console.log('[DEBUG] Missing deletedFile in request body');
        return res.status(400).json({ error: 'Missing deletedFile' });
    }

    try {
        console.log(`[DEBUG] Updating nas-stats for deleted file: ${deletedFile}`);
        const stats = await fs.readFile(nasStatsPath, 'utf8');
        const statsData = JSON.parse(stats);

        // Normalize deletedFile path to match nas-stats.json
        const normalizedDeletedFile = deletedFile.replace(/^\/usb\//, `${mockNasPath}/`);
        console.log(`[DEBUG] Normalized deleted file path: ${normalizedDeletedFile}`);

        // Update duplicates array
        if (statsData.duplicates && Array.isArray(statsData.duplicates)) {
            statsData.duplicates = statsData.duplicates
                .map(dup => {
                    if (dup && typeof dup === 'object' && Array.isArray(dup.locations)) {
                        // Remove the deleted file from locations
                        const updatedLocations = dup.locations.filter(loc => loc !== normalizedDeletedFile);
                        if (updatedLocations.length >= 2) {
                            // Keep the entry if there are 2 or more locations
                            return { ...dup, locations: updatedLocations };
                        }
                        // Remove the entry entirely if fewer than 2 locations remain
                        return null;
                    }
                    return dup;
                })
                .filter(dup => dup !== null); // Remove null entries
        }

        // Write updated stats back to nas-stats.json
        await fs.writeFile(nasStatsPath, JSON.stringify(statsData, null, 2));
        console.log('[DEBUG] nas-stats.json updated successfully');
        res.json({ message: 'nas-stats updated successfully' });
    } catch (error) {
        console.error('[DEBUG] Error updating nas-stats:', error.message);
        res.status(500).json({ error: `Failed to update nas-stats: ${error.message}` });
    }
});

// Serve the root path with index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

/**
 * Verifies if a session token is valid.
 * @returns {Object} JSON object indicating session validity.
 */
app.get('/api/check-session', (req, res) => {
    const sessionToken = req.headers['x-session-token'];
    if (sessionToken && sessions.has(sessionToken)) {
        res.status(200).json({ valid: true });
    } else {
        sendError(res, 401, 'Invalid session');
    }
});

/**
 * Streams media files with support for range requests.
 * @param {string} path - Query parameter specifying the file path.
 */
app.get('/api/stream', async (req, res) => {
    const itemPath = req.query.path;
    const fullPath = getFullPath(itemPath);
    if (!isPathSafe(fullPath)) {
        return sendError(res, 403, 'Access denied');
    }
    try {
        const stats = await fs.stat(fullPath);
        if (!stats.isFile()) {
            return sendError(res, 400, 'Requested path is not a file');
        }
        const fileSize = stats.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = await fs.open(fullPath, 'r');
            const buffer = Buffer.alloc(chunksize);
            await file.read(buffer, 0, chunksize, start);
            await file.close();

            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': getContentType(fullPath)
            };
            res.writeHead(206, head);
            res.end(buffer);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': getContentType(fullPath)
            };
            res.writeHead(200, head);
            const fileStream = require('fs').createReadStream(fullPath);
            fileStream.pipe(res);
        }
    } catch (error) {
        sendError(res, 500, `Failed to stream file: ${error.message}`);
    }
});

/**
 * Lists files and folders in a directory.
 * @param {string} path - Query parameter specifying the directory path.
 * @returns {Object} JSON object with files and folders arrays.
 */
app.get('/api/files', async (req, res) => {
    const requestedPath = req.query.path || '/usb';
    const fullPath = getFullPath(requestedPath);
    if (!isPathSafe(fullPath)) {
        return sendError(res, 403, 'Access denied');
    }
    try {
        await fs.access(fullPath);
        const items = await fs.readdir(fullPath, { withFileTypes: true });
        const files = items.filter(item => !item.isDirectory()).map(item => item.name);
        const folders = items.filter(item => item.isDirectory()).map(item => item.name);
        res.json({ files, folders });
    } catch (error) {
        sendError(res, 500, `Failed to read directory: ${error.message}`);
    }
});

/**
 * Provides file or folder info including size and counts.
 * @param {string} path - Query parameter specifying the item path.
 * @returns {Object} JSON object with fileCount, folderCount, and size.
 */
app.get('/api/file-info', async (req, res) => {
    const itemPath = req.query.path;
    const fullPath = getFullPath(itemPath);
    if (!isPathSafe(fullPath)) {
        return sendError(res, 403, 'Access denied');
    }
    try {
        const stats = await fs.stat(fullPath);
        if (stats.isFile()) {
            return res.json({ fileCount: 1, folderCount: 0, size: stats.size });
        }
        let fileCount = 0, folderCount = 0, totalSize = 0;
        async function scanDir(dir) {
            const items = await fs.readdir(dir, { withFileTypes: true });
            for (const item of items) {
                const itemPath = path.join(dir, item.name);
                const itemStats = await fs.stat(itemPath);
                if (item.isDirectory()) {
                    folderCount++;
                    await scanDir(itemPath);
                } else {
                    fileCount++;
                    totalSize += itemStats.size;
                }
            }
        }
        await scanDir(fullPath);
        res.json({ fileCount, folderCount, size: totalSize });
    } catch (error) {
        sendError(res, 500, `Failed to get file info: ${error.message}`);
    }
});

/**
 * Downloads a file.
 * @param {string} path - Query parameter specifying the file path.
 */
app.get('/api/download', async (req, res) => {
    const itemPath = req.query.path;
    const fullPath = getFullPath(itemPath);
    if (!isPathSafe(fullPath)) {
        return sendError(res, 403, 'Access denied');
    }
    try {
        const stats = await fs.stat(fullPath);
        if (!stats.isFile()) {
            return sendError(res, 400, 'Requested path is not a file');
        }
        res.download(fullPath);
    } catch (error) {
        sendError(res, 500, `Failed to download file: ${error.message}`);
    }
});

/**
 * Uploads a file, restricting to media file extensions.
 * @param {string} path - Body parameter specifying the upload directory.
 * @param {File} file - The file to upload.
 */
app.post('/api/upload', async (req, res) => {
    if (!req.body.path || !req.files || !req.files.file) {
        return sendError(res, 400, 'Missing required parameters or file');
    }
    const dirPath = req.body.path;
    const file = req.files.file;
    const allowedExtensions = ['.mp4', '.mkv', '.mp3', '.avi', '.mov', '.flac', '.aac', '.wav'];
    const fileExt = path.extname(file.name).toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
        return sendError(res, 400, 'Only media files allowed');
    }
    const fullPath = getFullPath(path.join(dirPath, file.name));
    if (!isPathSafe(fullPath)) {
        return sendError(res, 403, 'Access denied');
    }
    try {
        await file.mv(fullPath);
        res.status(200).json({ success: true });
    } catch (error) {
        sendError(res, 500, `Failed to upload file: ${error.message}`);
    }
});

/**
 * Generates media file statistics per drive.
 * @returns {Object} JSON object with drive stats and totals.
 */
app.get('/api/stats', async (req, res) => {
    try {
        const drives = await new Promise((resolve, reject) => {
            mediaDb.all('SELECT drive, COUNT(*) as totalFiles, SUM(size) as totalSize FROM media GROUP BY drive', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        const movies = await new Promise((resolve, reject) => {
            mediaDb.all('SELECT drive, COUNT(*) as movieCount FROM media JOIN movies ON media.id = movies.media_id GROUP BY drive', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        const tvShows = await new Promise((resolve, reject) => {
            mediaDb.all('SELECT drive, COUNT(*) as tvShowCount FROM media JOIN tv_shows ON media.id = tv_shows.media_id GROUP BY drive', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        const stats = drives.map(drive => {
            const movieData = movies.find(m => m.drive === drive.drive) || { movieCount: 0 };
            const tvShowData = tvShows.find(t => t.drive === drive.drive) || { tvShowCount: 0 };
            return {
                name: drive.drive,
                movies: movieData.movieCount,
                tvShows: tvShowData.tvShowCount,
                totalFiles: drive.totalFiles,
                totalSize: drive.totalSize / (1024 * 1024 * 1024),
                driveCapacity: 1000, // Fixed capacity assumption (1000 GiB)
                freeSpace: 1000 - (drive.totalSize / (1024 * 1024 * 1024))
            };
        });
        res.json({ drives: stats, totalFiles: stats.reduce((sum, d) => sum + d.totalFiles, 0), generatedDate: new Date().toISOString() });
    } catch (error) {
        sendError(res, 500, 'Failed to fetch stats');
    }
});

/**
 * Retrieves all movies from the database.
 * @returns {Object} JSON object with an array of movies.
 */
app.get('/api/movies', async (req, res) => {
    try {
        const movies = await new Promise((resolve, reject) => {
            mediaDb.all('SELECT m.title, m.release_year FROM movies m JOIN media md ON m.media_id = md.id', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        res.json({ movies });
    } catch (error) {
        sendError(res, 500, `Failed to fetch movies: ${error.message}`);
    }
});

/**
 * Fetches all media items with details.
 * @returns {Object} JSON object with an array of media items.
 */
app.get('/api/media-list', async (req, res) => {
    try {
        const media = await new Promise((resolve, reject) => {
            mediaDb.all(`
                SELECT m.id, m.type, m.file_path, m.drive, m.size, m.extension,
                       mov.title as movie_title, mov.release_year as movie_year,
                       tv.show_title, tv.release_year as tv_year, tv.season, tv.episode, tv.episode_title,
                       sng.artist, sng.album, sng.release_year as song_year, sng.song_title
                FROM media m
                LEFT JOIN movies mov ON m.id = mov.media_id
                LEFT JOIN tv_shows tv ON m.id = tv.media_id
                LEFT JOIN songs sng ON m.id = sng.media_id
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        const formattedMedia = media.map(item => ({
            id: item.id,
            type: item.type,
            file_path: item.file_path,
            drive: item.drive,
            size: item.size,
            extension: item.extension,
            details: item.type === 'movie' ? {
                title: item.movie_title,
                release_year: item.movie_year
            } : item.type === 'tv_show' ? {
                show_title: item.show_title,
                release_year: item.tv_year,
                season: item.season,
                episode: item.episode,
                episode_title: item.episode_title
            } : item.type === 'song' ? {
                artist: item.artist,
                album: item.album,
                release_year: item.song_year,
                song_title: item.song_title
            } : {}
        }));
        res.json({ media: formattedMedia });
    } catch (error) {
        if (isDev) console.error('[DEBUG] Error fetching media list:', error.message);
        sendError(res, 500, `Failed to fetch media list: ${error.message}`);
    }
});

/**
 * Refreshes the media database by scanning the media directory.
 */
app.post('/api/refresh-media', async (req, res) => {
    try {
        const rootPath = path.isAbsolute(mediaRoot) ? mediaRoot : path.join(__dirname, mediaRoot);
        if (isDev) console.log(`[DEBUG] Scanning directory for media refresh: ${rootPath}`);
        const mediaFiles = [];

        function parseMediaFile(fileName, filePath, drive) {
            const extension = path.extname(fileName).toLowerCase();
            const baseName = path.basename(fileName, extension);
            if (extension.match(/\.(mp4|mkv|avi|mov)$/)) {
                const tvShowMatch = baseName.match(/^(.*) S(\d{2})E(\d{2}) (.*)$/i);
                if (tvShowMatch) {
                    return {
                        type: 'tv_show',
                        show_title: tvShowMatch[1].trim(),
                        season: parseInt(tvShowMatch[2]),
                        episode: parseInt(tvShowMatch[3]),
                        episode_title: tvShowMatch[4].trim(),
                        release_year: null
                    };
                } else {
                    const movieMatch = baseName.match(/^(.*) \((\d{4})\)$/i);
                    if (movieMatch) {
                        return {
                            type: 'movie',
                            title: movieMatch[1].trim(),
                            release_year: parseInt(movieMatch[2])
                        };
                    }
                }
            } else if (extension.match(/\.(mp3|flac|aac|wav)$/)) {
                const songMatch = baseName.match(/^(.*) - (.*) - (.*)$/i);
                if (songMatch) {
                    return {
                        type: 'song',
                        artist: songMatch[1].trim(),
                        album: songMatch[2].trim(),
                        song_title: songMatch[3].trim(),
                        release_year: null
                    };
                }
            }
            return null;
        }

        async function scanDirectory(dir) {
            try {
                const items = await fs.readdir(dir, { withFileTypes: true });
                for (const item of items) {
                    const fullPath = path.join(dir, item.name);
                    if (item.isDirectory()) {
                        await scanDirectory(fullPath);
                    } else {
                        const stats = await fs.stat(fullPath);
                        const drive = path.basename(path.dirname(fullPath));
                        const mediaInfo = parseMediaFile(item.name, fullPath, drive);
                        if (mediaInfo) {
                            mediaFiles.push({
                                type: mediaInfo.type,
                                file_path: path.isAbsolute(mediaRoot) ? fullPath.replace(mediaRoot, '/usb') : fullPath.replace(path.join(__dirname, mediaRoot), '/usb'),
                                drive: drive,
                                size: stats.size,
                                extension: path.extname(item.name).toLowerCase(),
                                details: mediaInfo
                            });
                        }
                    }
                }
            } catch (error) {
                if (isDev) console.error(`[DEBUG] Error scanning directory ${dir}:`, error.message);
            }
        }

        await scanDirectory(rootPath);
        if (isDev) console.log(`[DEBUG] Found ${mediaFiles.length} media files`);

        await new Promise((resolve, reject) => {
            mediaDb.serialize(() => {
                mediaDb.run('BEGIN TRANSACTION', (err) => {
                    if (err) {
                        if (isDev) console.error('[DEBUG] Error starting transaction:', err.message);
                        return reject(err);
                    }

                    // Clear existing data
                    mediaDb.run('DELETE FROM media', (err) => { if (err) reject(err); });
                    mediaDb.run('DELETE FROM movies', (err) => { if (err) reject(err); });
                    mediaDb.run('DELETE FROM tv_shows', (err) => { if (err) reject(err); });
                    mediaDb.run('DELETE FROM songs', (err) => { if (err) reject(err); });

                    // Prepare statements
                    const insertMedia = mediaDb.prepare('INSERT OR REPLACE INTO media (type, file_path, drive, size, extension) VALUES (?, ?, ?, ?, ?)');
                    const insertMovie = mediaDb.prepare('INSERT OR REPLACE INTO movies (media_id, title, release_year) VALUES (?, ?, ?)');
                    const insertTvShow = mediaDb.prepare('INSERT OR REPLACE INTO tv_shows (media_id, show_title, release_year, season, episode, episode_title) VALUES (?, ?, ?, ?, ?, ?)');
                    const insertSong = mediaDb.prepare('INSERT OR REPLACE INTO songs (media_id, artist, album, release_year, song_title) VALUES (?, ?, ?, ?, ?)');

                    // Track completion of insertions
                    let completed = 0;
                    mediaFiles.forEach((file) => {
                        insertMedia.run(file.type, file.file_path, file.drive, file.size, file.extension, function(err) {
                            if (err) {
                                if (isDev) console.error(`[DEBUG] Error inserting media file ${file.file_path}:`, err.message);
                                return reject(err);
                            }
                            const mediaId = this.lastID;
                            if (file.type === 'movie') {
                                insertMovie.run(mediaId, file.details.title, file.details.release_year, (err) => {
                                    if (err) {
                                        if (isDev) console.error(`[DEBUG] Error inserting movie ${file.details.title}:`, err.message);
                                        return reject(err);
                                    }
                                    if (++completed === mediaFiles.length) finalizeStatements();
                                });
                            } else if (file.type === 'tv_show') {
                                insertTvShow.run(mediaId, file.details.show_title, file.details.release_year, file.details.season, file.details.episode, file.details.episode_title, (err) => {
                                    if (err) {
                                        if (isDev) console.error(`[DEBUG] Error inserting TV show ${file.details.show_title}:`, err.message);
                                        return reject(err);
                                    }
                                    if (++completed === mediaFiles.length) finalizeStatements();
                                });
                            } else if (file.type === 'song') {
                                insertSong.run(mediaId, file.details.artist, file.details.album, file.details.release_year, file.details.song_title, (err) => {
                                    if (err) {
                                        if (isDev) console.error(`[DEBUG] Error inserting song ${file.details.song_title}:`, err.message);
                                        return reject(err);
                                    }
                                    if (++completed === mediaFiles.length) finalizeStatements();
                                });
                            } else {
                                if (++completed === mediaFiles.length) finalizeStatements();
                            }
                        });
                    });

                    function finalizeStatements() {
                        insertMedia.finalize((err) => {
                            if (err) return reject(err);
                            insertMovie.finalize((err) => {
                                if (err) return reject(err);
                                insertTvShow.finalize((err) => {
                                    if (err) return reject(err);
                                    insertSong.finalize((err) => {
                                        if (err) return reject(err);
                                        mediaDb.run('COMMIT', (err) => {
                                            if (err) return reject(err);
                                            resolve();
                                        });
                                    });
                                });
                            });
                        });
                    }

                    if (mediaFiles.length === 0) finalizeStatements();
                });
            });
        });

        res.status(200).json({ message: 'Media list refreshed successfully' });
    } catch (error) {
        if (isDev) console.error('[DEBUG] Error refreshing media list:', error.message);
        sendError(res, 500, `Failed to refresh media list: ${error.message}`);
    }
});

/**
 * Creates a new directory.
 * @param {string} path - Body parameter for the parent directory.
 * @param {string} name - Body parameter for the new directory name.
 */
app.post('/api/create-directory', async (req, res) => {
    if (!req.body.path || !req.body.name) {
        return sendError(res, 400, 'Missing required parameters');
    }
    const { path: dirPath, name } = req.body;
    const fullPath = getFullPath(path.join(dirPath, name));
    if (!isPathSafe(fullPath)) {
        return sendError(res, 403, 'Access denied');
    }
    try {
        await fs.mkdir(fullPath, { recursive: true });
        res.status(200).json({ success: true });
    } catch (error) {
        sendError(res, 500, `Failed to create directory: ${error.message}`);
    }
});

/**
 * Renames a file or folder.
 * @param {string} path - Body parameter for the directory path.
 * @param {string} oldName - Body parameter for the current name.
 * @param {string} newName - Body parameter for the new name.
 */
app.post('/api/rename', async (req, res) => {
    if (!req.body.path || !req.body.oldName || !req.body.newName) {
        return sendError(res, 400, 'Missing required parameters');
    }
    const { path: dirPath, oldName, newName } = req.body;
    const oldPath = getFullPath(path.join(dirPath, oldName));
    const newPath = getFullPath(path.join(dirPath, newName));
    if (!isPathSafe(oldPath) || !isPathSafe(newPath)) {
        return sendError(res, 403, 'Access denied');
    }
    try {
        await fs.rename(oldPath, newPath);
        res.status(200).json({ success: true });
    } catch (error) {
        sendError(res, 500, `Failed to rename: ${error.message}`);
    }
});

/**
 * Deletes a file or folder.
 * @param {string} path - Body parameter for the directory path.
 * @param {string} name - Body parameter for the item name.
 */
app.post('/api/delete', async (req, res) => {
    if (!req.body.path || !req.body.name) {
        return sendError(res, 400, 'Missing required parameters');
    }
    const { path: dirPath, name } = req.body;
    const fullPath = getFullPath(path.join(dirPath, name));
    if (!isPathSafe(fullPath)) {
        return sendError(res, 403, 'Access denied');
    }
    try {
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
            await fs.rm(fullPath, { recursive: true, force: true });
        } else {
            await fs.unlink(fullPath);
        }
        res.status(200).json({ success: true });
    } catch (error) {
        sendError(res, 500, `Failed to delete: ${error.message}`);
    }
});

/**
 * Registers a new user with hashed password.
 * @param {string} username - Body parameter for the username.
 * @param {string} password - Body parameter for the password.
 */
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return sendError(res, 400, 'Username and password are required');
    }
    try {
        const existingUser = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        if (existingUser) {
            return sendError(res, 409, 'Username already exists');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await new Promise((resolve, reject) => {
            db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        sendError(res, 500, 'Internal server error');
    }
});

/**
 * Authenticates a user and issues a session token.
 * @param {string} username - Body parameter for the username.
 * @param {string} password - Body parameter for the password.
 * @returns {Object} JSON object with sessionToken and username.
 */
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return sendError(res, 400, 'Username and password are required');
    }
    try {
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return sendError(res, 401, 'Invalid credentials');
        }
        const sessionToken = 'dev-token-' + Date.now(); // Consider UUID for production
        sessions.add(sessionToken);
        res.json({ sessionToken, username });
    } catch (error) {
        sendError(res, 500, 'Internal server error');
    }
});

/**
 * Restarts a specified service.
 * @param {string} service - Body parameter for the service name.
 */
app.post('/api/restart-service', async (req, res) => {
    const sessionToken = req.headers['x-session-token'];
    if (!sessionToken || !sessions.has(sessionToken)) {
        return sendError(res, 401, 'Unauthorized');
    }

    const { service } = req.body;
    const allowedServices = ['plexmediaserver', 'tautulli', 'overseer', 'cloudflared'];
    if (!service || !allowedServices.includes(service)) {
        return sendError(res, 400, 'Invalid or missing service name');
    }

    try {
        await execPromise(`sudo systemctl restart ${service}`);
        if (isDev) console.log(`[DEBUG] Restarted service: ${service}`);
        res.json({ message: `Service ${service} restarted successfully` });
    } catch (error) {
        if (isDev) console.error(`[DEBUG] Error restarting service ${service}:`, error.message);
        sendError(res, 500, `Failed to restart service ${service}: ${error.message}`);
    }
});

/**
 * Reboots the NAS server.
 */
app.post('/api/reboot', async (req, res) => {
    const sessionToken = req.headers['x-session-token'];
    if (!sessionToken || !sessions.has(sessionToken)) {
        return sendError(res, 401, 'Unauthorized');
    }

    try {
        if (isDev) {
            console.log('[DEBUG] Simulating NAS server reboot in development mode');
            sendError(res, 503, 'Server offline');
        } else {
            await execPromise('sudo reboot');
            sendError(res, 503, 'Server offline');
        }
    } catch (error) {
        if (isDev) console.error('[DEBUG] Error initiating reboot:', error.message);
        sendError(res, 500, `Failed to reboot server: ${error.message}`);
    }
});

/**
 * Checks the status of NAS services and drives with timeout handling.
 * @returns {Object} JSON object with service and drive statuses.
 */
app.get('/api/service-status', async (req, res) => {
    const sessionToken = req.headers['x-session-token'];
    if (!sessionToken || !sessions.has(sessionToken)) {
        return sendError(res, 401, 'Unauthorized');
    }

    const services = ['plexmediaserver', 'tautulli', 'overseer', 'cloudflared'];
    const statuses = { services: {}, drives: {}, noDrivesFound: false };

    // Check services
    for (const service of services) {
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Command timed out')), 5000);
            });
            const { stdout } = await Promise.race([
                execPromise(`systemctl is-active ${service}`),
                timeoutPromise
            ]);
            const status = stdout.trim();
            statuses.services[service] = status === 'active' ? 'active' : status === 'inactive' ? 'inactive' : 'failed';
        } catch (error) {
            if (isDev) console.error(`[DEBUG] Error checking status for ${service}:`, error.message);
            if (error.message.includes('Unit') && error.message.includes('not found')) {
                statuses.services[service] = 'not-installed';
            } else {
                statuses.services[service] = error.message === 'Command timed out' ? 'timeout' : 'failed';
            }
        }
    }

    // Check drives
    if (monitoredDrives.length === 0) {
        statuses.noDrivesFound = true;
    } else {
        for (const drive of monitoredDrives) {
            try {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Command timed out')), 5000);
                });
                const { stdout } = await Promise.race([
                    execPromise(`findmnt ${drive}`),
                    timeoutPromise
                ]);
                statuses.drives[drive] = stdout ? 'mounted' : 'unmounted';
            } catch (error) {
                if (isDev) console.error(`[DEBUG] Error checking drive ${drive}:`, error.message);
                statuses.drives[drive] = error.message === 'Command timed out' ? 'timeout' : 'not-found';
            }
        }
        // Check if all drives failed
        const allDrivesFailed = Object.values(statuses.drives).every(status => status === 'not-found' || status === 'timeout');
        if (allDrivesFailed) {
            statuses.noDrivesFound = true;
        }
    }

    res.json(statuses);
});

// Helper function to construct full file paths
function getFullPath(requestedPath) {
    return path.isAbsolute(mediaRoot) ?
        path.join(mediaRoot, requestedPath.replace(/^\/usb/, '')) :
        path.join(__dirname, mediaRoot, requestedPath.replace(/^\/usb/, ''));
}

// Helper function to prevent directory traversal
function isPathSafe(fullPath) {
    const resolvedPath = path.resolve(fullPath);
    const resolvedRoot = path.resolve(mediaRoot);
    return resolvedPath.startsWith(resolvedRoot);
}

// Helper function to determine content type by extension
function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.mp4': return 'video/mp4';
        case '.mkv': return 'video/x-matroska';
        case '.avi': return 'video/x-msvideo';
        case '.mov': return 'video/quicktime';
        case '.mp3': return 'audio/mpeg';
        case '.flac': return 'audio/flac';
        case '.aac': return 'audio/aac';
        case '.wav': return 'audio/wav';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.png': return 'image/png';
        case '.gif': return 'image/gif';
        default: return 'application/octet-stream';
    }
}

// Start the server, listening on all interfaces
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
});