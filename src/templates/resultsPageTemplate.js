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

            <!-- Persistent Header -->
            <div class="slider-wrapper etc">
                <div class="widget-header">
                    <div class="widget-header-button"><button class="back-btn">☰</button></div>
                    <div class="widget-header-heading">${config.activityName}</div>
                </div>
                <div class="results-top-bar">
                    <div id="backBtn" class="widget-response-back-button" role="button" tabindex="0"><div>←</div><div>${t('back')}</div></div>
                    <div id="toActivityDateDisplay" class="activity-date-display"></div>
                </div>
                <div class="top-slider-wrapper">
                    <div class="slider" id="topSlider" role="group" aria-label="${t('ariaLabels.topSlider')}"></div>
                </div>
            </div>

            <!-- Container for Toggled Content -->
            <div class="results-content-area">
                <!-- Detailed View Content -->
                <div id="detailedViewContainer" class="detailed-view-content">
                    <div class="middle-box" id="responseBox" aria-live="polite">${t('loadingConnectionsI')}</div>
                    <div id="activity-time" class="middle-box">${config.activityName}</div>
                    <div class="middle-box" id="responseBox-bottom" aria-live="polite">${t('loadingConnectionsO')}</div>
                </div>

                <!-- Clean View Content -->
                <div id="cleanViewContainer" class="clean-view-container"></div>
            </div>

            <!-- Persistent Footer -->
            <div class="slider-wrapper slider-wrap-fixed">
                <div class="slider detailed-view-content" id="bottomSlider" role="group" aria-label="${t('ariaLabels.bottomSlider')}"></div>
                <div class="results-bottom-bar">
                    <div class="bottom-bar-left">
                        <label class="view-toggle-switch" title="${t('toggleCompactView')}">
                            <input type="checkbox" id="toggleViewCheckbox">
                            <span class="toggle-slider">
                                <span class="toggle-icon-clean">
                                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12C3.60014 7.90264 7.33603 5 12 5C16.664 5 20.3999 7.90264 22 12C20.3999 16.0974 16.664 19 12 19C7.33603 19 3.60014 16.0974 2 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                </span>
                                <span class="toggle-icon-details">
                                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                </span>
                            </span>
                        </label>
                        <button id="shareBtn" class="share-btn" title="${t('share')}">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M18 8C19.6569 8 21 6.65685 21 5C21 3.34315 19.6569 2 18 2C16.3431 2 15 3.34315 15 5C15 6.65685 16.3431 8 18 8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M6 15C7.65685 15 9 13.6569 9 12C9 10.3431 7.65685 9 6 9C4.34315 9 3 10.3431 3 12C3 13.6569 4.34315 15 6 15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M18 22C19.6569 22 21 20.6569 21 19C21 17.3431 19.6569 16 18 16C16.3431 16 15 17.3431 15 19C15 20.6569 16.3431 22 18 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M8.59003 13.51L15.42 17.49" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M15.41 6.51001L8.59003 10.49" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                    <div id="fromActivityDateDisplay" class="activity-date-display"></div>
                </div>
            </div>
            <div class="widget-footer"><a href="https://zuugle-services.com" target="_new">powered by Zuugle Services GmbH</a></div>
        </div>
      </div>
    `;
}
