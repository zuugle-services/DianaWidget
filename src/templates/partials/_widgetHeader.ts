/**
 * Generates the HTML for a reusable widget header.
 * @param {object} args - Arguments including t, title, showBackButton, backButtonId, menuDropdownHTML, and an optional titleId.
 * @returns {string} HTML string for the widget header.
 */
export function getWidgetHeaderHTML(args) {
    const {t, title = '', titleId, showBackButton = false, backButtonId, menuDropdownHTML = ''} = args;

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
            <div ${titleIdAttr} class="widget-header-heading">${title ?? ''}</div>
            <div class="widget-header-button">
                <button class="menu-btn-dots" aria-label="${t('ariaLabels.menuButton')}">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                </button>
                ${menuDropdownHTML}
            </div>
        </div>
    `;
}
