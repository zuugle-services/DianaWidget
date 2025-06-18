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
            <div class="results-top-bar">
                <div id="backBtn" class="widget-response-back-button" role="button" tabindex="0"><div>←</div><div>${t('back')}</div></div>
                <div id="toActivityDateDisplay" class="activity-date-display"></div>
            </div>
            <div class="slider" id="topSlider" role="group" aria-label="${t('ariaLabels.topSlider')}"></div>
          </div>
          <div class="middle-box" id="responseBox" aria-live="polite">${t('loadingConnectionsI')}</div>
          <div id="activity-time" class="middle-box">${config.activityName}</div>
          <div class="middle-box" id="responseBox-bottom" aria-live="polite">${t('loadingConnectionsO')}</div>
          <div class="slider-wrapper slider-wrap-fixed">
            <div class="slider" id="bottomSlider" role="group" aria-label="${t('ariaLabels.bottomSlider')}"></div>
            <div class="results-bottom-bar">
                <button id="toggleViewBtn" class="widget-view-toggle-button" title="${t('toggleCompactView')}" aria-label="${t('toggleCompactView')}">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12C3.60014 7.90264 7.33603 5 12 5C16.664 5 20.3999 7.90264 22 12C20.3999 16.0974 16.664 19 12 19C7.33603 19 3.60014 16.0974 2 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <div id="fromActivityDateDisplay" class="activity-date-display"></div>
            </div>
          </div>
          <div class="widget-footer"><a href="https://zuugle-services.com" target="_new">powered by Zuugle Services GmbH</a></div>
        </div>
      </div>
    `;
}
