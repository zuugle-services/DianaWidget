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
                // Display for overridden or fixed start date in multiday
                dateSectionHTML += `
                 <div class="date-input-column">
                   <p id="dateLabelStart">${t('activityStartDateLabel')}</p>
                   <div class="date-input-container disabled" role="button" tabindex="-1">
                     <div class="date-input">
                       <svg class="date-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                         <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                       </svg>
                       <span id="dateDisplayStart" class="date-input-display">${state.selectedDate ? formatDateForDisplay(state.selectedDate, config.language === 'DE' ? 'de-DE' : 'en-GB', config.timezone) : t('selectDate')}</span>
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
                // Display for overridden or fixed end date in multiday
                dateSectionHTML += `
                <div class="date-input-column">
                  <p id="dateLabelEnd">${t('activityEndDateLabel')}</p>
                  <div class="date-input-container disabled" role="button" tabindex="-1">
                    <div class="date-input">
                      <svg class="date-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      <span id="dateDisplayEnd" class="date-input-display">${state.selectedEndDate ? formatDateForDisplay(state.selectedEndDate, config.language === 'DE' ? 'de-DE' : 'en-GB', config.timezone) : t('selectDate')}</span>
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
                        <span id="dateDisplay" class="date-input-display">${state.selectedDate ? formatDateForDisplay(state.selectedDate, config.language === 'DE' ? 'de-DE' : 'en-GB', config.timezone) : t('selectDate')}</span>
                      </div>
                      <input type="date" id="activityDate" class="native-date-picker-single" aria-hidden="true" style="display:none !important;" value="${state.selectedDate ? formatDatetime(state.selectedDate, config.timezone) : ''}">
                    </div>
                  </div>`;
            }
        }
        dateSectionHTML += `</div>`;
    }

    return `
      <div id="formPage" class="modal-page active">
        <div class="widget-header">
            <div class="widget-header-button">
                <!-- Empty Spacer -->
            </div>
            <div class="widget-header-heading">${config.activityName}</div>
            <div class="widget-header-button">
                <button class="menu-btn-dots" aria-label="${t('ariaLabels.menuButton')}">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 5.25C12.6904 5.25 13.25 4.69036 13.25 4C13.25 3.30964 12.6904 2.75 12 2.75C11.3096 2.75 10.75 3.30964 10.75 4C10.75 4.69036 11.3096 5.25 12 5.25Z" fill="currentColor"/>
                        <path d="M12 12.25C12.6904 12.25 13.25 11.6904 13.25 11C13.25 10.3096 12.6904 9.75 12 9.75C11.3096 9.75 10.75 10.3096 10.75 11C10.75 11.6904 11.3096 12.25 12 12.25Z" fill="currentColor"/>
                        <path d="M12 19.25C12.6904 19.25 13.25 18.6904 13.25 18C13.25 17.3096 12.6904 16.75 12 16.75C11.3096 16.75 10.75 17.3096 10.75 18C10.75 18.6904 11.3096 19.25 12 19.25Z" fill="currentColor"/>
                    </svg>
                </button>
                <div class="menu-dropdown" id="formMenuDropdown" style="display: none;">
                    <a href="#" class="menu-dropdown-item disabled" id="shareMenuItem">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 8C19.6569 8 21 6.65685 21 5C21 3.34315 19.6569 2 18 2C16.3431 2 15 3.34315 15 5C15 6.65685 16.3431 8 18 8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M6 15C7.65685 15 9 13.6569 9 12C9 10.3431 7.65685 9 6 9C4.34315 9 3 10.3431 3 12C3 13.6569 4.34315 15 6 15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M18 22C19.6569 22 21 20.6569 21 19C21 17.3431 19.6569 16 18 16C16.3431 16 15 17.3431 15 19C15 20.6904 16.3431 22 18 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M8.59003 13.51L15.42 17.49" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M15.41 6.51001L8.59003 10.49" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>${t('share')}</span>
                    </a>
                    <a href="#" class="menu-dropdown-item" data-content-key="help">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" fill="currentColor"/>
                        </svg>
                        <span>${t('menu.helpAndSupport')}</span>
                    </a>
                    <a href="#" class="menu-dropdown-item" data-content-key="legal">
                         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zM11 17.93c-3.14-.9-5-4.04-5-7.93v-3.69l5-2.25v13.87zM18 10c0 3.89-1.86 7.03-5 7.93V8.1l5-2.25v4.15z" fill="currentColor"/>
                        </svg>
                        <span>${t('menu.legal')}</span>
                    </a>
                </div>
            </div>
        </div>
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
