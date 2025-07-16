# PMS Admin Web Application

PMS Admin is a web-based application designed to manage and interact with a Network Attached Storage (NAS) server, providing tools to browse files, view media analytics, and select random movies for streaming via Plex. Built with HTML, CSS, and JavaScript, it offers a user-friendly interface with responsive design and dark mode support. This README provides a comprehensive guide to the application's features, purpose, setup, and configuration.

## Table of Contents
- [Purpose and Use Case](#purpose-and-use-case)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Download and Setup](#download-and-setup)
- [Configuration](#configuration)
- [Directory Structure](#directory-structure)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

## Purpose and Use Case

PMS Admin is tailored for users who need a centralized interface to manage their NAS server's media and storage. It serves home media enthusiasts, small businesses, or IT administrators who use a NAS to store movies, TV shows, music, and other files. The application simplifies file management, provides storage analytics, and enhances the media consumption experience by integrating with Plex for movie streaming. Key use cases include:
- **File Management**: Browse, upload, rename, download, and delete files and directories on the NAS.
- **Media Analytics**: Visualize storage usage and media distribution with charts and tables.
- **Movie Selection**: Get random movie recommendations with metadata for streaming on Plex.
- **Administrative Control**: Secure login system for authorized access to NAS resources.

## Features

### 1. Secure Login System
- **Username and Password Authentication**: Users log in via a secure form with password visibility toggle.
- **Responsive Design**: The login page adapts to various screen sizes for accessibility on mobile and desktop devices.
- **Error Handling**: Displays error messages for invalid credentials.

### 2. File Explorer
- **Directory Navigation**: Browse NAS directories with breadcrumb navigation for easy path tracking.
- **File Operations**: Upload, download, rename, and delete files or directories.
- **Drag-and-Drop Upload**: Supports drag-and-drop file uploads with a progress bar.
- **Prompts for Confirmation**: Confirms actions like renaming or deleting to prevent accidental changes.
- **File Preview**: Preview media files (images, videos, audio) in a modal overlay.

### 3. Media List
- **Tabbed Interface**: Displays movies, TV shows, and songs in separate tabs with smooth transitions.
- **Detailed Tables**: Shows metadata such as title, release year, file path, size, and extension.
- **Refresh Functionality**: Updates the media list to reflect changes on the NAS.
- **Responsive Tables**: Scrollable tables optimized for mobile devices.

### 4. NAS Stats
- **Analytics Visualization**: Displays storage and media analytics via bar graphs (default) or raw data tables.
- **Toggle Views**: Switch between graphical and tabular data representations.
- **Responsive Charts**: Adapts to different screen sizes for optimal viewing.

### 5. Movie Picker
- **Random Movie Selection**: Recommends a random movie with metadata (title, year, runtime, rating, synopsis) from the NAS.
- **Plex Integration**: Provides a "Play on Plex" button to stream the selected movie.
- **TMDB Metadata**: Fetches movie details and posters from The Movie Database (TMDB).
- **Responsive Layout**: Adjusts for mobile devices with a stacked layout for movie details.

### 6. Dark Mode
- **Theme Toggle**: Switch between light and dark modes for user comfort.
- **Consistent Styling**: Applies theme across all pages, including modals and overlays.

### 7. Navigation and Usability
- **Unified Header**: Displays a welcome message and navigation menu across all pages.
- **Fixed Footer**: Shows version information and a dark mode toggle.
- **Return-to-Top Button**: Available on the media list page for easy navigation.
- **Mobile Optimization**: Responsive design ensures usability on smaller screens.

## Prerequisites

Before setting up PMS Admin, ensure you have the following:
- **Web Server**: A server capable of serving static HTML, CSS, and JavaScript files (e.g., Apache, Nginx, or a simple Node.js server).
- **NAS Server**: A NAS device with accessible file storage and Plex Media Server installed.
- **TMDB API Key**: Required for fetching movie metadata in the Movie Picker feature.
- **Node.js** (optional): For local development or testing with a simple server.
- **Browser**: A modern web browser (Chrome, Firefox, Edge, or Safari) for optimal compatibility.
- **Internet Access**: For fetching TMDB metadata and external CDN resources (e.g., Chart.js for NAS Stats).

## Download and Setup

### Step 1: Download the Project
1. **Clone or Download the Repository**:
   - If using Git, clone the repository:
     ```bash
     git clone https://github.com/HahnSolo/pms-admin.git
     ```
   - Alternatively, download the ZIP file from the repository and extract it.

2. **Verify Files**:
   Ensure the following files are present in the project directory:
   - `index.html` (login page)
   - `file-explorer.html` (file explorer page)
   - `media-list.html` (media list page)
   - `movie-picker.html` (movie picker page)
   - `stats.html` (NAS stats page)
   - `main.css` (global styles)
   - `file-explorer.css` (file explorer styles)
   - `media-list.css` (media list styles)
   - `movie-picker.css` (movie picker styles)
   - `stats.css` (NAS stats styles)

### Step 2: Set Up a Web Server
1. **Option 1: Local Development Server**:
   - Install Node.js if not already installed (https://nodejs.org/).
   - Navigate to the project directory:
     ```bash
     cd pms-admin
     ```
   - Install a simple HTTP server (e.g., `http-server`):
     ```bash
     npm install -g http-server
     ```
   - Start the server:
     ```bash
     http-server
     ```
   - Access the application at `http://localhost:8080`.

2. **Option 2: Deploy to a Web Server**:
   - Copy the project files to your web server's root directory (e.g., `/var/www/html` for Apache).
   - Configure the server to serve static files and ensure proper MIME types for HTML, CSS, and JavaScript.

### Step 3: Configure NAS Integration
- Ensure your NAS server is accessible over the network.
- Configure Plex Media Server on the NAS to allow API access for the "Play on Plex" feature.
- Update the file paths in the application logic (JavaScript) to point to your NAS storage directories.

## Configuration

### Creating and Configuring the .env File
The application requires a `.env` file to store sensitive configuration details, such as the TMDB API key and NAS server settings.

1. **Create a `.env` File**:
   - In the project root directory, create a file named `.env`.
   - Example structure:
     ```
     TMDB_API_KEY=your_tmdb_api_key_here
     NAS_SERVER_URL=http://your-nas-server-ip:port
     PLEX_API_URL=http://your-plex-server-ip:32400
     PLEX_API_TOKEN=your_plex_api_token
     ```

2. **Obtain a TMDB API Key**:
   - Sign up at https://www.themoviedb.org/ and create an API key.
   - Copy the API key and add it to the `.env` file as `TMDB_API_KEY`.

3. **NAS Server URL**:
   - Set `NAS_SERVER_URL` to the IP address and port of your NAS server (e.g., `http://192.168.1.100:8080`).
   - Ensure the NAS server has an API or file system access enabled.

4. **Plex API Configuration**:
   - Obtain a Plex API token from your Plex Media Server (see Plex documentation for details).
   - Set `PLEX_API_URL` to your Plex server's address and `PLEX_API_TOKEN` to the token.

5. **Secure the .env File**:
   - Ensure the `.env` file is not publicly accessible by configuring your web server to deny access (e.g., add to `.htaccess` for Apache):
     ```
     <Files .env>
         Order allow,deny
         Deny from all
     </Files>
     ```

6. **Load Environment Variables**:
   - If using a Node.js backend, use a library like `dotenv` to load the `.env` file:
     ```javascript
     require('dotenv').config();
     ```
   - For client-side JavaScript, ensure the environment variables are injected securely (e.g., via a server-side script or build process).

### Additional Configuration
- **Authentication**: Implement a backend service to handle username/password authentication. The current login form requires integration with an authentication API.
- **File System Access**: Configure the backend to interact with the NAS file system for file operations (upload, download, etc.).
- **Chart.js Integration**: Ensure the `stats.html` page loads Chart.js from a CDN for rendering analytics graphs.
- **Responsive Design**: Test the application on various devices to ensure the responsive design works as expected.

## Directory Structure

```
pms-admin/
├── index.html              # Login page
├── file-explorer.html      # File explorer page
├── media-list.html         # Media list page
├── movie-picker.html       # Movie picker page
├── stats.html              # NAS stats page
├── main.css                # Global styles
├── file-explorer.css       # File explorer styles
├── media-list.css          # Media list styles
├── movie-picker.css        # Movie picker styles
├── stats.css               # NAS stats styles
├── .env                    # Environment variables (to be created)
└── README.md               # This documentation
```

## Usage

1. **Access the Application**:
   - Open your browser and navigate to the server URL (e.g., `http://localhost:8080` or your deployed server address).
   - Log in using your credentials.

2. **Navigate the Interface**:
   - Use the navigation menu to access File Explorer, Media List, NAS Stats, Movie Picker, or Help.
   - Toggle between light and dark modes using the footer button.

3. **File Explorer**:
 - Browse directories using breadcrumbs.
   - Upload files via drag-and-drop or the upload button.
   - Rename, download, or delete files using the action buttons.
   - Preview media files in a modal overlay.

4. **Media List**:
   - Switch between Movies, TV Shows, and Songs tabs.
   - Refresh the list to update media metadata.
   - Scroll through tables to view detailed file information.

5. **NAS Stats**:
   - View storage and media analytics in bar graphs or tables.
   - Toggle between views using the "Switch to Raw Data" button.

6. **Movie Picker**:
   - Click "Pick a Different Movie" to get a random movie recommendation.
   - View movie details and click "Play on Plex" to stream.

7. **Logout**:
   - End your session using the logout button in the navigation menu.

## Troubleshooting

- **Login Issues**:
  - Verify that the authentication backend is running and configured correctly.
  - Check browser console for error messages related to authentication.

- **File Explorer Errors**:
  - Ensure the NAS server is accessible and the file system API is correctly configured.
  - Check file permissions on the NAS for read/write access.

- **Movie Picker Not Loading Metadata**:
  - Verify the TMDB API key in the `.env` file.
  - Check network connectivity and TMDB API status.

- **Charts Not Rendering**:
  - Ensure the Chart.js CDN is accessible.
  - Check browser console for JavaScript errors.

- **Responsive Design Issues**:
  - Test on multiple devices and browsers to identify layout issues.
  - Adjust CSS media queries in `main.css`, `file-explorer.css`, etc., if needed.

## Contributing

Contributions are welcome! To contribute:
1. Fork the repository.
2. Create a new branch (`git checkout -b feature/your-feature`).
3. Make changes and commit (`git commit -m "Add your feature"`).
4. Push to the branch (`git push origin feature/your-feature`).
5. Create a pull request with a detailed description of changes.

Please ensure your code follows the existing style and includes appropriate tests.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## Acknowledgements

- **HahnSolo**: Developer of PMS Admin, version 1.0, updated July 2025.
- **The Movie Database (TMDB)**: For providing movie metadata and images.
- **Chart.js**: For rendering analytics charts in the NAS Stats feature.
- **Plex**: For media streaming integration.

---

*Developed by HahnSolo. 1.0 update July 2025*