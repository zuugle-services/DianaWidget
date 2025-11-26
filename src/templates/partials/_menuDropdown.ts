/**
 * Generates the HTML for a reusable menu dropdown.
 * @param {object} args - Arguments including t (translation function), dropdownId, and isShareDisabled.
 * @returns {string} HTML string for the menu dropdown.
 */
export function getMenuDropdownHTML(args) {
    const {t, dropdownId, isShareDisabled = false} = args;
    const shareClass = isShareDisabled ? 'disabled' : '';

    return `
        <div class="menu-dropdown" id="${dropdownId}" style="display: none;">
            <a href="#" class="menu-dropdown-item ${shareClass}" id="shareMenuItem">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 8C19.6569 8 21 6.65685 21 5C21 3.34315 19.6569 2 18 2C16.3431 2 15 3.34315 15 5C15 6.65685 16.3431 8 18 8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M6 15C7.65685 15 9 13.6569 9 12C9 10.3431 7.65685 9 6 9C4.34315 9 3 10.3431 3 12C3 13.6569 4.34315 15 6 15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M18 22C19.6569 22 21 20.6569 21 19C21 17.3431 19.6569 16 18 16C16.3431 16 15 17.3431 15 19C15 20.6904 16.3431 22 18 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M8.59003 13.51L15.42 17.49" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M15.41 6.51001L8.59003 10.49" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>${t('share')}</span>
            </a>
            <a href="#" class="menu-dropdown-item" data-content-key="help">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" fill="currentColor"/>
                </svg>
                <span>${t('menu.helpAndSupport')}</span>
            </a>
            <a href="https://zuugle-services.com/en/imprint/" target="_blank" rel="noopener noreferrer" class="menu-dropdown-item" id="imprintMenuItem">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zM11 17.93c-3.14-.9-5-4.04-5-7.93v-3.69l5-2.25v13.87zM18 10c0 3.89-1.86 7.03-5 7.93V8.1l5-2.25v4.15z" fill="currentColor"/>
                </svg>
                <span>${t('menu.imprint')}</span>
            </a>
        </div>
    `;
}
