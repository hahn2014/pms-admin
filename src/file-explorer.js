async function loadDirectory(path = '/usb') {
    console.log(`[DEBUG] loadDirectory called with path: ${path}`);
    if (sessionStorage.getItem('isLoggedIn') !== 'true' || !sessionStorage.getItem('sessionToken')) {
        console.log('[DEBUG] Session invalid, redirecting to index.html');
        window.location.href = 'index.html';
        return;
    }

    try {
        console.log('[DEBUG] Checking session with /api/check-session');
        const response = await fetch('/api/check-session', {
            headers: {
                'X-Session-Token': sessionStorage.getItem('sessionToken') || ''
            }
        });
        if (!response.ok) {
            console.error('[DEBUG] Session check failed with status:', response.status);
            sessionStorage.clear();
            window.location.href = 'index.html';
            return;
        }
    } catch (error) {
        console.error('[DEBUG] Session check error:', error);
        sessionStorage.clear();
        window.location.href = 'index.html';
        return;
    }

    const breadcrumbPath = document.getElementById('breadcrumb-path');
    const fileList = document.querySelector('.file-list');
    const uploadButton = document.getElementById('upload-button');

    // Disable upload button in root directory
    uploadButton.disabled = path === '/usb';
    uploadButton.classList.toggle('disabled', path === '/usb');

    const pathParts = path.split('/').filter(part => part);
    let accumulatedPath = [];
    breadcrumbPath.innerHTML = pathParts.map((part, index) => {
        accumulatedPath.push(part);
        const clickablePath = '/' + accumulatedPath.join('/');
        return `<span onclick="loadDirectory('${clickablePath}')">${part}</span>`;
    }).join(' / ');

    document.getElementById('file-explorer').dataset.path = path;

    try {
        console.log(`[DEBUG] Fetching files for path: ${path}`);
        const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`, {
            headers: {
                'X-Session-Token': sessionStorage.getItem('sessionToken') || ''
            }
        });
        if (!response.ok) {
            if (response.status === 401) {
                console.error('[DEBUG] Unauthorized access to files API');
                sessionStorage.clear();
                window.location.href = 'index.html';
                return;
            }
            const errorData = await response.json();
            fileList.innerHTML = `<div class="warning-message">Error: ${errorData.error || 'Failed to load directory. Please check the NAS configuration or try again.'}</div>`;
            return;
        }
        const { files, folders } = await response.json();

        folders.sort((a, b) => a.localeCompare(b));
        files.sort((a, b) => a.localeCompare(b));

        fileList.innerHTML = '';
        if (folders.length === 0 && files.length === 0) {
            fileList.innerHTML = '<div class="warning-message">No files or folders found in this directory.</div>';
            return;
        }
        folders.forEach(folder => {
            const item = document.createElement('div');
            item.className = 'file-item folder';
            item.innerHTML = `
                <span class="name">${folder}</span>
                <div class="file-item-actions">
                    <button class="rename-btn tooltip" data-tooltip="Rename folder" onclick="showRenamePrompt('${path}', '${folder}', 'folder')"><i class="fa-regular fa-pen-to-square"></i></button>
                    <button class="delete-btn tooltip" data-tooltip="Delete folder" onclick="showDeletePrompt('${path}', '${folder}', 'folder')"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            `;
            item.querySelector('.name').onclick = () => loadDirectory(`${path}/${folder}`);
            fileList.appendChild(item);
        });
        files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'file-item file';
            const isMedia = /\.(mp4|mkv|avi|mov|mp3|flac|aac|wav|jpg|jpeg|png|gif)$/i.test(file);
            item.innerHTML = `
                <span class="name">${file}</span>
                <div class="file-item-actions">
                    <button class="download-btn tooltip" data-tooltip="Download file" onclick="downloadFile('${path}', '${file}')"><i class="fa-regular fa-floppy-disk"></i></button>
                    <button class="rename-btn tooltip" data-tooltip="Rename file" onclick="showRenamePrompt('${path}', '${file}', 'file')"><i class="fa-regular fa-pen-to-square"></i></button>
                    <button class="delete-btn tooltip" data-tooltip="Delete file" onclick="showDeletePrompt('${path}', '${file}', 'file')"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            `;
            if (isMedia) {
                item.querySelector('.name').onclick = () => showPreview(`${path}/${file}`, file);
            }
            fileList.appendChild(item);
        });
    } catch (error) {
        console.error('[DEBUG] Error loading directory:', error);
        fileList.innerHTML = '<div class="warning-message">Error: Failed to load directory. Please check the NAS configuration or try again.</div>';
    }
}

async function showPreview(filePath, fileName) {
    console.log(`[DEBUG] showPreview called for: ${filePath}`);
    const previewOverlay = document.getElementById('preview-overlay');
    const previewContent = document.getElementById('preview-content');
    const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
    const mediaExtensions = {
        video: ['.mp4', '.mkv', '.avi', '.mov'],
        audio: ['.mp3', '.flac', '.aac', '.wav'],
        image: ['.jpg', '.jpeg', '.png', '.gif']
    };

    let mediaType = null;
    if (mediaExtensions.video.includes(extension)) mediaType = 'video';
    else if (mediaExtensions.audio.includes(extension)) mediaType = 'audio';
    else if (mediaExtensions.image.includes(extension)) mediaType = 'image';

    if (!mediaType) {
        console.log(`[DEBUG] Unsupported file type for preview: ${extension}`);
        return;
    }

    previewContent.innerHTML = '';
    const encodedPath = encodeURIComponent(filePath);
    if (mediaType === 'video') {
        previewContent.innerHTML = `
            <video controls>
                <source src="/api/stream?path=${encodedPath}" type="video/${extension.slice(1)}">
                Your browser does not support the video tag.
            </video>
        `;
    } else if (mediaType === 'audio') {
        previewContent.innerHTML = `
            <audio controls>
                <source src="/api/stream?path=${encodedPath}" type="audio/${extension.slice(1)}">
                Your browser does not support the audio tag.
            </audio>
        `;
    } else if (mediaType === 'image') {
        previewContent.innerHTML = `<img src="/api/stream?path=${encodedPath}" alt="${fileName}">`;
    }

    previewOverlay.classList.remove('hidden');
    previewOverlay.style.display = 'flex';
    console.log('[DEBUG] Preview overlay shown');
}

function hidePreview() {
    const previewOverlay = document.getElementById('preview-overlay');
    const previewContent = document.getElementById('preview-content');
    if (previewOverlay) {
        previewOverlay.classList.add('hidden');
        previewOverlay.style.display = 'none';
        previewContent.innerHTML = '';
        console.log('[DEBUG] Preview overlay hidden');
    } else {
        console.error('[DEBUG] Preview overlay not found');
    }
}

async function downloadFile(path, file) {
    console.log(`[DEBUG] Downloading file: ${path}/${file}`);
    const notification = document.getElementById('notification');
    notification.textContent = `Preparing download for ${file}...`;
    notification.classList.remove('hidden', 'error');
    notification.classList.add('success');

    try {
        const response = await fetch(`/api/download?path=${encodeURIComponent(`${path}/${file}`)}`, {
            headers: {
                'X-Session-Token': sessionStorage.getItem('sessionToken') || ''
            }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to download file');
        }
        notification.textContent = `Download started for ${file}`;

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        notification.textContent = `Download completed for ${file}`;
        console.log(`[DEBUG] File ${file} downloaded successfully`);
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);
    } catch (error) {
        console.error('[DEBUG] Download error:', error);
        notification.textContent = `Error: ${error.message}`;
        notification.classList.remove('success');
        notification.classList.add('error');
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);
    }
}

function showPrompt(title, message, inputPlaceholder, confirmCallback, showInput = false) {
    console.log(`[DEBUG] showPrompt called with title: ${title}, showInput: ${showInput}`);
    const promptOverlay = document.getElementById('prompt-overlay');
    const promptTitle = document.getElementById('prompt-title');
    const promptMessage = document.getElementById('prompt-message');
    const promptInput = document.getElementById('prompt-input');
    const promptTextbox = document.getElementById('prompt-textbox');
    const promptError = document.getElementById('prompt-error');
    const promptConfirm = document.getElementById('prompt-confirm');
    const promptCancel = document.getElementById('prompt-cancel');

    if (!promptOverlay || !promptTitle || !promptMessage || !promptConfirm || !promptCancel) {
        console.error('[DEBUG] Prompt elements missing:', {
            promptOverlay: !!promptOverlay,
            promptTitle: !!promptTitle,
            promptMessage: !!promptMessage,
            promptConfirm: !!promptConfirm,
            promptCancel: !!promptCancel
        });
        return;
    }

    console.log('[DEBUG] Prompt overlay state before show:', {
        classList: promptOverlay.classList.toString(),
        display: window.getComputedStyle(promptOverlay).display
    });

    promptTitle.textContent = title || 'Prompt';
    promptMessage.innerHTML = message || '';
    promptError.textContent = '';
    promptTextbox.value = '';
    promptTextbox.placeholder = inputPlaceholder || '';
    promptInput.classList.toggle('hidden', !showInput);

    const newConfirm = promptConfirm.cloneNode(true);
    const newCancel = promptCancel.cloneNode(true);
    promptConfirm.parentNode.replaceChild(newConfirm, promptConfirm);
    promptCancel.parentNode.replaceChild(newCancel, promptCancel);

    promptOverlay.classList.remove('hidden');
    promptOverlay.style.display = 'flex';
    console.log('[DEBUG] Prompt overlay shown');

    newConfirm.onclick = async () => {
        console.log('[DEBUG] Confirm button clicked');
        try {
            await confirmCallback(promptTextbox.value);
            hidePrompt();
        } catch (error) {
            promptError.textContent = error.message || 'An error occurred';
            console.error('[DEBUG] Prompt confirm error:', error);
        }
    };
    newCancel.onclick = () => {
        console.log('[DEBUG] Cancel button clicked');
        hidePrompt();
    };

    if (showInput) {
        promptTextbox.focus();
        promptTextbox.onkeypress = (e) => {
            if (e.key === 'Enter') {
                console.log('[DEBUG] Enter key pressed in prompt textbox');
                newConfirm.click();
            }
        };
    }
}

function hidePrompt() {
    const promptOverlay = document.getElementById('prompt-overlay');
    if (promptOverlay) {
        promptOverlay.classList.add('hidden');
        promptOverlay.style.display = 'none';
        console.log('[DEBUG] Prompt overlay hidden');
        console.log('[DEBUG] Prompt overlay state after hide:', {
            classList: promptOverlay.classList.toString(),
            display: window.getComputedStyle(promptOverlay).display
        });
    } else {
        console.error('[DEBUG] Prompt overlay not found');
    }
}

function showNewDirectoryPrompt() {
    const currentPath = document.getElementById('file-explorer').dataset.path || '/usb';
    showPrompt(
        'Create New Directory',
        `Enter the name for the new directory in ${currentPath}:`,
        'Directory name',
        async (newName) => {
            if (!newName.trim()) {
                throw new Error('Directory name cannot be empty');
            }
            if (/[<>:"\/\\|?*\x00-\x1F]/.test(newName.trim())) {
                throw new Error('Invalid characters in directory name');
            }
            const requestBody = { path: currentPath, name: newName.trim() };
            const response = await fetch('/api/create-directory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': sessionStorage.getItem('sessionToken') || ''
                },
                body: JSON.stringify(requestBody)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create directory');
            }
            loadDirectory(currentPath);
        },
        true
    );
}

function showFileUploadPrompt() {
    console.log('[DEBUG] showFileUploadPrompt called');
    const currentPath = document.getElementById('file-explorer').dataset.path || '/usb';
    if (currentPath === '/usb') { //verify outside of root for file upload
        showPrompt(
            'Upload Error',
            'File uploads are not allowed in the root directory. Please navigate to a /Media directory.',
            '',
            () => {},
            false
        );
        return;
    }
    showPrompt(
        'Upload File',
        `Select a media file to upload to ${currentPath}:`,
        '',
        async () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.mp4,.mkv,.mp3,.avi,.mov,.flac,.aac,.wav,.jpg,.jpeg,.png,.gif';
            input.onchange = async () => {
                if (!input.files || input.files.length === 0) {
                    console.log('[DEBUG] No file selected for upload');
                    return;
                }
                await uploadFile(input.files[0], currentPath);
            };
            input.click();
        },
        false
    );
}

async function uploadFile(file, currentPath) {
    console.log(`[DEBUG] Uploading file: ${file.name} to ${currentPath}`);
    const notification = document.getElementById('notification');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const uploadProgress = document.getElementById('upload-progress');

    const allowedExtensions = ['.mp4', '.mkv', '.mp3', '.avi', '.mov', '.flac', '.aac', '.wav', '.jpg', '.jpeg', '.png', '.gif'];
    const fileExt = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
        notification.textContent = `Error: Only media files (${allowedExtensions.join(', ')}) are allowed`;
        notification.classList.remove('success');
        notification.classList.add('error');
        notification.classList.remove('hidden');
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', currentPath);

    try {
        uploadProgress.classList.remove('hidden');
        progressBar.value = 0;
        progressText.textContent = 'Uploading... 0%';

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload', true);
        xhr.setRequestHeader('X-Session-Token', sessionStorage.getItem('sessionToken') || '');

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                progressBar.value = percent;
                progressText.textContent = `Uploading... ${percent}%`;
            }
        };

        xhr.onload = () => {
            uploadProgress.classList.add('hidden');
            if (xhr.status === 200) {
                notification.textContent = `File ${file.name} uploaded successfully`;
                notification.classList.remove('error');
                notification.classList.add('success');
                notification.classList.remove('hidden');
                loadDirectory(currentPath);
                setTimeout(() => {
                    notification.classList.add('hidden');
                }, 3000);
            } else {
                let errorMessage = 'Failed to upload file';
                try {
                    const errorData = JSON.parse(xhr.responseText);
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    console.error('[DEBUG] Error parsing response:', e);
                }
                notification.textContent = `Error: ${errorMessage}`;
                notification.classList.remove('success');
                notification.classList.add('error');
                notification.classList.remove('hidden');
                setTimeout(() => {
                    notification.classList.add('hidden');
                }, 3000);
            }
        };

        xhr.onerror = () => {
            uploadProgress.classList.add('hidden');
            notification.textContent = 'Error: Network error occurred during upload';
            notification.classList.remove('success');
            notification.classList.add('error');
            notification.classList.remove('hidden');
            setTimeout(() => {
                notification.classList.add('hidden');
            }, 3000);
        };

        xhr.send(formData);
    } catch (error) {
        console.error('[DEBUG] Upload error:', error);
        uploadProgress.classList.add('hidden');
        notification.textContent = `Error: ${error.message}`;
        notification.classList.remove('success');
        notification.classList.add('error');
        notification.classList.remove('hidden');
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    const fileExplorer = document.getElementById('file-explorer');
    const currentPath = fileExplorer.dataset.path || '/usb';
    if (currentPath !== '/usb') {
        fileExplorer.classList.add('drag-over');
    }
}

function handleDrop(event) {
    event.preventDefault();
    const fileExplorer = document.getElementById('file-explorer');
    fileExplorer.classList.remove('drag-over');
    const currentPath = fileExplorer.dataset.path || '/usb';
    if (currentPath === '/usb') {
        const notification = document.getElementById('notification');
        notification.textContent = 'Error: File uploads are not allowed in the root directory';
        notification.classList.remove('success');
        notification.classList.add('error');
        notification.classList.remove('hidden');
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);
        return;
    }
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        uploadFile(files[0], currentPath);
    }
}

function showRenamePrompt(currentPath, name, type) {
    console.log(`[DEBUG] showRenamePrompt called for ${type}: ${name}`);
    const extension = type === 'file' ? name.slice(name.lastIndexOf('.')) : '';
    const baseName = type === 'file' ? name.slice(0, name.lastIndexOf('.')) : name;

    showPrompt(
        `Rename ${type === 'file' ? 'File' : 'Folder'}`,
        `Enter new name for ${name}${extension ? ' (extension will remain ' + extension + ')' : ''}:`,
        'New name',
        async (newBaseName) => {
            console.log('[DEBUG] Renaming to:', newBaseName);
            if (!newBaseName.trim()) {
                throw new Error('Name cannot be empty');
            }
            if (/[<>:"\/\\|?*\x00-\x1F]/.test(newBaseName.trim())) {
                throw new Error('Invalid characters in name');
            }
            const newName = newBaseName.trim() + (type === 'file' ? extension : '');
            const requestBody = { path: currentPath, oldName: name, newName };
            console.log('[DEBUG] Sending rename request:', requestBody);
            const response = await fetch('/api/rename', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': sessionStorage.getItem('sessionToken') || ''
                },
                body: JSON.stringify(requestBody)
            });
            if (!response.ok) {
                const errorData = await response.json();
                console.error('[DEBUG] Rename failed:', errorData);
                throw new Error(errorData.error || 'Failed to rename');
            }
            console.log('[DEBUG] Rename successful');
            loadDirectory(currentPath);
        },
        true
    );
}

async function showDeletePrompt(currentPath, name, type) {
    console.log(`[DEBUG] showDeletePrompt called for ${type}: ${name}`);
    let message = '';
    try {
        console.log('[DEBUG] Fetching file info for:', currentPath + '/' + name);
        const response = await fetch(`/api/file-info?path=${encodeURIComponent(currentPath + '/' + name)}`, {
            headers: {
                'X-Session-Token': sessionStorage.getItem('sessionToken') || ''
            }
        });
        if (!response.ok) {
            console.error('[DEBUG] Failed to fetch file info:', response.status);
            throw new Error('Failed to fetch file info');
        }
        const { fileCount, folderCount, size } = await response.json();
        message = `
            Are you sure you want to delete <strong>${name}</strong>?<br>
            ${type === 'folder' ? `This will delete ${folderCount} folder(s) and ${fileCount} file(s), freeing ${formatSize(size)}.` : `This will delete 1 file, freeing ${formatSize(size)}.`}
        `;
    } catch (error) {
        console.error('[DEBUG] Error fetching file info:', error);
        message = `Are you sure you want to delete ${name}? (Size information unavailable)`;
    }

    showPrompt(
        `Delete ${type === 'file' ? 'File' : 'Folder'}`,
        message,
        '',
        async () => {
            console.log('[DEBUG] Deleting:', currentPath + '/' + name);
            const requestBody = { path: currentPath, name };
            console.log('[DEBUG] Sending delete request:', requestBody);
            const response = await fetch('/api/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': sessionStorage.getItem('sessionToken') || ''
                },
                body: JSON.stringify(requestBody)
            });
            if (!response.ok) {
                const errorData = await response.json();
                console.error('[DEBUG] Delete failed:', errorData);
                throw new Error(errorData.error || 'Failed to delete');
            }
            console.log('[DEBUG] Delete successful');
            loadDirectory(currentPath);
        },
        false
    );
}

function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOMContentLoaded fired');
    const promptOverlay = document.getElementById('prompt-overlay');
    const previewOverlay = document.getElementById('preview-overlay');
    if (promptOverlay) {
        promptOverlay.classList.add('hidden');
        promptOverlay.style.display = 'none';
        console.log('[DEBUG] Initial call to hide prompt-overlay, state:', {
            classList: promptOverlay.classList.toString(),
            display: window.getComputedStyle(promptOverlay).display
        });
    } else {
        console.error('[DEBUG] Prompt overlay not found on DOMContentLoaded');
    }
    if (previewOverlay) {
        previewOverlay.classList.add('hidden');
        previewOverlay.style.display = 'none';
        console.log('[DEBUG] Initial call to hide preview-overlay, state:', {
            classList: previewOverlay.classList.toString(),
            display: window.getComputedStyle(previewOverlay).display
        });
    } else {
        console.error('[DEBUG] Preview overlay not found on DOMContentLoaded');
    }
    hidePrompt();
    console.log('[DEBUG] Initial call to hidePrompt completed');
    loadDirectory('/usb');
});