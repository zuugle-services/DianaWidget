import { getWidgetHeaderHTML } from './partials/_widgetHeader';
import { getMenuDropdownHTML } from './partials/_menuDropdown';
import { firstNonBlank, resolveActivityName } from '../utils';
import { getDateFieldMode } from '../core/dateSelection';

/**
 * Generates the HTML for the form page.
 *
 * Origin and destination read as one route: the origin field, a short line, and the
 * destination (fixed by the activity, so shown as text rather than a disabled field).
 * The date field's contents (day strip or locked date) are rendered by DateField.
 * @param {object} args - Arguments including config, t (translation function), state, etc.
 * @returns {string} HTML string for the form page.
 */
export function getFormPageTemplateHTML(args) {
    const {config, t, state} = args;

    const dateMode = getDateFieldMode(config);
    const dateLabel = !config.multiday
        ? t('activityDate')
        : dateMode.locked ? t('tripDates') : t('tripDatesHint');
    const dateSectionHTML = dateMode.hidden ? '' : `
          <div class="form-section date-section" id="dateSection">
            <p id="dateLabel" class="form-label-text">${dateLabel}</p>
            <div class="date-area" role="group" aria-labelledby="dateLabel"></div>
            <p class="date-summary" aria-live="polite"></p>
            <p id="dateError" class="field-error" role="alert" hidden></p>
          </div>`;

    const destinationName = firstNonBlank(config.destinationInputName, config.activityName, config.activityStartLocationDisplayName, config.activityStartLocation) ?? '';

    const menuDropdownHTML = getMenuDropdownHTML({t, dropdownId: 'formMenuDropdown', isShareDisabled: true});
    const headerHTML = getWidgetHeaderHTML({t, title: resolveActivityName(config) ?? '', menuDropdownHTML});

    return `
      <div id="formPage" class="modal-page active">
        ${headerHTML}
        <div id="infoContainer" class="info-message" style="display: none;" role="status"></div>
        <div id="formErrorContainer" class="error-message" style="display: none;" role="alert"></div>
        <div id="formDebugContainer" class="debug-container" style="display: none;"></div>
        <form class="modal-body" aria-labelledby="formHeading" novalidate>
          <div class="form-section route-section">
            <label id="originLabel" class="form-label-text" for="originInput">${t('origin')}</label>
            <div class="input-container">
              <svg class="input-icon origin-dot" id="originDot" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><circle class="origin-dot-fill" cx="12" cy="12" r="5" stroke="none"></circle></svg>
              <input type="text" class="input-field" id="originInput" placeholder="${t('enterOrigin')}" value="${config.userStartLocationDefault || ''}" role="combobox" autocomplete="off" aria-autocomplete="list" aria-controls="suggestions" aria-expanded="false" aria-describedby="originError">
              <button type="button" id="clearInputBtn" class="input-icon-btn" aria-label="${t('clearInput')}" hidden>
                <svg width="18.75" height="18.75" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              <button type="button" id="currentLocationBtn" class="input-icon-btn" aria-label="${t('useCurrentLocation')}">
                <svg width="18.75" height="18.75" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="3"></circle><line x1="12" y1="0" x2="12" y2="5"></line><line x1="0" y1="12" x2="5" y2="12"></line><line x1="12" y1="19" x2="12" y2="24"></line><line x1="19" y1="12" x2="24" y2="12"></line></svg>
              </button>
              <div id="suggestions" class="suggestions-container" role="listbox"></div>
            </div>
            <p id="originError" class="field-error" hidden></p>
            <div class="route-rail" id="routeRail" aria-hidden="true"></div>
            <div class="route-destination">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              <p class="route-destination-name"><span class="visually-hidden">${t('destination')}: </span><span id="destinationName">${destinationName}</span></p>
            </div>
          </div>
          ${dateSectionHTML}
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
