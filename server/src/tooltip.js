document.addEventListener('DOMContentLoaded', function() {
    const tooltips = document.querySelectorAll('.tooltip');

    tooltips.forEach(tooltip => {
        tooltip.addEventListener('mouseover', () => {
            const tooltipRect = tooltip.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            if (tooltipRect.top > 50) {
                tooltip.setAttribute('data-position', 'top');
            } else if (viewportHeight - tooltipRect.bottom > 50) {
                tooltip.setAttribute('data-position', 'bottom');
            } else if (tooltipRect.left > 50) {
                tooltip.setAttribute('data-position', 'left');
            } else if (viewportWidth - tooltipRect.right > 50) {
                tooltip.setAttribute('data-position', 'right');
            }
        });
    });
});