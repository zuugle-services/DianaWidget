import { getWidgetHeaderHTML } from './partials/_widgetHeader.js';
import { getMenuDropdownHTML } from './partials/_menuDropdown.js';

/**
 * Generates the HTML for the form page.
 * @param {object} args - Arguments including config, t (translation function), state, etc.
 * @returns {string} HTML string for the form page.
 */
export function getFormPageTemplateHTML(args) {
    const {config, t, state, formatDateForDisplay, formatDatetime} = args;

    const datesFullyDeterminedByFixedDurationAndOverride =
        config.multiday &&
        config.activityDurationDaysFixed &&
        (config.overrideActivityStartDate || config.overrideActivityEndDate);

    const showStartDateInput = !config.overrideActivityStartDate && !datesFullyDeterminedByFixedDurationAndOverride;
    const showEndDateInput = config.multiday && !config.overrideActivityEndDate && !datesFullyDeterminedByFixedDurationAndOverride;
    const showAnyDateSection = config.multiday || !config.overrideActivityStartDate || datesFullyDeterminedByFixedDurationAndOverride;

    let dateSectionHTML = '';
    if (showAnyDateSection) {
        dateSectionHTML += `<div class="form-section date-section-wrapper">`;
        if (config.multiday) {
            if (showStartDateInput) {
                dateSectionHTML += `
                  <div class="date-input-column">
                    <p id="dateLabelStart">${t('activityStartDateLabel')}</p>
                    <div class="date-input-container" role="button" aria-labelledby="dateLabelStart" tabindex="0">
                      <div class="date-input">
                        <svg class="date-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span id="dateDisplayStart" class="date-input-display placeholder">${t('selectDate')}</span>
                        <svg class="date-input-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </div>
                      <input type="date" id="activityDateStart" class="native-date-picker-multiday" aria-hidden="true">
                    </div>
                  </div>`;
            } else if (config.overrideActivityStartDate || datesFullyDeterminedByFixedDurationAndOverride) {
                dateSectionHTML += `
                 <div class="date-input-column">
                   <p id="dateLabelStart">${t('activityStartDateLabel')}</p>
                   <div class="date-input-container disabled" role="button" tabindex="-1">
                     <div class="date-input">
                       <svg class="date-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                         <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                       </svg>
                       <span id="dateDisplayStart" class="date-input-display">${state.selectedDate ? formatDateForDisplay(state.selectedDate, {EN: 'en-GB', DE: 'de-DE', FR: 'fr-FR', IT: 'it-IT', TH: 'th-TH', ES: 'es-ES'}[this.config.language] || (this.config.language ? `${this.config.language.toLowerCase()}-${this.config.language.toUpperCase()}` : 'en-GB'), config.timezone) : t('selectDate')}</span>
                     </div>
                     <input type="date" id="activityDateStart" class="native-date-picker-multiday" style="display:none !important;" aria-hidden="true" value="${state.selectedDate ? formatDatetime(state.selectedDate) : ''}">
                   </div>
                 </div>`;
            }

            if (showEndDateInput) {
                dateSectionHTML += `
                  <div class="date-input-column">
                    <p id="dateLabelEnd">${t('activityEndDateLabel')}</p>
                    <div class="date-input-container" role="button" aria-labelledby="dateLabelEnd" tabindex="0">
                      <div class="date-input">
                        <svg class="date-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                           <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span id="dateDisplayEnd" class="date-input-display placeholder">${t('selectDate')}</span>
                        <svg class="date-input-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </div>
                      <input type="date" id="activityDateEnd" class="native-date-picker-multiday" aria-hidden="true">
                    </div>
                  </div>`;
            } else if (config.multiday && (config.overrideActivityEndDate || datesFullyDeterminedByFixedDurationAndOverride)) {
                dateSectionHTML += `
                <div class="date-input-column">
                  <p id="dateLabelEnd">${t('activityEndDateLabel')}</p>
                  <div class="date-input-container disabled" role="button" tabindex="-1">
                    <div class="date-input">
                      <svg class="date-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      <span id="dateDisplayEnd" class="date-input-display">${state.selectedEndDate ? formatDateForDisplay(state.selectedEndDate, {EN: 'en-GB', DE: 'de-DE', FR: 'fr-FR', IT: 'it-IT', TH: 'th-TH', ES: 'es-ES'}[this.config.language] || (this.config.language ? `${this.config.language.toLowerCase()}-${this.config.language.toUpperCase()}` : 'en-GB'), config.timezone) : t('selectDate')}</span>
                    </div>
                    <input type="date" id="activityDateEnd" class="native-date-picker-multiday" style="display:none !important;" aria-hidden="true" value="${state.selectedEndDate ? formatDatetime(state.selectedEndDate) : ''}">
                  </div>
                </div>`;
            }
        } else { // Single day
            if (showStartDateInput) { // Not overridden
                dateSectionHTML += `
                  <div class="date-input-column single">
                    <p id="dateLabel">${t('activityDate')}</p>
                    <div class="date-selector-buttons" role="group" aria-labelledby="dateLabel">
                        <button type="button" id="dateBtnToday" class="date-selector-btn">${t('today')}</button>
                        <button type="button" id="dateBtnTomorrow" class="date-selector-btn">${t('tomorrow')}</button>
                        <button type="button" id="dateBtnOther" class="date-selector-btn">
                            <span id="otherDateText">${t('otherDate')}</span>
                            <svg class="date-input-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                    </div>
                    <input type="date" id="activityDate" class="native-date-picker-single" aria-hidden="true" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;">
                  </div>`;
            } else if (config.overrideActivityStartDate) { // Overridden single day
                dateSectionHTML += `
                  <div class="date-input-column single">
                    <p id="dateLabel">${t('activityDate')}</p>
                    <div class="date-input-container disabled" role="button" aria-labelledby="dateLabel" tabindex="-1">
                      <div class="date-input">
                         <svg class="date-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                           <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                         </svg>
                        <span id="dateDisplay" class="date-input-display">${state.selectedDate ? formatDateForDisplay(state.selectedDate, {EN: 'en-GB', DE: 'de-DE', FR: 'fr-FR', IT: 'it-IT', TH: 'th-TH', ES: 'es-ES'}[this.config.language] || (this.config.language ? `${this.config.language.toLowerCase()}-${this.config.language.toUpperCase()}` : 'en-GB'), config.timezone) : t('selectDate')}</span>
                      </div>
                      <input type="date" id="activityDate" class="native-date-picker-single" aria-hidden="true" style="display:none !important;" value="${state.selectedDate ? formatDatetime(state.selectedDate, config.timezone) : ''}">
                    </div>
                  </div>`;
            }
        }
        dateSectionHTML += `</div>`;
    }

    const menuDropdownHTML = getMenuDropdownHTML({t, dropdownId: 'formMenuDropdown', isShareDisabled: true});
    const headerHTML = getWidgetHeaderHTML({t, title: config.activityName, menuDropdownHTML});

    return `
      <div id="formPage" class="modal-page active">
        ${headerHTML}
        <div id="infoContainer" class="info-message" style="display: none;" role="status"></div>
        <div id="formErrorContainer" class="error-message" style="display: none;" role="alert"></div>
        <form class="modal-body" aria-labelledby="formHeading">
          <div style="position:relative" class="form-section">
            <p id="originLabel">${t('origin')}</p>
            <div class="input-container">
              <svg class="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>
              <input type="text" class="input-field" id="originInput" placeholder="${t('enterOrigin')}" value="${config.userStartLocationDefault || ''}" aria-labelledby="originLabel">
              <svg id="clearInputBtn" class="input-icon-right" style="pointer-events: auto; cursor: pointer; display: none;" width="18.75" height="18.75" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="${t('clearInput')}" role="button">
                <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              <svg id="currentLocationBtn" class="input-icon-right" style="pointer-events: auto; cursor: pointer;" width="18.75" height="18.75" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="${t('useCurrentLocation')}" role="button">
                <circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="3"></circle><line x1="12" y1="0" x2="12" y2="5"></line><line x1="0" y1="12" x2="5" y2="12"></line><line x1="12" y1="19" x2="12" y2="24"></line><line x1="19" y1="12" x2="24" y2="12"></line>
              </svg>
            </div>
            <div id="suggestions" class="suggestions-container" role="listbox"></div>
          </div>
          <div class="form-section">
            <p id="destinationLabel">${t('destination')}</p>
            <div class="input-container">
              <svg class="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              <input type="text" class="input-field disabled" id="destinationInput" placeholder="${t('destination')}" value="${config.destinationInputName || config.activityName}" readonly aria-labelledby="destinationLabel">
            </div>
          </div>
          ${dateSectionHTML}
          <div class="form-footer">
            <button type="submit" class="btn apply-btn" id="searchBtn">${t('search')}</button>
          </div>
        </form>
        <div class="widget-footer"><a href="https://zuugle-services.com" target="_new">powered by Zuugle Services GmbH</a></div>
      </div>
    `;
}
