import { getWidgetHeaderHTML } from './partials/_widgetHeader';
import { getMenuDropdownHTML } from './partials/_menuDropdown';

/**
 * Generates the HTML for the results page.
 * @param {object} args - Arguments including config, t (translation function), state, etc.
 * @returns {string} HTML string for the results page.
 */
export function getResultsPageTemplateHTML(args) {
    const {config, t} = args;

    const menuDropdownHTML = getMenuDropdownHTML({t, dropdownId: 'resultsMenuDropdown', isShareDisabled: false});
    const headerHTML = getWidgetHeaderHTML({t, title: config.activityName, showBackButton: true, backButtonId: 'backBtn', menuDropdownHTML});

    return `
      <div id="resultsPage" class="modal-page">
        <div class="modal-body-result">
            <div id="resultsErrorContainer" class="error-message" style="display: none" role="alert"></div>
            <div id="resultsDebugContainer" class="debug-container" style="display: none;"></div>

            <!-- Persistent Header -->
            <div class="slider-wrapper etc">
                ${headerHTML}
                <div class="top-slider-wrapper">
                    <div class="slider" id="topSlider" role="group" aria-label="${t('ariaLabels.topSlider')}"></div>
                </div>
            </div>

            <!-- Container for Toggled Content -->
            <div class="results-content-area">
                <div class="collapsible-container" id="collapsibleToActivity">
                    <div class="collapsible-header">
                        <div class="summary-content-wrapper">
                            <!-- Populated by JS -->
                        </div>
                    </div>
                    <div class="collapsible-content">
                        <div class="middle-box-content" id="responseBox" aria-live="polite"></div>
                    </div>
                    <svg class="accordion-icon" width="16" height="16" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="m16.354 5.075-7.855 7.854L.646 5.075l.707-.707 7.145 7.146 7.148-7.147z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>

                <div id="activity-time" class="middle-box">${config.activityName}</div>

                <div class="collapsible-container" id="collapsibleFromActivity">
                    <div class="collapsible-header">
                        <div class="summary-content-wrapper">
                            <!-- Populated by JS -->
                        </div>
                    </div>
                    <div class="collapsible-content">
                        <div class="middle-box-content" id="responseBox-bottom" aria-live="polite"></div>
                    </div>
                    <svg class="accordion-icon" width="16" height="16" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="m16.354 5.075-7.855 7.854L.646 5.075l.707-.707 7.145 7.146 7.148-7.147z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
            </div>

            <!-- Persistent Footer -->
            <div class="slider-wrapper slider-wrap-fixed">
                <div class="slider" id="bottomSlider" role="group" aria-label="${t('ariaLabels.bottomSlider')}"></div>
            </div>
            <div class="widget-footer"><a href="https://zuugle-services.com" target="_new">powered by Zuugle Services</a></div>
        </div>
      </div>
    `;
}
