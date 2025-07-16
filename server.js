require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fileUpload = require('express-fileupload');
const app = express();
const port = 3000;
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const isDev = process.env.NODE_ENV === 'development';
const mediaRoot = process.env.MEDIA_ROOT || '/usb';

const sessions = new Set();

// Middleware to block access to sensitive files
app.use((req, res, next) => {
    const sensitiveFiles = ['users.db', 'media.db', '.env'];
    const requestedPath = path.basename(req.path);
    if (sensitiveFiles.includes(requestedPath)) {
        if (isDev) console.log(`[DEBUG] Blocked access to sensitive file: ${req.path}`);
        return res.status(403).json({ error: 'Access to this file is forbidden' });
    }
    next();
});

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

// Session middleware
app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/index.html' || req.path === '/api/login' || req.path === '/api/stream') {
        if (isDev) console.log(`[DEBUG] Bypassing session check for path: ${req.path}`);
        return next();
    }
    const sessionToken = req.headers['x-session-token'];
    if (!sessionToken || !sessions.has(sessionToken)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

// Config endpoint to serve TMDB API key
app.get('/api/config', (req, res) => {
    if (isDev) console.log('[DEBUG] Serving TMDB API key via /api/config');
    res.json({ tmdbApiKey: process.env.TMDB_API_KEY || '' });
});

// Root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Session check
app.get('/api/check-session', (req, res) => {
    const sessionToken = req.headers['x-session-token'];
    if (sessionToken && sessions.has(sessionToken)) {
        res.status(200).json({ valid: true });
    } else {
        res.status(401).json({ error: 'Invalid session' });
    }
});

// Stream media for preview
app.get('/api/stream', async (req, res) => {
    const itemPath = req.query.path;
    const fullPath = path.isAbsolute(mediaRoot) ? path.join(mediaRoot, itemPath.replace(/^\/usb/, '')) : path.join(__dirname, mediaRoot, itemPath.replace(/^\/usb/, ''));
    try {
        const stats = await fs.stat(fullPath);
        if (!stats.isFile()) {
            return res.status(400).json({ error: 'Requested path is not a file' });
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
                'Content-Type': path.extname(fullPath).toLowerCase() === '.mp4' ? 'video/mp4' :
                    path.extname(fullPath).toLowerCase() === '.mkv' ? 'video/x-matroska' :
                        path.extname(fullPath).toLowerCase() === '.avi' ? 'video/x-msvideo' :
                            path.extname(fullPath).toLowerCase() === '.mov' ? 'video/quicktime' :
                                path.extname(fullPath).toLowerCase() === '.mp3' ? 'audio/mpeg' :
                                    path.extname(fullPath).toLowerCase() === '.flac' ? 'audio/flac' :
                                        path.extname(fullPath).toLowerCase() === '.aac' ? 'audio/aac' :
                                            path.extname(fullPath).toLowerCase() === '.wav' ? 'audio/wav' :
                                                path.extname(fullPath).toLowerCase() === '.jpg' ? 'image/jpeg' :
                                                    path.extname(fullPath).toLowerCase() === '.jpeg' ? 'image/jpeg' :
                                                        path.extname(fullPath).toLowerCase() === '.png' ? 'image/png' :
                                                            path.extname(fullPath).toLowerCase() === '.gif' ? 'image/gif' :
                                                                'application/octet-stream'
            };
            res.writeHead(206, head);
            res.end(buffer);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': path.extname(fullPath).toLowerCase() === '.mp4' ? 'video/mp4' :
                    path.extname(fullPath).toLowerCase() === '.mkv' ? 'video/x-matroska' :
                        path.extname(fullPath).toLowerCase() === '.avi' ? 'video/x-msvideo' :
                            path.extname(fullPath).toLowerCase() === '.mov' ? 'video/quicktime' :
                                path.extname(fullPath).toLowerCase() === '.mp3' ? 'audio/mpeg' :
                                    path.extname(fullPath).toLowerCase() === '.flac' ? 'audio/flac' :
                                        path.extname(fullPath).toLowerCase() === '.aac' ? 'audio/aac' :
                                            path.extname(fullPath).toLowerCase() === '.wav' ? 'audio/wav' :
                                                path.extname(fullPath).toLowerCase() === '.jpg' ? 'image/jpeg' :
                                                    path.extname(fullPath).toLowerCase() === '.jpeg' ? 'image/jpeg' :
                                                        path.extname(fullPath).toLowerCase() === '.png' ? 'image/png' :
                                                            path.extname(fullPath).toLowerCase() === '.gif' ? 'image/gif' :
                                                                'application/octet-stream'
            };
            res.writeHead(200, head);
            const fileStream = require('fs').createReadStream(fullPath);
            fileStream.pipe(res);
        }
    } catch (error) {
        res.status(500).json({ error: `Failed to stream file: ${error.message}` });
    }
});

// File listing
app.get('/api/files', async (req, res) => {
    const requestedPath = req.query.path || '/usb';
    const dirPath = path.isAbsolute(mediaRoot) ? path.join(mediaRoot, requestedPath.replace(/^\/usb/, '')) : path.join(__dirname, mediaRoot, requestedPath.replace(/^\/usb/, ''));
    try {
        await fs.access(dirPath);
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        const files = items.filter(item => !item.isDirectory()).map(item => item.name);
        const folders = items.filter(item => item.isDirectory()).map(item => item.name);
        res.json({ files, folders });
    } catch (error) {
        res.status(500).json({ error: `Failed to read directory: ${error.message}` });
    }
});

// File info
app.get('/api/file-info', async (req, res) => {
    const itemPath = req.query.path;
    const fullPath = path.isAbsolute(mediaRoot) ? path.join(mediaRoot, itemPath.replace(/^\/usb/, '')) : path.join(__dirname, mediaRoot, itemPath.replace(/^\/usb/, ''));
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
        res.status(500).json({ error: `Failed to get file info: ${error.message}` });
    }
});

// File download
app.get('/api/download', async (req, res) => {
    const itemPath = req.query.path;
    const fullPath = path.isAbsolute(mediaRoot) ? path.join(mediaRoot, itemPath.replace(/^\/usb/, '')) : path.join(__dirname, mediaRoot, itemPath.replace(/^\/usb/, ''));
    try {
        const stats = await fs.stat(fullPath);
        if (!stats.isFile()) {
            return res.status(400).json({ error: 'Requested path is not a file' });
        }
        res.download(fullPath);
    } catch (error) {
        res.status(500).json({ error: `Failed to download file: ${error.message}` });
    }
});

// File upload
app.post('/api/upload', async (req, res) => {
    const dirPath = req.body.path;
    if (!req.files || !req.files.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const file = req.files.file;
    const allowedExtensions = ['.mp4', '.mkv', '.mp3', '.avi', '.mov', '.flac', '.aac', '.wav'];
    const fileExt = path.extname(file.name).toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
        return res.status(400).json({ error: 'Only media files allowed' });
    }
    const fullPath = path.isAbsolute(mediaRoot) ? path.join(mediaRoot, dirPath.replace(/^\/usb/, ''), file.name) : path.join(__dirname, mediaRoot, dirPath.replace(/^\/usb/, ''), file.name);
    try {
        await file.mv(fullPath);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: `Failed to upload file: ${error.message}` });
    }
});

// Stats endpoint
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
                driveCapacity: 1000,
                freeSpace: 1000 - (drive.totalSize / (1024 * 1024 * 1024))
            };
        });
        res.json({ drives: stats, totalFiles: stats.reduce((sum, d) => sum + d.totalFiles, 0), generatedDate: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Movies endpoint
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
        res.status(500).json({ error: `Failed to fetch movies: ${error.message}` });
    }
});

// Media list endpoint
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
        res.status(500).json({ error: `Failed to fetch media list: ${error.message}` });
    }
});

// Refresh media list endpoint
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
                    mediaDb.run('DELETE FROM media', (err) => {
                        if (err) return reject(err);
                    });
                    mediaDb.run('DELETE FROM movies', (err) => {
                        if (err) return reject(err);
                    });
                    mediaDb.run('DELETE FROM tv_shows', (err) => {
                        if (err) return reject(err);
                    });
                    mediaDb.run('DELETE FROM songs', (err) => {
                        if (err) return reject(err);
                    });

                    // Prepare statements
                    const insertMedia = mediaDb.prepare('INSERT OR REPLACE INTO media (type, file_path, drive, size, extension) VALUES (?, ?, ?, ?, ?)');
                    const insertMovie = mediaDb.prepare('INSERT OR REPLACE INTO movies (media_id, title, release_year) VALUES (?, ?, ?)');
                    const insertTvShow = mediaDb.prepare('INSERT OR REPLACE INTO tv_shows (media_id, show_title, release_year, season, episode, episode_title) VALUES (?, ?, ?, ?, ?, ?)');
                    const insertSong = mediaDb.prepare('INSERT OR REPLACE INTO songs (media_id, artist, album, release_year, song_title) VALUES (?, ?, ?, ?, ?)');

                    // Insert media files sequentially
                    let completed = 0;
                    mediaFiles.forEach((file, index) => {
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
                                    if (++completed === mediaFiles.length) {
                                        finalizeStatements();
                                    }
                                });
                            } else if (file.type === 'tv_show') {
                                insertTvShow.run(mediaId, file.details.show_title, file.details.release_year, file.details.season, file.details.episode, file.details.episode_title, (err) => {
                                    if (err) {
                                        if (isDev) console.error(`[DEBUG] Error inserting TV show ${file.details.show_title}:`, err.message);
                                        return reject(err);
                                    }
                                    if (++completed === mediaFiles.length) {
                                        finalizeStatements();
                                    }
                                });
                            } else if (file.type === 'song') {
                                insertSong.run(mediaId, file.details.artist, file.details.album, file.details.release_year, file.details.song_title, (err) => {
                                    if (err) {
                                        if (isDev) console.error(`[DEBUG] Error inserting song ${file.details.song_title}:`, err.message);
                                        return reject(err);
                                    }
                                    if (++completed === mediaFiles.length) {
                                        finalizeStatements();
                                    }
                                });
                            } else {
                                if (++completed === mediaFiles.length) {
                                    finalizeStatements();
                                }
                            }
                        });
                    });

                    function finalizeStatements() {
                        insertMedia.finalize((err) => {
                            if (err) {
                                if (isDev) console.error('[DEBUG] Error finalizing insertMedia:', err.message);
                                return reject(err);
                            }
                            insertMovie.finalize((err) => {
                                if (err) {
                                    if (isDev) console.error('[DEBUG] Error finalizing insertMovie:', err.message);
                                    return reject(err);
                                }
                                insertTvShow.finalize((err) => {
                                    if (err) {
                                        if (isDev) console.error('[DEBUG] Error finalizing insertTvShow:', err.message);
                                        return reject(err);
                                    }
                                    insertSong.finalize((err) => {
                                        if (err) {
                                            if (isDev) console.error('[DEBUG] Error finalizing insertSong:', err.message);
                                            return reject(err);
                                        }
                                        mediaDb.run('COMMIT', (err) => {
                                            if (err) {
                                                if (isDev) console.error('[DEBUG] Error committing transaction:', err.message);
                                                return reject(err);
                                            }
                                            resolve();
                                        });
                                    });
                                });
                            });
                        });
                    }

                    if (mediaFiles.length === 0) {
                        finalizeStatements();
                    }
                });
            });
        });

        if (isDev) console.log('[DEBUG] Media list refresh completed');
        res.status(200).json({ message: 'Media list refreshed successfully' });
    } catch (error) {
        if (isDev) console.error('[DEBUG] Error refreshing media list:', error.message);
        res.status(500).json({ error: `Failed to refresh media list: ${error.message}` });
    }
});

// Create directory
app.post('/api/create-directory', async (req, res) => {
    const { path: dirPath, name } = req.body;
    const fullPath = path.isAbsolute(mediaRoot) ? path.join(mediaRoot, dirPath.replace(/^\/usb/, ''), name) : path.join(__dirname, mediaRoot, dirPath.replace(/^\/usb/, ''), name);
    try {
        await fs.mkdir(fullPath, { recursive: true });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: `Failed to create directory: ${error.message}` });
    }
});

// Rename file/folder
app.post('/api/rename', async (req, res) => {
    const { path: dirPath, oldName, newName } = req.body;
    const oldPath = path.isAbsolute(mediaRoot) ? path.join(mediaRoot, dirPath.replace(/^\/usb/, ''), oldName) : path.join(__dirname, mediaRoot, dirPath.replace(/^\/usb/, ''), oldName);
    const newPath = path.isAbsolute(mediaRoot) ? path.join(mediaRoot, dirPath.replace(/^\/usb/, ''), newName) : path.join(__dirname, mediaRoot, dirPath.replace(/^\/usb/, ''), newName);
    try {
        await fs.rename(oldPath, newPath);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: `Failed to rename: ${error.message}` });
    }
});

// Delete file/folder
app.post('/api/delete', async (req, res) => {
    const { path: dirPath, name } = req.body;
    const fullPath = path.isAbsolute(mediaRoot) ? path.join(mediaRoot, dirPath.replace(/^\/usb/, ''), name) : path.join(__dirname, mediaRoot, dirPath.replace(/^\/usb/, ''), name);
    try {
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
            await fs.rm(fullPath, { recursive: true, force: true });
        } else {
            await fs.unlink(fullPath);
        }
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: `Failed to delete: ${error.message}` });
    }
});

// Register
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const existingUser = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        if (existingUser) {
            return res.status(409).json({ error: 'Username already exists' });
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
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const sessionToken = 'dev-token-' + Date.now();
        sessions.add(sessionToken);
        res.json({ sessionToken, username });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
});