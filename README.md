<h1 style="text-align: center">PMS Admin Web Application</h1>
<a name="md-header"></a>


<center>PMS Admin is a web-based application designed to manage and interact with a Network Attached Storage (NAS) server, providing tools to browse files, view media analytics, and select random movies for streaming via Plex. Built with HTML, CSS, and JavaScript, it offers a user-friendly interface with responsive design and dark mode support. This README provides a comprehensive guide to the application's features, purpose, setup, and configuration.</center>

## Table of Contents
- [Purpose and Use Case](#purpose-and-use-case)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Download Files](#download-files)
- [Configuration](#configuration)
- [Directory Structure](#directory-structure)
- [Running Server](#Running-Server)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
- [Upcoming Features](#upcoming-features)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

## Purpose and Use Case

PMS Admin is tailored for users who need a centralized interface to manage their NAS server's media and storage. It serves home media enthusiasts, small businesses, or IT administrators who use a NAS to store movies, TV shows, music, and other files. The application simplifies file management, provides storage analytics, and enhances the media consumption experience by integrating with Plex for movie streaming. Key use cases include:
- **Server Status**: Critical Plex Media Server infrastructure and processes panel with live status monitoring and daemon/full system restart logic.
- **File Management**: Browse, upload, rename, download, and delete files and directories on the NAS.
- **Data Analytics**: Visualize storage usage and media distribution with charts and tables.
- **Media Databasing**: Full NAS media drive crawl for media database population (used across multiple features).
- **Movie Selection**: Get random movie recommendations with TMDB metadata for streaming on Plex (direct PMS server integration to come).
- **Administrative Control**: Secure RSA encrypted database login system for authorized access to NAS resources.

## Features

### 1. Secure Login System
- **Username and Password Authentication**: Users log in via a secure form with RSA encryption.
- **Session Management**: Store user session to maintain login session between pages and tasks.
- **Responsive Design**: The webapp adapts to various screen sizes for accessibility on mobile and desktop devices.
- **Error Handling**: Error page handling based on invalid server requests and blacklisted file requests.

### 2. Server Processes Monitoring
- **Live Status**: Live process monitoring for critical Plex Media Server infrastructure (pms, tautulli, overseer, cloudflare)
- **Hard Drives**: One time request for all NAS Media drive statuses listed with information breakdown
- **Process Cycling**: Reboot cycle for each unique process to assist admin troubleshooting server side.
- **System Reboot**: Full NAS server reboot call for fresh launch.

### 3. File Explorer
- **Directory Navigation**: Browse NAS Media directories with breadcrumb navigation for easy path tracking.
- **File Operations**: Upload, download, rename, and delete files or directories.
- **Drag-and-Drop Upload**: Supports drag-and-drop file uploads with a progress bar.
- **Prompts for Confirmation**: Confirms actions like renaming or deleting to prevent accidental permanent changes.
- **File Preview**: Preview media files (images, videos, audio) in a modal overlay.

### 4. Media List
- **Tabbed Interface**: Displays movies, TV shows, Photos and songs in separate tabs with smooth transitions.
- **Detailed Tables**: Shows metadata such as title, release year, file path, size, and extension.
- **Refresh Functionality**: Updates the media list to reflect changes on the NAS.
- **Searching**: Search functionality to come soon.

### 5. NAS Stats
- **Analytics Visualization**: Displays storage and media analytics via bar graphs (default) or raw data tables.
- **Toggle Views**: Switch between graphical and tabular data representations.
- **Responsive Charts**: Adapts to different screen sizes for optimal viewing.

### 6. Movie Picker
- **Random Movie Selection**: Recommends a random movie with metadata (title, year, runtime, rating, synopsis) from the NAS.
- **Plex Integration**: Provides a "Play on Plex" button to stream the selected movie. Integration with plex media server coming at a later date.
- **TMDB Metadata**: Fetches movie details and posters from The Movie Database (TMDB).
- **Responsive Layout**: Adjusts for mobile devices with a stacked layout for movie details.

### 7. Dark Mode
- **Theme Toggle**: Switch between light and dark modes for user comfort.
- **Consistent Styling**: Applies theme across all pages, including modals and overlays.

### 8. Navigation and Usability
- **Landing Page**: Display a welcome message in place of nav header and instead list ALL available features on the landing page.
- **Unified Header**: seamless navigation menu across all pages.
- **Fixed Footer**: Shows version information and a dark mode toggle.
- **Return-to-Top Button**: Available on the media list page for easy navigation.
- **Mobile Optimization**: Responsive design ensures usability on smaller screens.

## Prerequisites

> [!IMPORTANT]
> Before setting up PMS Admin, ensure you have the following
- **Web Server**: A server capable of serving static HTML, CSS, and JavaScript files (e.g., Apache, Nginx, or a simple Node.js server).
- **NAS Server**: A NAS device with accessible file storage and Plex Media Server installed.
- **TMDB API Key**: Required for fetching movie metadata in the Movie Picker feature.
- **Node.js** (optional): For local development or testing with a simple server.
- **Browser**: A modern web browser (Chrome, Firefox, Edge, or Safari) for optimal compatibility.

## Download Files

1. **Clone or Download the Repository**:
   - If using Git, clone the repository:
     ```bash
     git clone https://github.com/Hahn2014/pms-admin.git
     ```
   - Alternatively, download the ZIP file from the repository and extract it.
1. **Download supplemental resources**:
   - [FontAwesome 6+ (Free or Pro)](https://fontawesome.com/)
   - [Chart.js](https://www.chartjs.org/)

3. **Verify Files**:
   Ensure the following files are present in the project directory:
   - HTML Files
     - `index.html` (login page and landing page)
     - `file-explorer.html` (file explorer page)
     - `media-list.html` (media list page)
     - `movie-picker.html` (movie picker page)
     - `stats.html` (NAS stats page)
     - `status.html` (server status page)
     - `error.html` (error page)
   - JS Files
     - `server.js` (main server logic)
     - `client.js` (main client logic)
     - `dark-mode.js` (dark mode toggle button logic)
     - `file-explorer.js` (file explorer logic)
     - `media-list.js` (media list logic)
     - `movie-picker.js` (movie picker logic)
     - `stats.js` (stats and graphing logic)
     - `status.js` (server statuses logic)
     - `tooltip.js` (tooltip helper logic)
   - CSS Files
     - `error.css` (error page styles)
     - `file-explorer.css` (file explorer styles)
     - `main.css` (global styles)
     - `media-list.css` (media list styles)
     - `movie-picker.css` (movie picker styles)
     - `stats.css` (NAS stats styles)
     - `status.css` (server status styles)
     - `tooltip.css` (tooltip helper styles)
   - Resources
     - `error-banner.gif` (error page banner image)
     - `favicon.ico` (tab favicon)
     - `logo.jpg` (main logo image)
     - `not-found.jpg` (placeholder image)
     - `plex.svg` (Plex logo)
     - `TMDB.svg` (TMDB logo)
   - Supplemental Scripts
     - `getStats.py` - Python script to collect data on NAS media storage and disk space analytics into a formatted JSON file

## Configuration

### Creating and Configuring the .env File
> [!WARNING]
> The application requires a `.env` file to store sensitive configuration details, such as the TMDB API key, Media root paths and NAS server settings.

1. **Create a `.env` File**:
   - In the project root directory, create a file named `.env`.
   - Example structure:
     ```
     NODE_ENV=release
     MEDIA_ROOT=/usb/
     TMDB_API_KEY=your_tmdb_api_key_here
     MONITORED_DRIVES=/dev/sda1,/dev/sdb1,/dev/sdc1
     NAS_SERVER_URL=http://your-nas-server-ip:port
     PLEX_API_URL=http://your-plex-server-ip:32400
     PLEX_API_TOKEN=your_plex_api_token
     ```

2. **Obtain a TMDB API Key**:
   - Sign up at [themoviedb.org](https://www.themoviedb.org/) and create an API key.
   - Copy the API key and add it to the `.env` file as `TMDB_API_KEY`.

3. **NAS Server URL**:
   - Set `NAS_SERVER_URL` to the IP address and port of your NAS server (e.g., `http://192.168.1.1:8080`).
   - Ensure the NAS server has an API or file system access enabled.

4. **Plex API Configuration**:
   - Obtain a Plex API token from your Plex Media Server ([see Plex documentation for details](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/)).
   - Set `PLEX_API_URL` to your Plex server's address and `PLEX_API_TOKEN` to the token.

5. **Secure the .env File**:
   - Ensure the `.env` file is not publicly accessible by either having it hosted in the parent directory or configuring your web server to deny access (done by default in `server.js`)

6. **Load Environment Variables**:
   - Since using a Node.js backend, we need to use a library like `dotenv` to load the `.env` file:
     ```javascript
     require('dotenv').config();  //this is enabled by default
     ```
   - For client-side JavaScript, ensure the environment variables are injected securely (e.g., via a server-side script or build process).

### Additional Configuration
- **Authentication**: Implement a backend service to handle username/password authentication. The current login form requires integration with an authentication API.
- **File System Access**: Configure the backend to interact with the NAS file system for file operations (upload, download, etc.). There are existing limits and restrictions for my own personal use that some may want removed or loosened. See `file-explorer.js` for localized restrictions. 
- **Chart.js Integration**: Ensure the `stats.js` page loads nas data to your liking. this is built off my file structure and pre-existing python scripts (included) and explained.
- **Responsive Design**: Test the application on various devices to ensure the responsive design works as expected.
- **User Registration**: As I personally plan to have minimal user activity, registration is an unnecessary risk for me. Although it is a necessary feature to inject into the users.db credentials database, so registration logic can be found within `server.js` from the `/api/register` call.

## Directory Structure
> [!CAUTION]
> Ensure your file structure for the server is set up like the following or be sure to modify HTML files with the refactored file structure.
```
pms-admin/
├── include/
├────── fontawesome-free-6.7.2-web/
├────────── all min necessary fontawesome dependencies
├── node_modules/
├────── nodeJS modules
├── resources/
├────── all local images
├── src/
├────── all complimentary .js files
├── stylesheet/
├────── all .css files
├── .env                    # Environment variables (to be created)
├── error.html              # Error Handling page
├── file-explorer.html      # File Explorer page
├── index.html              # Login Handling and Landing page
├── media.db                # sql database of all NAS media files and minimal metadata
├── media-list.html         # Media List page
├── movie-picker.html       # Movie Picker page
├── nas-stats.json          # python script generated JSON file with basic disk information stats and file stats
├── package.json            # nodeJS server package
├── package-lock.json       # nodeJS module package
├── server.js               # main server logic
├── stats.html              # NAS Stats page
├── status.html             # Server Status page
└── users.db                # RSA encrypted user/pass database of accessible users for credential verification
```

## Running Server
- Install Node.js if not already installed (https://nodejs.org/).
- Navigate to the project directory:
  ```bash
  cd pms-admin
  ```
- Install pm2 to manage and run nodeJS servers:
  ```bash
  npm install pm2 -g
  ```
- Start the server:
  ```bash
  pm2 start server.js --name pms-admin
  ```
- Access the application at `http://localhost:3000` or `http://nas.ip.address:3000`.
- To make sure the server starts upon reboot:
  ```bash
  pm2 save
  ```
    - To stop and remove server:
  ```bash
  pm2 stop pms-admin
  pm2 delete pms-admin
  ```

## Usage

1. **Access the Application**:
   - Open your browser and navigate to the server URL (e.g., `http://localhost:3000` or your deployed server address).
   - Log in using your credentials.

2. **Navigate the Interface**:
   - Use the landing page to access Server Status, File Explorer, NAS Stats, Movie Picker, Media List, or Help.
   - Toggle between light and dark modes using the footer button.
   - Return to landing page by clicking logo in top left corner.

3. **File Explorer**:
   - Browse by clicking through folders or returning to parent directories using the breadcrumb links.
   - Upload files via drag-and-drop or the upload button.
   - Rename, download, or delete files using the action buttons.
   - Stream media files in a modal overlay. (not recommended for video files, Plex handles streaming significantly better)

4. **Media List**:
   - Switch between Movies, TV Shows, Songs and Photos tabs.
   - Refresh the list to update media metadata (used in movie picker).
   - Scroll through tables to view detailed file information.

5. **NAS Stats**:
   - View storage and media analytics in bar graphs or tables.
   - Toggle between views using the "Switch to Raw Data" button.

6. **Movie Picker**:
   - Click "Something Else" to get a random movie recommendation.
   - View movie details and click "Play on Plex" to stream.

7. **Logout**:
   - End your session using the logout button in the navigation menu.

## Troubleshooting

- **Login Issues**:
  - Verify that the authentication backend is running and configured correctly.
  - Ensure user credentials have been injected into the `users.db` file through registration api call.
  - Check browser console for error messages related to authentication if .env variable set to development

- **File Explorer Errors**:
  - Ensure the NAS server is accessible and the file system API is correctly configured.
  - Validate .env is set up and `MEDIA_ROOT` is the path to the mounting points for your NAS drives.
  - Check file permissions on the NAS for read/write access.

- **Movie Picker Not Loading Metadata**:
  - Verify the TMDB API key in the `.env` file.
  - Check network connectivity and TMDB API status.
  - Check console output for errors regarding to TMDB if running as development environment.

- **Charts Not Rendering**:
  - Ensure the Chart.js CDN is accessible.
  - Check browser console for JavaScript errors.

- **Responsive Design Issues**:
  - Test on multiple devices and browsers to identify layout issues.
  - Adjust CSS media queries in `main.css`, `file-explorer.css`, etc., if needed.
- **Bug Reporting**
  - You can submit [a new issue request](https://github.com/hahn2014/pms-admin/issues/new) for any bugs or app breaking crashes found, or alternatively, [fork the repository](#Contributing) and submit your own fix!

## Upcoming Features
- [ ] Plex Media Server integration with movie picker and media library population.
- [ ] Tautulli stats integration
- [ ] Overseer requests integration
- [ ] More to come!

## Contributing

Contributions are welcome! To contribute:
1. Fork the repository.
2. Create a new branch (`git checkout -b feature/your-feature`).
3. Make changes and commit (`git commit -m "Add your feature"`).
4. Push to the branch (`git push origin feature/your-feature`).
5. Create a pull request with a detailed description of changes.

Please ensure your code follows the existing style and includes appropriate tests.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgements

- **[HahnSolo](https://github.com/hahn2014/)**: Developer of PMS Admin, version 1.0, updated July 2025.
- **The Movie Database (TMDB)**: For providing movie metadata and images.
- **Chart.js**: For rendering analytics charts in the NAS Stats feature.
- **Plex**: For media streaming integration.
- **FontAwesome**: Great free use icons and button art.
---

*<center>Developed by HahnSolo. 1.0 update July 2025</center>*

[<center>Back to Top</center>](#md-header)