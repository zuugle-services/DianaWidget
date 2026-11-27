import { getWidgetHeaderHTML } from './partials/_widgetHeader';
import { getMenuDropdownHTML } from './partials/_menuDropdown';
import { getResultsSkeletonHTML } from './partials/_resultsSkeleton';
import { resolveActivityName } from '../utils';
import { escapeHtml } from '../core/legInfo';
import { isJourneyMode, resolveJourneyTitle } from '../core/journeyMode';

/**
 * Generates the HTML for the results page.
 * @param {object} args - Arguments including config, t (translation function), state, etc.
 * @returns {string} HTML string for the results page.
 */
export function getResultsPageTemplateHTML(args) {
    const {config, t} = args;

    // Journey mode has no activity to share: a share link replays an activity search.
    const journey = isJourneyMode(config);
    const title = journey ? escapeHtml(resolveJourneyTitle(config, t('journeyMode.title'))) : resolveActivityName(config) ?? '';
    const menuDropdownHTML = getMenuDropdownHTML({t, dropdownId: 'resultsMenuDropdown', isShareDisabled: !config.share || journey});
    const headerHTML = getWidgetHeaderHTML({t, title, showBackButton: true, backButtonId: 'backBtn', menuDropdownHTML});
    // Journey mode: which route and time the connections below are for (filled by JS).
    const routeSummaryHTML = journey ? '<div id="journeyRouteSummary" class="journey-route-summary" aria-live="polite"></div>' : '';
    const topSliderLabel = journey ? t('journeyMode.connectionsSlider') : t('ariaLabels.topSlider');

    return `
      <div id="resultsPage" class="modal-page${journey ? ' journey-mode' : ''}">
        <div class="modal-body-result">
            <div id="resultsErrorContainer" class="error-message" style="display: none" role="alert"></div>
            <div id="resultsInfoContainer" class="info-message" style="display: none" role="status"></div>
            <div id="resultsDebugContainer" class="debug-container" style="display: none;"></div>

            <!-- Persistent Header -->
            <div class="slider-wrapper etc">
                ${headerHTML}
                ${routeSummaryHTML}
                <div class="top-slider-wrapper">
                    <div class="slider" id="topSlider" role="group" aria-label="${topSliderLabel}"></div>
                </div>
            </div>

            ${getResultsSkeletonHTML({t})}

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
                    <svg class="accordion-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>
                </div>

                <div id="shareInfoBanner" class="share-info-banner" style="display:none"></div>

                <div id="activity-time" class="middle-box"></div>

                <div class="collapsible-container" id="collapsibleFromActivity">
                    <div class="collapsible-header">
                        <div class="summary-content-wrapper">
                            <!-- Populated by JS -->
                        </div>
                    </div>
                    <div class="collapsible-content">
                        <div class="middle-box-content" id="responseBox-bottom" aria-live="polite"></div>
                    </div>
                    <svg class="accordion-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>
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
