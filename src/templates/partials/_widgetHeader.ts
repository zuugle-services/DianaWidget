/**
 * Generates the HTML for a reusable widget header.
 * @param {object} args - Arguments including t, title, showBackButton, backButtonId, menuDropdownHTML, and an optional titleId.
 * @returns {string} HTML string for the widget header.
 */
export function getWidgetHeaderHTML(args) {
    const {t, title, titleId, showBackButton = false, backButtonId, menuDropdownHTML = ''} = args;

    const backButtonHTML = showBackButton ? `
        <button id="${backButtonId}" class="back-btn-arrow" aria-label="${t('ariaLabels.backButton')}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </button>
    ` : '<!-- Empty Spacer -->';

    const titleIdAttr = titleId ? `id="${titleId}"` : '';

    return `
        <div class="widget-header">
            <div class="widget-header-button">
                ${backButtonHTML}
            </div>
            <div ${titleIdAttr} class="widget-header-heading">${title}</div>
            <div class="widget-header-button">
                <button class="menu-btn-dots" aria-label="${t('ariaLabels.menuButton')}">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 5.25C12.6904 5.25 13.25 4.69036 13.25 4C13.25 3.30964 12.6904 2.75 12 2.75C11.3096 2.75 10.75 3.30964 10.75 4C10.75 4.69036 11.3096 5.25 12 5.25Z" fill="currentColor"/>
                        <path d="M12 12.25C12.6904 12.25 13.25 11.6904 13.25 11C13.25 10.3096 12.6904 9.75 12 9.75C11.3096 9.75 10.75 10.3096 10.75 11C10.75 11.6904 11.3096 12.25 12 12.25Z" fill="currentColor"/>
                        <path d="M12 19.25C12.6904 19.25 13.25 18.6904 13.25 18C13.25 17.3096 12.6904 16.75 12 16.75C11.3096 16.75 10.75 17.3096 10.75 18C10.75 18.6904 11.3096 19.25 12 19.25Z" fill="currentColor"/>
                    </svg>
                </button>
                ${menuDropdownHTML}
            </div>
        </div>
    `;
}
