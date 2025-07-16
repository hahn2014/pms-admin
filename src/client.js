function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
        .then(response => {
            if (!response.ok) throw new Error('Invalid credentials');
            return response.json();
        })
        .then(data => {
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('username', username);
            sessionStorage.setItem('sessionToken', data.sessionToken);
            document.getElementById('login-container').classList.add('hidden');
            document.getElementById('main-container').classList.remove('hidden');
            document.getElementById('nav-menu').classList.add('hidden');
            document.getElementById('username-display').textContent = username;
            errorMessage.textContent = '';
        })
        .catch(error => {
            errorMessage.textContent = error.message || 'Login failed';
        });
}

function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleButton = document.getElementById('toggle-password');
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleButton.textContent = 'Hide';
    } else {
        passwordInput.type = 'password';
        toggleButton.textContent = 'Show';
    }
}

function logout() {
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('sessionToken');
    window.location.href = 'index.html';
}

function navigate(page) {
    if (sessionStorage.getItem('isLoggedIn') !== 'true' || !sessionStorage.getItem('sessionToken')) {
        window.location.href = 'index.html';
        return;
    }
    if (page === 'home') {
        window.location.href = 'index.html';
    } else if (page === 'file-explorer') {
        window.location.href = 'file-explorer.html';
    } else if (page === 'nas-stats') {
        window.location.href = 'stats.html';
    } else if (page === 'movie-pick') {
        window.location.href = 'movie-picker.html';
    } else if (page === 'media-list') {
        window.location.href = 'media-list.html';
    } else {
        alert(`Navigating to ${page}`);
        const navMenu = document.getElementById('nav-menu');
        if (navMenu) navMenu.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        const navMenu = document.getElementById('nav-menu');
        if (navMenu && sessionStorage.getItem('isLoggedIn') === 'true') {
            navMenu.classList.add('hidden');
            document.getElementById('login-container').classList.add('hidden');
            document.getElementById('main-container').classList.remove('hidden');
            document.getElementById('username-display').textContent = sessionStorage.getItem('username') || 'User';
        }
        const passwordInput = document.getElementById('password');
        const usernameInput = document.getElementById('username');
        if (passwordInput) passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') login(); });
        if (usernameInput) usernameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') login(); });
        return;
    }
    if (!sessionStorage.getItem('isLoggedIn') || !sessionStorage.getItem('sessionToken')) {
        sessionStorage.clear();
        window.location.href = 'index.html';
        return;
    }
    try {
        const response = await fetch('/api/check-session', {
            headers: { 'X-Session-Token': sessionStorage.getItem('sessionToken') || '' }
        });
        if (!response.ok) {
            sessionStorage.clear();
            window.location.href = 'index.html';
            return;
        }
        const usernameDisplay = document.getElementById('username-display');
        if (usernameDisplay) usernameDisplay.textContent = sessionStorage.getItem('username') || 'User';
        const navMenu = document.getElementById('nav-menu');
        if (navMenu) navMenu.classList.remove('hidden');
    } catch (error) {
        sessionStorage.clear();
        window.location.href = 'index.html';
    }
});