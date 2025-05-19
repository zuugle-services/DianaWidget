/**
 * Generates the HTML for the menu page.
 * @param {object} args - Arguments including config, t (translation function), state, etc.
 * @returns {string} HTML string for the menu page.
 */
export function getMenuPageTemplateHTML(args) {
    const { t } = args;

    return `
      <div id="menuPage" class="modal-page">
        <div class="widget-header">
          <div class="widget-header-button">
            <button class="back-btn" id="menuPageHamburgerBtn" aria-label="${t('ariaLabels.menuButton')}">☰</button>
          </div>
          <div class="widget-header-heading"></div> <div class="widget-header-button">
            <button class="close-btn" id="menuPageCloseBtn" aria-label="${t('ariaLabels.closeButton')}">✕</button>
          </div>
        </div>
        <div class="modal-body menu-body">
          <ul class="menu-list">
            <li class="menu-item" data-content-key="help">${t('menu.helpAndSupport')}</li>
            <li class="menu-item" data-content-key="contact">${t('menu.contact')}</li>
            <li class="menu-item" data-content-key="legal">${t('menu.legal')}</li>
          </ul>
        </div>
        <div class="widget-footer"><a href="https://zuugle-services.com" target="_new">powered by Zuugle Services GmbH</a></div>
      </div>
    `;
}