/**
 * Generates the HTML for the menu modal.
 * @param {object} args - Arguments including t (translation function).
 * @returns {string} HTML string for the menu modal.
 */
export function getMenuPageTemplateHTML(args) {
    const {t} = args;
    // This template creates a modal overlay that is initially hidden.
    // It's styled to have better visual hierarchy and affordance.
    return `
      <div id="menuModalOverlay" class="menu-modal-overlay">
        <div class="menu-modal">
          <div class="range-calendar-header">
            <h3>${t('ariaLabels.menuHeading')}</h3>
            <button type="button" class="range-calendar-close-btn" id="menuModalCloseBtn" aria-label="${t('ariaLabels.closeButton')}">&times;</button>
          </div>
          <div class="menu-modal-body">
            <ul id="menuList" class="menu-list">
              <li class="menu-item" data-content-key="help" tabindex="0" role="button">
                <div class="menu-item-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" fill="var(--text-tertiary)"/>
                  </svg>
                </div>
                <div class="menu-item-text">
                  <span class="menu-item-title">${t('menu.helpAndSupport')}</span>
                  <span class="menu-item-subtitle">${t('menu.helpAndSupportSubtitle')}</span>
                </div>
                <div class="menu-item-chevron">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 12L10 8L6 4" stroke="var(--text-disabled)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
              </li>
              <li class="menu-item" data-content-key="legal" tabindex="0" role="button">
                <div class="menu-item-icon">
                   <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zM11 17.93c-3.14-.9-5-4.04-5-7.93v-3.69l5-2.25v13.87zM18 10c0 3.89-1.86 7.03-5 7.93V8.1l5-2.25v4.15z" fill="var(--text-tertiary)"/>
                  </svg>
                </div>
                <div class="menu-item-text">
                  <span class="menu-item-title">${t('menu.legal')}</span>
                  <span class="menu-item-subtitle">${t('menu.legalSubtitle')}</span>
                </div>
                <div class="menu-item-chevron">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 12L10 8L6 4" stroke="var(--text-disabled)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    `;
}