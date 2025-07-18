/**
 * Initializes dark mode based on user preference or system settings.
 * Sets up the toggle button to switch between light and dark modes.
 */
document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('dark-mode-toggle');
    const savedMode = localStorage.getItem('dark-mode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    const setButtonContent = (isDarkMode) => {
        if (isDarkMode) {
            toggleButton.innerHTML = '<i class="fas fa-moon"></i> Switch to Light Mode';
            toggleButton.setAttribute('aria-label', 'Switch to light mode');
        } else {
            toggleButton.innerHTML = '<i class="fas fa-sun"></i> Switch to Dark Mode';
            toggleButton.setAttribute('aria-label', 'Switch to dark mode');
        }
    };

    if (savedMode === 'enabled' || (!savedMode && prefersDark)) {
        document.body.classList.add('dark-mode');
        setButtonContent(true);
    } else {
        setButtonContent(false);
    }

    toggleButton.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('dark-mode', isDarkMode ? 'enabled' : 'disabled');
        setButtonContent(isDarkMode);
    });
});