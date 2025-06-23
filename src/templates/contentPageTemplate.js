/**
 * Generates the HTML for a generic content page.
 * @param {object} args - Arguments including config, t (translation function), state, etc.
 * @returns {string} HTML string for the content page.
 */
export function getContentPageTemplateHTML(args) {
    const {t} = args;

    return `
      <div id="contentPage" class="modal-page">
        <div class="widget-header">
            <div class="widget-header-button">
                 <button id="contentPageBackBtn" class="back-btn-arrow" aria-label="${t('ariaLabels.backButton')}">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
            <div id="contentPageTitle" class="widget-header-heading"></div>
            <div class="widget-header-button">
                 <button class="menu-btn-dots" aria-label="${t('ariaLabels.menuButton')}">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 5.25C12.6904 5.25 13.25 4.69036 13.25 4C13.25 3.30964 12.6904 2.75 12 2.75C11.3096 2.75 10.75 3.30964 10.75 4C10.75 4.69036 11.3096 5.25 12 5.25Z" fill="currentColor"/>
                        <path d="M12 12.25C12.6904 12.25 13.25 11.6904 13.25 11C13.25 10.3096 12.6904 9.75 12 9.75C11.3096 9.75 10.75 10.3096 10.75 11C10.75 11.6904 11.3096 12.25 12 12.25Z" fill="currentColor"/>
                        <path d="M12 19.25C12.6904 19.25 13.25 18.6904 13.25 18C13.25 17.3096 12.6904 16.75 12 16.75C11.3096 16.75 10.75 17.3096 10.75 18C10.75 18.6904 11.3096 19.25 12 19.25Z" fill="currentColor"/>
                    </svg>
                </button>
                <div class="menu-dropdown" id="contentMenuDropdown" style="display: none;">
                    <a href="#" class="menu-dropdown-item disabled" id="shareMenuItem">
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
                    <a href="#" class="menu-dropdown-item" data-content-key="legal">
                         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zM11 17.93c-3.14-.9-5-4.04-5-7.93v-3.69l5-2.25v13.87zM18 10c0 3.89-1.86 7.03-5 7.93V8.1l5-2.25v4.15z" fill="currentColor"/>
                        </svg>
                        <span>${t('menu.legal')}</span>
                    </a>
                </div>
            </div>
        </div>
        <div id="contentPageBody" class="modal-body content-page-body">
        </div>
        <div class="widget-footer"><a href="https://zuugle-services.com" target="_new">powered by Zuugle Services GmbH</a></div>
      </div>
    `;
}
