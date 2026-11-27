import { getWidgetHeaderHTML } from './partials/_widgetHeader';
import { getMenuDropdownHTML } from './partials/_menuDropdown';
import { escapeHtml } from '../core/legInfo';
import { resolveEndpointPrefill, resolveJourneyTitle, type JourneyEndpointRole } from '../core/journeyMode';

const ORIGIN_ICON = '<svg class="input-icon origin-dot" id="originDot" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><circle class="origin-dot-fill" cx="12" cy="12" r="5" stroke="none"></circle></svg>';
const DESTINATION_ICON = '<svg class="input-icon destination-pin" id="destinationPin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
const CLEAR_ICON = '<svg width="18.75" height="18.75" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
const LOCATION_ICON = '<svg width="18.75" height="18.75" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="3"></circle><line x1="12" y1="0" x2="12" y2="5"></line><line x1="0" y1="12" x2="5" y2="12"></line><line x1="12" y1="19" x2="12" y2="24"></line><line x1="19" y1="12" x2="24" y2="12"></line></svg>';
const SWAP_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16"/><path d="m3 8 4-4 4 4"/><path d="M17 20V4"/><path d="m21 16-4 4-4-4"/></svg>';

/** Element ids of one end of the route. The origin keeps the ids the activity form uses. */
const IDS: Record<JourneyEndpointRole, {input: string; suggestions: string; clear: string; locate: string; error: string}> = {
    origin: {input: 'originInput', suggestions: 'suggestions', clear: 'clearInputBtn', locate: 'currentLocationBtn', error: 'originError'},
    destination: {input: 'destinationInput', suggestions: 'destinationSuggestions', clear: 'destinationClearBtn', locate: 'destinationLocationBtn', error: 'destinationError'},
};

/**
 * One end of the route: an address field with autocomplete, clear and current-location
 * buttons, or - when the host locked it - the place as plain text (the same look as the
 * activity form's fixed destination). A locked end keeps a hidden input under the shared
 * id, so everything that reads the route works the same either way.
 */
function endpointHTML(args, role: JourneyEndpointRole): string {
    const {config, t} = args;
    const ids = IDS[role];
    const label = role === 'origin' ? t('origin') : t('journeyMode.destination');
    const icon = role === 'origin' ? ORIGIN_ICON : DESTINATION_ICON;
    const prefill = resolveEndpointPrefill(config, role, null);

    if (prefill.locked) {
        return `
          <div class="journey-endpoint is-locked" data-location-field="${role}">
            <div class="route-fixed">
              ${icon.replace('input-icon ', '')}
              <p class="route-fixed-name"><span class="visually-hidden">${label}: </span>${escapeHtml(prefill.text)}</p>
            </div>
            <input type="hidden" id="${ids.input}" value="${escapeHtml(prefill.text)}">
          </div>`;
    }

    const placeholder = role === 'origin' ? t('enterOrigin') : t('journeyMode.enterDestination');
    return `
          <div class="journey-endpoint" data-location-field="${role}">
            <label class="visually-hidden" for="${ids.input}">${label}</label>
            <div class="input-container">
              ${icon}
              <input type="text" class="input-field" id="${ids.input}" placeholder="${escapeHtml(placeholder)}" role="combobox" autocomplete="off" aria-autocomplete="list" aria-controls="${ids.suggestions}" aria-expanded="false" aria-describedby="${ids.error}">
              <button type="button" id="${ids.clear}" class="input-icon-btn" aria-label="${t('clearInput')}" hidden>${CLEAR_ICON}</button>
              <button type="button" id="${ids.locate}" class="input-icon-btn" aria-label="${t('useCurrentLocation')}">${LOCATION_ICON}</button>
              <div id="${ids.suggestions}" class="suggestions-container" role="listbox"></div>
            </div>
            <p id="${ids.error}" class="field-error" hidden></p>
          </div>`;
}

/**
 * Generates the form page for journey mode (`mode: 'journey'`): from, to (with a swap
 * button when both can be edited), date, time with depart/arrive, the on-demand toggle and
 * the search button. Uses the activity form's ids and classes wherever the parts are the
 * same, so the shared autocomplete, date field and search flow drive it unchanged.
 * @param {object} args - Arguments including config, t (translation function) and state.
 * @returns {string} HTML string for the form page.
 */
export function getJourneyFormPageTemplateHTML(args) {
    const {config, t, state} = args;

    const originLocked = resolveEndpointPrefill(config, 'origin', null).locked;
    const destinationLocked = resolveEndpointPrefill(config, 'destination', null).locked;
    const swappable = !originLocked && !destinationLocked;

    const menuDropdownHTML = getMenuDropdownHTML({t, dropdownId: 'formMenuDropdown', isShareDisabled: true});
    const headerHTML = getWidgetHeaderHTML({t, title: escapeHtml(resolveJourneyTitle(config, t('journeyMode.title'))), menuDropdownHTML});

    const swapHTML = swappable ? `
            <button type="button" id="swapLocationsBtn" class="journey-swap-btn" aria-label="${t('journeyMode.swap')}" title="${t('journeyMode.swap')}">${SWAP_ICON}</button>` : '';

    return `
      <div id="formPage" class="modal-page active journey-mode">
        ${headerHTML}
        <div id="infoContainer" class="info-message" style="display: none;" role="status"></div>
        <div id="formErrorContainer" class="error-message" style="display: none;" role="alert"></div>
        <div id="formDebugContainer" class="debug-container" style="display: none;"></div>
        <form class="modal-body" novalidate>
          <div class="form-section route-section journey-route${swappable ? ' has-swap' : ''}">
            <div class="journey-route-fields">
              ${endpointHTML(args, 'origin')}
              <div class="route-rail" id="routeRail" aria-hidden="true"></div>
              ${endpointHTML(args, 'destination')}
            </div>${swapHTML}
          </div>
          <div class="form-section date-section" id="dateSection">
            <p id="dateLabel" class="form-label-text">${t('journeyMode.date')}</p>
            <div class="date-area" role="group" aria-labelledby="dateLabel"></div>
            <p class="date-summary" aria-live="polite"></p>
            <p id="dateError" class="field-error" role="alert" hidden></p>
          </div>
          <div class="form-section journey-time-section">
            <label id="journeyTimeLabel" class="form-label-text" for="journeyTimeInput">${t('journeyMode.time')}</label>
            <div class="journey-time-row">
              <div class="journey-time-mode" role="radiogroup" aria-label="${t('journeyMode.timeMode')}">
                <button type="button" role="radio" class="journey-time-mode-btn" data-arrive-by="false" aria-checked="true">${t('journeyMode.depart')}</button>
                <button type="button" role="radio" class="journey-time-mode-btn" data-arrive-by="true" aria-checked="false" tabindex="-1">${t('journeyMode.arrive')}</button>
              </div>
              <input type="time" id="journeyTimeInput" class="journey-time-input" step="60" required aria-describedby="journeyTimeError">
            </div>
            <p id="journeyTimeError" class="field-error" role="alert" hidden></p>
          </div>
          <div class="form-section toggle-section">
            <label class="toggle-row" for="useFlexToggle">
              <span class="toggle-text">
                <span class="toggle-label">${t('useFlex.label')}</span>
                <span class="toggle-help">${t('useFlex.help')}</span>
              </span>
              <span class="toggle-switch">
                <input type="checkbox" id="useFlexToggle" ${state.useFlex ? 'checked' : ''}>
                <span class="toggle-slider" aria-hidden="true"></span>
              </span>
            </label>
          </div>
          <div class="form-footer">
            <button type="submit" class="btn apply-btn" id="searchBtn"><span class="btn-label">${t('search')}</span></button>
          </div>
        </form>
        <div class="widget-footer"><a href="https://zuugle-services.com" target="_new">powered by Zuugle Services</a></div>
      </div>
    `;
}
