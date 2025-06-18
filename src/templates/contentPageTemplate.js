/**
 * Generates the HTML for a generic content page.
 * @param {object} args - Arguments including config, t (translation function), state, etc.
 * @returns {string} HTML string for the content page.
 */
export function getContentPageTemplateHTML(args) {
    const {t, state} = args;
    // Determine title based on state.currentContentKey
    let pageTitle = '';
    // Placeholder for content based on state.currentContentKey
    let pageContent = '';

    // This is a basic structure. The actual content will be set dynamically in widget.js
    // based on state.currentContentKey.
    // For now, we just provide a container.

    return `
      <div id="contentPage" class="modal-page">
        <div class="widget-header">
          <div class="widget-header-button">
            <button class="back-btn" id="contentPageHamburgerBtn" aria-label="${t('ariaLabels.menuButton')}">☰</button>
          </div>
          <div id="contentPageTitle" class="widget-header-heading"></div> <div class="widget-header-button">
            <button class="close-btn" id="contentPageCloseBtn" aria-label="${t('ariaLabels.closeButton')}">✕</button>
          </div>
        </div>
        <div id="contentPageBody" class="modal-body content-page-body">
          </div>
        <div class="widget-footer"><a href="https://zuugle-services.com" target="_new">powered by Zuugle Services GmbH</a></div>
      </div>
    `;
}