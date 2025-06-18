/**
 * Generates the HTML for the menu modal.
 * @param {object} args - Arguments including t (translation function).
 * @returns {string} HTML string for the menu modal.
 */
export function getMenuPageTemplateHTML(args) {
    const {t} = args;
    return `
      <div id="menuModalOverlay" class="menu-modal-overlay">
        <div class="menu-modal">
          <div class="range-calendar-header">
            <h3>${t('ariaLabels.menuHeading')}</h3>
            <button type="button" class="range-calendar-close-btn" id="menuModalCloseBtn" aria-label="${t('ariaLabels.closeButton')}">&times;</button>
          </div>
          <div class="menu-modal-body">
            <ul id="menuList" class="menu-list">
              <li class="menu-item" data-content-key="help">${t('menu.helpAndSupport')}</li>
              <li class="menu-item" data-content-key="legal">${t('menu.legal')}</li>
            </ul>
          </div>
          <!-- <div class="widget-footer">
            <a href="https://zuugle-services.com" target="_new">powered by Zuugle Services GmbH</a>
          </div> -->
        </div>
      </div>
    `;
}