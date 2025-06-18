/**
 * Generates the HTML for the results page.
 * @param {object} args - Arguments including config, t (translation function), state, etc.
 * @returns {string} HTML string for the results page.
 */
export function getResultsPageTemplateHTML(args) {
    const {config, t, state} = args;

    return `
      <div id="resultsPage" class="modal-page">
        <div class="modal-body-result">
          <div id="resultsErrorContainer" class="error-message" style="display: none" role="alert"></div>
          <div class="slider-wrapper etc">
            <div class="widget-header">
              <div class="widget-header-button"><button class="back-btn">☰</button></div>
              <div class="widget-header-heading">${config.activityName}</div>
            </div>
            <div id="backBtn" class="widget-response-back-button" role="button" tabindex="0"><div>←</div><div>${t('back')}</div></div>
            <div class="slider" id="topSlider" role="group" aria-label="${t('ariaLabels.topSlider')}"></div>
          </div>
          <div class="middle-box" id="responseBox" aria-live="polite">${t('loadingConnectionsI')}</div>
          <div id="activity-time" class="middle-box">${config.activityName}</div>
          <div class="middle-box" id="responseBox-bottom" aria-live="polite">${t('loadingConnectionsO')}</div>
          <div class="slider-wrapper slider-wrap-fixed">
            <div class="slider" id="bottomSlider" role="group" aria-label="${t('ariaLabels.bottomSlider')}"></div>
          </div>
          <div class="widget-footer"><a href="https://zuugle-services.com" target="_new">powered by Zuugle Services GmbH</a></div>
        </div>
      </div>
    `;
}
