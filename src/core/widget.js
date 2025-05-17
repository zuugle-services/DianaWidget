import styles from '!!css-loader?{"sourceMap":false,"exportType":"string"}!./styles/widget.css'
import { DateTime } from 'luxon';
import translations from '../translations';
import { SingleCalendar, RangeCalendarModal } from "./calendar";
import {
    getMonthName,
    getShortDayName,
    formatDateForDisplay,
    throttle,
    debounce,
    getApiErrorTranslationKey
} from '../utils';
import {
    calculateInitialStartDate,
    convertLocalTimeToUTC,
    convertLocalTimeToUTCDatetime,
    convertConfigTimeToLocalTime,
    convertUTCToLocalTime,
    calculateTimeDifference,
    addMinutesToDate,
    getLaterTime,
    getEarlierTime,
    calculateDurationLocalWithDates,
    getTimeFormatFromMinutes,
    formatDatetime,
    parseDurationToMinutes,
    formatLegDateForDisplay,
    formatFullDateForDisplay
} from '../datetimeUtils';

export default class DianaWidget {
  defaultConfig = {
    activityName: "[Activity Name]",
    activityType: "[Activity Type]",
    requiredFields: [
      'activityStartLocation',
      'activityStartLocationType',
      'activityEndLocation',
      'activityEndLocationType',
      'activityEarliestStartTime',
      'activityLatestStartTime',
      'activityEarliestEndTime',
      'activityLatestEndTime',
      'activityDurationMinutes'
    ],
    activityStartLocationDisplayName: null,
    activityEndLocationDisplayName: null,
    timezone: "Europe/Vienna",
    activityStartTimeLabel: null,
    activityEndTimeLabel: null,
    apiBaseUrl: "https://api.zuugle-services.net",
    apiToken: "development-token",
    language: 'EN',
    cacheUserStartLocation: true,
    userStartLocationCacheTTLMinutes: 15,
    overrideUserStartLocation: null,
    overrideUserStartLocationType: null,
    displayStartDate: null,
    displayEndDate: null,
    destinationInputName: null,
    multiday: false,
    overrideActivityStartDate: null,
    overrideActivityEndDate: null,
    activityDurationDaysFixed: null
  };

  constructor(config = {}, containerId = "dianaWidgetContainer") {
    try {
      this.config = this.validateConfig(config);
      this.container = document.getElementById(containerId);

      if (this.config.displayStartDate || this.config.displayEndDate) {
        const now = DateTime.now().startOf('day');
        let startDate = null;
        let endDate = null;

        if (this.config.displayStartDate) {
          startDate = DateTime.fromISO(this.config.displayStartDate).startOf('day');
        }
        if (this.config.displayEndDate) {
          endDate = DateTime.fromISO(this.config.displayEndDate).startOf('day');
        }

        let shouldDisplay = true;
        if (startDate && now < startDate) {
          shouldDisplay = false;
        }
        if (endDate && now > endDate) {
          shouldDisplay = false;
        }

        if (!shouldDisplay) {
          if (this.container) {
            this.container.innerHTML = '';
          }
          console.info(`DianaWidget: Current date is outside the display range (${this.config.displayStartDate || 'N/A'} - ${this.config.displayEndDate || 'N/A'}). Widget will not be displayed.`);
          return;
        }
      }

      this.CACHE_KEY_USER_START_LOCATION = containerId+'_userStartLocation';

      let style = document.createElement('style');
      style.innerHTML = `
          #${containerId} {
            max-height: 790px;
          }
      `;
      document.body.appendChild(style);

      let initialSelectedStartDate;
      let initialSelectedEndDate = null;

      if (this.config.multiday && this.config.activityDurationDaysFixed) {
        if (this.config.overrideActivityEndDate) {
            try {
                const endDt = DateTime.fromISO(this.config.overrideActivityEndDate, { zone: 'utc' });
                initialSelectedEndDate = endDt.toJSDate();
                initialSelectedStartDate = endDt.minus({ days: this.config.activityDurationDaysFixed - 1 }).toJSDate();
            } catch (e) { /* Fallback if date parsing fails */ }
        } else if (this.config.overrideActivityStartDate) {
            try {
                const startDt = DateTime.fromISO(this.config.overrideActivityStartDate, { zone: 'utc' });
                initialSelectedStartDate = startDt.toJSDate();
                initialSelectedEndDate = startDt.plus({ days: this.config.activityDurationDaysFixed - 1 }).toJSDate();
            } catch (e) { /* Fallback */ }
        }
      }

      if (!initialSelectedStartDate) { // If not set by fixed duration logic
          if (this.config.overrideActivityStartDate) {
              try {
                  initialSelectedStartDate = DateTime.fromISO(this.config.overrideActivityStartDate, { zone: 'utc' }).toJSDate();
              } catch (e) {
                  initialSelectedStartDate = calculateInitialStartDate(this.config.timezone, this.config.activityLatestEndTime, this.config.activityDurationMinutes);
              }
          } else {
              initialSelectedStartDate = calculateInitialStartDate(this.config.timezone, this.config.activityLatestEndTime, this.config.activityDurationMinutes);
          }
      }

      if (this.config.multiday && !initialSelectedEndDate) { // If not set by fixed duration logic
          if (this.config.overrideActivityEndDate) {
              try {
                  initialSelectedEndDate = DateTime.fromISO(this.config.overrideActivityEndDate, { zone: 'utc' }).toJSDate();
              } catch (e) {
                  initialSelectedEndDate = DateTime.fromJSDate(initialSelectedStartDate).plus({ days: 1 }).toJSDate();
              }
          } else {
              initialSelectedEndDate = DateTime.fromJSDate(initialSelectedStartDate).plus({ days: 1 }).toJSDate();
          }
      }

      // Final check for multiday date validity
      if (this.config.multiday && initialSelectedStartDate && initialSelectedEndDate) {
          if (DateTime.fromJSDate(initialSelectedEndDate) < DateTime.fromJSDate(initialSelectedStartDate)) {
              initialSelectedEndDate = new Date(initialSelectedStartDate.valueOf());
          }
      }


      this.state = {
        fromConnections: [],
        toConnections: [],
        selectedDate: initialSelectedStartDate,
        selectedEndDate: initialSelectedEndDate,
        loading: false,
        error: null,
        info: null,
        suggestions: [],
        recommendedToIndex: 0,
        recommendedFromIndex: 0,
        activityTimes: {
          start: '',
          end: '',
          duration: '',
          warning_duration: false,
        }
      };

      this.loadingTextTimeout1 = null;
      this.loadingTextTimeout2 = null;
      this.singleCalendarInstance = null;

      this.injectBaseStyles();
      this.initDOM();
      this.setupEventListeners();
      this._initCustomCalendar();
      this._initializeOriginInputWithOverridesAndCache();
    } catch (error) {
      console.error("Failed to initialize Diana Widget:", error);
      const fallbackContainer = document.getElementById(containerId);
      if (fallbackContainer) {
        const fallback = document.createElement('div');
        fallback.style.padding = '20px';
        fallback.style.backgroundColor = '#ffebee';
        fallback.style.border = '1px solid #ef9a9a';
        fallback.style.borderRadius = '4px';
        fallback.style.margin = '10px';
        const t = (key) => {
          try {
            return this.t ? this.t(key) : translations.EN.errors.api.unknown;
          } catch (e) {
            return translations.EN.errors.api.unknown;
          }
        };
        fallback.innerHTML = `
          <h3 style="color: #c62828; margin-top: 0;">Diana Widget Failed to Load</h3>
          <p>We're unable to load the diana widget transit planner at this time. Please try again later.</p>
          <p><small>${error.message}</small></p>
        `;
        fallbackContainer.innerHTML = "";
        fallbackContainer.appendChild(fallback);
      }
    }
  }

  validateConfig(userConfig) {
    const config = { ...this.defaultConfig, ...userConfig };

    if (!translations[config.language]) {
      console.warn(`Unsupported language '${config.language}', falling back to EN`);
      config.language = 'EN';
    }

    const missingFields = this.defaultConfig.requiredFields.filter(
      field => !config[field]
    );

    if (config.multiday) {
      if (!config.activityDurationMinutes) {
        const index = missingFields.indexOf('activityDurationMinutes');
        if (index > -1) {
            missingFields.splice(index, 1);
        }
        config.activityDurationMinutes = 1;
      }
    }

    if (missingFields.length > 0) {
      const errorMsg = `Missing required configuration: ${missingFields.join(', ')}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (!DateTime.local().setZone(config.timezone).isValid) {
        console.warn(`Invalid timezone '${config.timezone}' provided, falling back to 'Europe/Vienna'. Error: ${DateTime.local().setZone(config.timezone).invalidReason}`);
        config.timezone = 'Europe/Vienna';
    }

    const validLocationTypes = ['coordinates', 'coord', 'coords', 'address', 'station'];
    if (!validLocationTypes.includes(config.activityStartLocationType)) {
      throw new Error(`Invalid activityStartLocationType '${config.activityStartLocationType}'. Valid types: ${validLocationTypes.join(', ')}`);
    }
    if (!validLocationTypes.includes(config.activityEndLocationType)) {
      throw new Error(`Invalid activityEndLocationType '${config.activityEndLocationType}'. Valid types: ${validLocationTypes.join(', ')}`);
    }

    const duration = parseInt(config.activityDurationMinutes, 10);
    if (isNaN(duration) || duration <= 0) {
        throw new Error(`Invalid activityDurationMinutes '${config.activityDurationMinutes}'. Must be a positive integer.`);
    }

    const timeRegex = /^(2[0-3]|[01]?[0-9]):([0-5]?[0-9])(:([0-5]?[0-9]))?$/;
    const timeFields = [
      'activityEarliestStartTime', 'activityLatestStartTime',
      'activityEarliestEndTime', 'activityLatestEndTime'
    ];
    timeFields.forEach(field => {
      if (!timeRegex.test(config[field])) {
        throw new Error(`Invalid time format for '${field}': '${config[field]}'. Expected HH:MM or HH:MM:SS`);
      }
    });

    if (typeof config.cacheUserStartLocation !== 'boolean') {
        config.cacheUserStartLocation = this.defaultConfig.cacheUserStartLocation;
    }
    if (typeof config.userStartLocationCacheTTLMinutes !== 'number' || config.userStartLocationCacheTTLMinutes <= 0) {
        config.userStartLocationCacheTTLMinutes = this.defaultConfig.userStartLocationCacheTTLMinutes;
    }
    if (config.overrideUserStartLocation !== null && typeof config.overrideUserStartLocation !== 'string') {
        throw new Error(`Invalid overrideUserStartLocation '${config.overrideUserStartLocation}'. Must be a string or null.`);
    }
    if (config.overrideUserStartLocation !== null) {
        if (!config.overrideUserStartLocationType || !validLocationTypes.includes(config.overrideUserStartLocationType)) {
            throw new Error(`Invalid or missing overrideUserStartLocationType '${config.overrideUserStartLocationType}'. Required if overrideUserStartLocation is set.`);
        }
        if (['coordinates', 'coord', 'coords'].includes(config.overrideUserStartLocationType)) {
            const coordsRegex = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
            if (!coordsRegex.test(config.overrideUserStartLocation)) {
                throw new Error(`Invalid coordinate format for overrideUserStartLocation: '${config.overrideUserStartLocation}'. Expected "lat,lon".`);
            }
        }
    } else if (config.overrideUserStartLocationType !== null) {
        config.overrideUserStartLocationType = null;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (config.displayStartDate !== null && (!dateRegex.test(config.displayStartDate) || !DateTime.fromISO(config.displayStartDate).isValid)) {
        config.displayStartDate = null;
    }
    if (config.displayEndDate !== null && (!dateRegex.test(config.displayEndDate) || !DateTime.fromISO(config.displayEndDate).isValid)) {
        config.displayEndDate = null;
    }
     if (config.displayStartDate && config.displayEndDate) {
        const startDate = DateTime.fromISO(config.displayStartDate);
        const endDate = DateTime.fromISO(config.displayEndDate);
        if (startDate.isValid && endDate.isValid && startDate > endDate) {
            config.displayStartDate = null;
            config.displayEndDate = null;
        }
    }

    if (typeof config.multiday !== 'boolean') {
        console.warn(`Invalid multiday config: ${config.multiday}. Defaulting to false.`);
        config.multiday = false;
    }
    if (config.overrideActivityStartDate !== null && (!dateRegex.test(config.overrideActivityStartDate) || !DateTime.fromISO(config.overrideActivityStartDate).isValid)) {
        console.warn(`Invalid overrideActivityStartDate: ${config.overrideActivityStartDate}. It will be ignored.`);
        config.overrideActivityStartDate = null;
    }
    if (config.overrideActivityEndDate !== null) {
        if (!dateRegex.test(config.overrideActivityEndDate) || !DateTime.fromISO(config.overrideActivityEndDate).isValid) {
            console.warn(`Invalid overrideActivityEndDate: ${config.overrideActivityEndDate}. It will be ignored.`);
            config.overrideActivityEndDate = null;
        } else if (!config.multiday) {
            console.warn("Warning: 'overrideActivityEndDate' is provided but 'multiday' is false. The end date override will be ignored.");
            config.overrideActivityEndDate = null;
        }
    }
    if (config.multiday && config.overrideActivityStartDate && config.overrideActivityEndDate) {
        const overrideStart = DateTime.fromISO(config.overrideActivityStartDate);
        const overrideEnd = DateTime.fromISO(config.overrideActivityEndDate);
        if (overrideStart.isValid && overrideEnd.isValid && overrideEnd < overrideStart) {
            console.warn(`overrideActivityEndDate (${config.overrideActivityEndDate}) is before overrideActivityStartDate (${config.overrideActivityStartDate}). Setting overrideActivityEndDate to be the same as overrideActivityStartDate.`);
            config.overrideActivityEndDate = config.overrideActivityStartDate;
        }
    }

    if (config.multiday && config.overrideActivityStartDate && config.overrideActivityEndDate && !config.activityDurationDaysFixed) {
      const oS = DateTime.fromISO(config.overrideActivityStartDate), oE = DateTime.fromISO(config.overrideActivityEndDate);
      if (oS.isValid && oE.isValid && oE < oS) config.overrideActivityEndDate = config.overrideActivityStartDate;
    }
    return config;
  }

  t(keyPath) {
    const keys = keyPath.split('.');
    let result = translations[this.config.language];
    for (const key of keys) {
      result = result?.[key];
      if (!result) break;
    }
    if (!result && this.config.language !== 'EN') {
        let fallbackResult = translations.EN;
        for (const key of keys) {
            fallbackResult = fallbackResult?.[key];
            if (!fallbackResult) break;
        }
        result = fallbackResult;
    }
    return result || `[${keyPath}]`;
  }

  injectBaseStyles() {
    if (!document.getElementById('diana-styles')) {
      const style = document.createElement('style');
      style.id = 'diana-styles';
      style.textContent = styles.toString();
      document.head.appendChild(style);
    }
  }

  initDOM() {
    let dianaContainer = document.createElement('div');
    dianaContainer.className = 'diana-container';
    this.container.appendChild(dianaContainer);
    this.container = dianaContainer;
    this.container.innerHTML = this.getModalHTML();
    this.cacheDOMElements();
    this.setupAccessibility();

    if (this.config.multiday) {
        if (this.elements.activityDateStart && this.state.selectedDate) {
            this.elements.activityDateStart.value = formatDatetime(this.state.selectedDate);
        }
        if (this.elements.activityDateEnd && this.state.selectedEndDate) {
            this.elements.activityDateEnd.value = formatDatetime(this.state.selectedEndDate);
        }
        this.updateDateDisplay(this.state.selectedDate, 'dateDisplayStart');
        this.updateDateDisplay(this.state.selectedEndDate, 'dateDisplayEnd');
    } else {
        // For single day, initial date value setting is handled by _updateSingleDayDateButtonStates
        // called from _initCustomCalendar
        if (this.elements.activityDate && this.state.selectedDate) {
             // Ensure hidden input is also set initially
            this.elements.activityDate.value = formatDatetime(this.state.selectedDate, this.config.timezone);
        }
    }
  }

  _initializeOriginInputWithOverridesAndCache() {
    if (!this.elements || !this.elements.originInput) return;
    const originInput = this.elements.originInput;
    if (this.config.overrideUserStartLocation) {
      originInput.value = this.config.overrideUserStartLocation;
      if (['coordinates', 'coord', 'coords'].includes(this.config.overrideUserStartLocationType)) {
        const parts = this.config.overrideUserStartLocation.split(',');
        if (parts.length === 2) {
          originInput.setAttribute('data-lat', parts[0].trim());
          originInput.setAttribute('data-lon', parts[1].trim());
        }
      }
      originInput.disabled = true; originInput.classList.add('disabled');
      if (this.elements.currentLocationBtn) this.elements.currentLocationBtn.style.display = 'none';
      return;
    }
    if (this.config.cacheUserStartLocation) {
      const cachedLocation = this._getCachedStartLocation();
      if (cachedLocation) {
        originInput.value = cachedLocation.value;
        if (cachedLocation.lat && cachedLocation.lon) {
          originInput.setAttribute('data-lat', cachedLocation.lat);
          originInput.setAttribute('data-lon', cachedLocation.lon);
        }
      }
    }
  }

  _getCachedStartLocation() {
    try {
      const cachedItem = localStorage.getItem(this.CACHE_KEY_USER_START_LOCATION);
      if (!cachedItem) return null;
      const data = JSON.parse(cachedItem);
      const now = Date.now();
      const ttlMilliseconds = this.config.userStartLocationCacheTTLMinutes * 60 * 1000;
      if (now < data.timestamp + ttlMilliseconds) {
        return data;
      } else {
        localStorage.removeItem(this.CACHE_KEY_USER_START_LOCATION);
        return null;
      }
    } catch (error) {
      console.error("Error retrieving cached start location:", error);
      return null;
    }
  }

  _setCachedStartLocation(value, lat, lon) {
    if (!this.config.cacheUserStartLocation) return;
    try {
      const locationData = {
        value: value, lat: lat ? lat.toString() : null, lon: lon ? lon.toString() : null, timestamp: Date.now()
      };
      localStorage.setItem(this.CACHE_KEY_USER_START_LOCATION, JSON.stringify(locationData));
    } catch (error) {
      console.error("Error saving start location to cache:", error);
    }
  }

  getModalHTML() {
    const datesFullyDeterminedByFixedDurationAndOverride =
        this.config.multiday &&
        this.config.activityDurationDaysFixed &&
        (this.config.overrideActivityStartDate || this.config.overrideActivityEndDate);

    const showStartDateInput = !this.config.overrideActivityStartDate && !datesFullyDeterminedByFixedDurationAndOverride;
    const showEndDateInput = this.config.multiday && !this.config.overrideActivityEndDate && !datesFullyDeterminedByFixedDurationAndOverride;
    const showAnyDateSection = this.config.multiday || !this.config.overrideActivityStartDate || datesFullyDeterminedByFixedDurationAndOverride;

    let dateSectionHTML = '';
    if (showAnyDateSection) {
        dateSectionHTML += `<div class="form-section date-section-wrapper">`;
        if (this.config.multiday) {
            // Multiday HTML remains unchanged
            if (showStartDateInput) {
                dateSectionHTML += `
                  <div class="date-input-column">
                    <p id="dateLabelStart">${this.t('activityStartDateLabel')}</p>
                    <div class="date-input-container" role="button" aria-labelledby="dateLabelStart" tabindex="0">
                      <div class="date-input">
                        <svg class="date-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span id="dateDisplayStart" class="date-input-display placeholder">${this.t('selectDate')}</span>
                        <svg class="date-input-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </div>
                      <input type="date" id="activityDateStart" class="native-date-picker-multiday" aria-hidden="true">
                    </div>
                  </div>`;
            }
            if (showEndDateInput) {
                 dateSectionHTML += `
                  <div class="date-input-column">
                    <p id="dateLabelEnd">${this.t('activityEndDateLabel')}</p>
                    <div class="date-input-container" role="button" aria-labelledby="dateLabelEnd" tabindex="0">
                      <div class="date-input">
                        <svg class="date-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                           <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span id="dateDisplayEnd" class="date-input-display placeholder">${this.t('selectDate')}</span>
                        <svg class="date-input-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </div>
                      <input type="date" id="activityDateEnd" class="native-date-picker-multiday" aria-hidden="true">
                    </div>
                  </div>`;
            }
        } else { // Single day
            if (showStartDateInput) { // Not overridden
                dateSectionHTML += `
                  <div class="date-input-column single">
                    <p id="dateLabel">${this.t('activityDate')}</p>
                    <div class="date-selector-buttons" role="group" aria-labelledby="dateLabel">
                        <button type="button" id="dateBtnToday" class="date-selector-btn">${this.t('today')}</button>
                        <button type="button" id="dateBtnTomorrow" class="date-selector-btn">${this.t('tomorrow')}</button>
                        <button type="button" id="dateBtnOther" class="date-selector-btn">
                            <span id="otherDateText">${this.t('otherDate')}</span>
                            <svg class="date-input-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                    </div>
                    <input type="date" id="activityDate" class="native-date-picker-single" aria-hidden="true" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;">
                  </div>`;
            } else if (this.config.overrideActivityStartDate) { // Overridden single day
                 dateSectionHTML += `
                  <div class="date-input-column single">
                    <p id="dateLabel">${this.t('activityDate')}</p>
                    <div class="date-input-container disabled" role="button" aria-labelledby="dateLabel" tabindex="-1">
                      <div class="date-input">
                         <svg class="date-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                           <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                         </svg>
                        <span id="dateDisplay" class="date-input-display">${formatDateForDisplay(this.state.selectedDate, this.config.language === 'DE' ? 'de-DE' : 'en-GB', this.config.timezone)}</span>
                      </div>
                      <input type="date" id="activityDate" class="native-date-picker-single" aria-hidden="true" style="display:none !important;" value="${formatDatetime(this.state.selectedDate)}">
                    </div>
                  </div>`;
            }
        }
        dateSectionHTML += `</div>`;
    }


    return `
      <div id="activityModal" class="modal visible">
        <div id="innerContainer" class="modal-content">
          <div id="formPage" class="modal-page active">
            <div class="widget-header">
              <div class="widget-header-button"><button class="back-btn">&#9776;</button></div>
              <div class="widget-header-heading">${this.config.activityName}</div>
            </div>
            <div id="infoContainer" class="info-message" style="display: none;" role="status"></div>
            <div id="formErrorContainer" class="error-message" style="display: none;" role="alert"></div>
            <form class="modal-body" aria-labelledby="formHeading">
              <div style="position:relative" class="form-section">
                <p id="originLabel">${this.t('origin')}</p>
                <div class="input-container">
                  <svg class="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>
                  <input type="text" class="input-field" id="originInput" placeholder="${this.t('enterOrigin')}" value="${this.config.userStartLocationDefault || ''}" aria-labelledby="originLabel">
                  <svg id="currentLocationBtn" class="input-icon-right" style="pointer-events: auto; cursor: pointer;" width="18.75" height="18.75" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="${this.t('useCurrentLocation')}" role="button">
                    <circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="3"></circle><line x1="12" y1="0" x2="12" y2="5"></line><line x1="0" y1="12" x2="5" y2="12"></line><line x1="12" y1="19" x2="12" y2="24"></line><line x1="19" y1="12" x2="24" y2="12"></line>
                  </svg>
                </div>
                <div id="suggestions" class="suggestions-container" role="listbox"></div>
              </div>
              <div class="form-section">
                <p id="destinationLabel">${this.t('destination')}</p>
                <div class="input-container">
                  <svg class="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  <input type="text" class="input-field disabled" id="destinationInput" placeholder="${this.t('destination')}" value="${this.config.destinationInputName || this.config.activityName}" readonly aria-labelledby="destinationLabel">
                </div>
              </div>
              ${dateSectionHTML}
              <div class="form-footer">
                <button type="submit" class="btn apply-btn" id="searchBtn">${this.t('search')}</button>
              </div>
            </form>
            <div class="widget-footer"><a href="https://zuugle-services.com" target="_new">powered by Zuugle Services GmbH</a></div>
          </div>
          <div id="resultsPage" class="modal-page">
            <div class="modal-body-result">
              <div id="resultsErrorContainer" class="error-message" style="display: none" role="alert"></div>
              <div class="slider-wrapper etc">
                <div class="widget-header">
                  <div class="widget-header-button"><button class="back-btn">&#9776;</button></div>
                  <div class="widget-header-heading">${this.config.activityName}</div>
                </div>
                <div id="backBtn" class="widget-response-back-button" role="button" tabindex="0"><div>&#x2190;</div><div>${this.t('back')}</div></div>
                <div class="slider" id="topSlider" role="group" aria-label="${this.t('ariaLabels.topSlider')}"></div>
              </div>
              <div class="middle-box" id="responseBox" aria-live="polite">${this.t('loadingConnectionsI')}</div>
              <div id="activity-time" class="middle-box">${this.config.activityName}</div>
              <div class="middle-box" id="responseBox-bottom" aria-live="polite">${this.t('loadingConnectionsO')}</div>
              <div class="slider-wrapper slider-wrap-fixed">
                <div class="slider" id="bottomSlider" role="group" aria-label="${this.t('ariaLabels.bottomSlider')}"></div>
              </div>
              <div class="widget-footer"><a href="https://zuugle-services.com" target="_new">powered by Zuugle Services GmbH</a></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  cacheDOMElements() {
    this.elements = {
      modal: this.container.querySelector("#activityModal"),
      innerContainer: this.container.querySelector("#innerContainer"),
      formPage: this.container.querySelector("#formPage"),
      resultsPage: this.container.querySelector("#resultsPage"),
      originInput: this.container.querySelector("#originInput"),
      suggestionsContainer: this.container.querySelector("#suggestions"),
      searchBtn: this.container.querySelector("#searchBtn"),
      backBtn: this.container.querySelector("#backBtn"),
      formErrorContainer: this.container.querySelector("#formErrorContainer"),
      resultsErrorContainer: this.container.querySelector("#resultsErrorContainer"),
      infoContainer: this.container.querySelector("#infoContainer"),
      responseBox: this.container.querySelector("#responseBox"),
      responseBoxBottom: this.container.querySelector("#responseBox-bottom"),
      topSlider: this.container.querySelector("#topSlider"),
      bottomSlider: this.container.querySelector("#bottomSlider"),
      activityTimeBox: this.container.querySelector("#activity-time"),
      currentLocationBtn: this.container.querySelector("#currentLocationBtn"),
      activityDateStart: this.container.querySelector("#activityDateStart"),
      dateDisplayStart: this.container.querySelector("#dateDisplayStart"),
      activityDateEnd: this.container.querySelector("#activityDateEnd"),
      dateDisplayEnd: this.container.querySelector("#dateDisplayEnd"),
      activityDate: this.container.querySelector("#activityDate"), // Hidden input for single day
      dateDisplay: this.container.querySelector("#dateDisplay"), // Legacy display for single day (now hidden by default)
      dateBtnToday: this.container.querySelector("#dateBtnToday"),
      dateBtnTomorrow: this.container.querySelector("#dateBtnTomorrow"),
      dateBtnOther: this.container.querySelector("#dateBtnOther"),
      otherDateText: this.container.querySelector("#otherDateText"), // Span inside dateBtnOther
      dateSelectorButtonsGroup: this.container.querySelector(".date-selector-buttons"), // The group of date buttons
    };
  }

  setupAccessibility() {
    this.elements.originInput.setAttribute('aria-autocomplete', 'list');
    this.elements.originInput.setAttribute('aria-controls', 'suggestions');
    this.elements.originInput.setAttribute('aria-expanded', 'false');

    if (this.config.multiday) {
        if (this.elements.activityDateStart) this.elements.activityDateStart.setAttribute('aria-hidden', 'true');
        if (this.elements.activityDateEnd) this.elements.activityDateEnd.setAttribute('aria-hidden', 'true');
    } else {
        if (this.elements.activityDate) this.elements.activityDate.setAttribute('aria-hidden', 'true');
    }

    this.elements.searchBtn.setAttribute('aria-label', this.t('ariaLabels.searchButton'));
    this.elements.backBtn.setAttribute('aria-label', this.t('ariaLabels.backButton'));
    if (this.elements.currentLocationBtn) {
        this.elements.currentLocationBtn.setAttribute('aria-label', this.t('useCurrentLocation'));
    }
    this.elements.responseBox.setAttribute('aria-busy', 'false');
    this.elements.responseBoxBottom.setAttribute('aria-busy', 'false');
  }

  setupEventListeners() {
    if (!this.config.overrideUserStartLocation) {
        this.elements.originInput.addEventListener('input', (e) => {
          this.elements.originInput.removeAttribute("data-lat"); this.elements.originInput.removeAttribute("data-lon");
          this.clearMessages(); debounce(() => this.handleAddressInput(e.target.value.trim()), 300)();
        });
        this.elements.suggestionsContainer.addEventListener('click', (e) => {
          if (e.target.classList.contains('suggestion-item')) this.handleSuggestionSelect(e.target.dataset.value, e.target.dataset.lat, e.target.dataset.lon);
        });
        document.addEventListener("click", (e) => {
          if (this.elements.suggestionsContainer?.style.display === 'block' && !this.elements.suggestionsContainer.contains(e.target) && !this.elements.originInput.contains(e.target)) {
            this.state.suggestions = []; this.renderSuggestions();
          }
        });
        this.elements.originInput.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') this.handleSuggestionNavigation(e);
          else if (e.key === 'Enter') this.handleSuggestionEnter(e);
        });
        if (this.elements.currentLocationBtn) this.elements.currentLocationBtn.addEventListener('click', () => this.handleCurrentLocation());
    }
    this.elements.searchBtn.addEventListener('click', (e) => { e.preventDefault(); this.handleSearch(); });
    this.elements.backBtn.addEventListener('click', () => this.navigateToForm());
  }

  async handleCurrentLocation() {
    this.clearMessages();
    if (!navigator.geolocation) {
      this.showError(this.t('errors.geolocationNotSupported'), 'form');
      return;
    }
    this.elements.currentLocationBtn.style.pointerEvents = 'none';
    this.elements.currentLocationBtn.style.opacity = '0.5';
    this.elements.originInput.disabled = true;
    this.showInfo(this.t('infos.fetchingLocation'));
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 0
        });
      });
      const { latitude, longitude } = position.coords;
      await this.fetchReverseGeocode(latitude, longitude);
    } catch (error) {
      let errorMsg = this.t('errors.geolocationError');
      if (error.code) {
        switch (error.code) {
          case error.PERMISSION_DENIED: errorMsg = this.t('errors.geolocationPermissionDenied'); break;
          case error.POSITION_UNAVAILABLE: errorMsg = this.t('errors.geolocationPositionUnavailable'); break;
          case error.TIMEOUT: errorMsg = this.t('errors.geolocationTimeout'); break;
        }
      }
      this.showError(errorMsg, 'form');
    } finally {
      this.elements.currentLocationBtn.style.pointerEvents = 'auto';
      this.elements.currentLocationBtn.style.opacity = '1';
      this.elements.originInput.disabled = false;
      if (this.state.info === this.t('infos.fetchingLocation')) this.showInfo(null);
    }
  }

  async fetchReverseGeocode(latitude, longitude) {
    this.showInfo(this.t('infos.fetchingAddress'));
    try {
      const response = await fetch(
        `${this.config.apiBaseUrl}/reverse-geocode?lat=${latitude}&lon=${longitude}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.config.apiToken}` }
        });
      if (!response.ok) {
        if (response.status === 401) {
          const responseBody = await response.json();
          if (this.config.apiToken !== "" && responseBody["detail"] === "Authentication credentials were not provided.") {
            window.location.reload(true);
          }
        }
        let errorCode = null;
        try {
            const errorBody = await response.json();
            if (errorBody && errorBody.code) {
                errorCode = errorBody.code;
                throw new Error(this.t(getApiErrorTranslationKey(errorCode)));
            } else if (errorBody && errorBody.error) throw new Error(this.t('errors.api.unknown'));
        } catch (e) {
          if (e instanceof SyntaxError) throw new Error(this.t('errors.api.unknown'));
          else throw e;
        }
        throw new Error(this.t('errors.api.unknown'));
      }
      const data = await response.json();
      if (data.features && data.features.length > 0 && data.features[0].diana_properties && data.features[0].diana_properties.display_name) {
        const displayName = data.features[0].diana_properties.display_name;
        this.elements.originInput.value = displayName;
        this.elements.originInput.setAttribute('data-lat', latitude.toString());
        this.elements.originInput.setAttribute('data-lon', longitude.toString());
        this.state.suggestions = []; this.renderSuggestions(); this.clearMessages();
        this._setCachedStartLocation(displayName, latitude, longitude);
      } else {
        throw new Error(this.t('errors.reverseGeocodeNoResults'));
      }
    } catch (error) {
      console.error("Reverse geocode error:", error);
      let errorMessage = this.t('errors.reverseGeocodeFailed');
      if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
        errorMessage = !window.navigator.onLine ? this.t('errors.api.networkError') : this.t('errors.api.apiUnreachable');
      }
      this.showError(errorMessage, 'form');
    } finally {
        if (this.state.info === this.t('infos.fetchingAddress')) this.showInfo(null);
    }
  }

  async handleAddressInput(query) {
    if (query.length < 2) { this.state.suggestions = []; this.renderSuggestions(); return; }
    this.lastQuery = query;
    try {
      const results = await this.fetchSuggestions(query);
      if (query === this.lastQuery) {
        this.state.suggestions = (!results || !results.features || results.features.length === 0) ? [] : results.features;
        this.renderSuggestions();
      }
    } catch (error) {
      if (query === this.lastQuery) {
        let errorMessage = this.t('errors.suggestionError');
        if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
          errorMessage = !window.navigator.onLine ? this.t('errors.api.networkError') : this.t('errors.api.apiUnreachable');
        }
        this.showError(errorMessage, 'form');
      }
    }
  }

  handleSuggestionSelect(value, lat, lon) {
    this.elements.originInput.value = value;
    this.elements.originInput.setAttribute('data-lat', lat);
    this.elements.originInput.setAttribute('data-lon', lon);
    this.state.suggestions = []; this.renderSuggestions(); this.elements.originInput.focus(); this.clearMessages();
    this._setCachedStartLocation(value, lat, lon);
  }

  async handleSearch() {
    if (this.loadingTextTimeout1) clearTimeout(this.loadingTextTimeout1); if (this.loadingTextTimeout2) clearTimeout(this.loadingTextTimeout2);
    this.loadingTextTimeout1 = null; this.loadingTextTimeout2 = null; this.clearMessages();

    if (!this.config.overrideUserStartLocation && !this.elements.originInput.value) { this.showInfo(this.t('infos.originRequired')); return; }

    const datesFullyDetermined = this.config.multiday && this.config.activityDurationDaysFixed && (this.config.overrideActivityStartDate || this.config.overrideActivityEndDate);

    if (!datesFullyDetermined) {
        const activityDateStartInput = this.config.multiday ? this.elements.activityDateStart : this.elements.activityDate;
        const activityDateEndInput = this.config.multiday ? this.elements.activityDateEnd : null;

        if (!this.config.overrideActivityStartDate && (!activityDateStartInput || !activityDateStartInput.value)) {
          this.showInfo(this.t('infos.dateRequired'), 'form');
          return; }
        if (this.config.multiday && !this.config.overrideActivityEndDate && (!activityDateEndInput || !activityDateEndInput.value) && !this.config.activityDurationDaysFixed) {
          this.showInfo(this.t('infos.endDateRequired'), 'form');
          return;
        }
    }

    // Ensure state.selectedDate and state.selectedEndDate are up-to-date from inputs before API call
    // For single-day, this.state.selectedDate is managed by button clicks and calendar interactions.
    // For multi-day, it's managed by its calendar or native inputs.
    if (!this.config.multiday && !this.config.overrideActivityStartDate) {
        // this.state.selectedDate should already be set by the button/calendar interactions
        // and the hidden input this.elements.activityDate.value reflects this.
    } else if (this.config.multiday) {
        if (!this.config.overrideActivityStartDate && !datesFullyDetermined) {
            const inputVal = this.elements.activityDateStart?.value;
            if (inputVal) this.state.selectedDate = DateTime.fromISO(inputVal, { zone: 'utc' }).toJSDate();
        }
        if (!this.config.overrideActivityEndDate && !datesFullyDetermined) {
            if (this.elements.activityDateEnd?.value) {
                this.state.selectedEndDate = DateTime.fromISO(this.elements.activityDateEnd.value, { zone: 'utc' }).toJSDate();
            } else if (this.config.activityDurationDaysFixed && this.state.selectedDate) {
                this.state.selectedEndDate = DateTime.fromJSDate(this.state.selectedDate).plus({ days: this.config.activityDurationDaysFixed - 1 }).toJSDate();
            }
        }
    }


    if (this.config.multiday && this.state.selectedDate && this.state.selectedEndDate && DateTime.fromJSDate(this.state.selectedDate).startOf('day') > DateTime.fromJSDate(this.state.selectedEndDate).startOf('day')) {
      this.showInfo(this.t('infos.endDateAfterStartDate')); return;
    }

    this.setLoadingState(true);
    try {
      await this.fetchActivityData();
      this.navigateToResults();
      this.slideToRecommendedConnections();
    } catch (error) {
      console.error("Search error:", error);
      let errorMessage = this.t('errors.connectionError');
      if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
        errorMessage = !window.navigator.onLine ? this.t('errors.api.networkError') : this.t('errors.api.apiUnreachable');
      } else if (error.response) {
        try {
            const errorBody = await error.response.json();
            if (errorBody && errorBody.code) errorMessage = this.t(getApiErrorTranslationKey(errorBody.code));
            else if (errorBody && errorBody.error) errorMessage = this.t('errors.api.unknown');
        } catch (parseError) { errorMessage = this.t('errors.api.unknown'); }
      } else if (error.message) {
          errorMessage = this.t('errors.api.unknown');
      }
      this.showError(errorMessage, 'form');
    } finally {
      this.setLoadingState(false);
    }
  }

  async fetchSuggestions(query) {
    try {
      const response = await fetch(
          `${this.config.apiBaseUrl}/address-autocomplete?q=${encodeURIComponent(query)}`,
          { headers: { "Authorization": `Bearer ${this.config.apiToken}` } }
      );
      if (!response.ok) {
        if (response.status === 401) {
          const responseBody = await response.json();
          if (this.config.apiToken !== "" && responseBody["detail"] === "Authentication credentials were not provided.") {
            window.location.reload(true);
          }
        }
        let errorCode = null;
        try {
            const errorBody = await response.json();
            if (errorBody && errorBody.code) throw new Error(this.t(getApiErrorTranslationKey(errorBody.code)));
            else if (errorBody && errorBody.error) throw new Error(this.t('errors.api.unknown'));
        } catch (e) {
          if (e instanceof SyntaxError) throw new Error(this.t('errors.api.unknown')); else throw e;
        }
        throw new Error(this.t('errors.api.unknown'));
      }
      return response.json();
    } catch (e) {
      console.error("Suggestions error:", e);
      let errorMessage = this.t('errors.suggestionError');
      if (e.message && e.message.toLowerCase().includes('failed to fetch')) {
        errorMessage = !window.navigator.onLine ? this.t('errors.api.networkError') : this.t('errors.api.apiUnreachable');
      }
      this.showError(errorMessage, 'form');
      return { features: [] };
    }
  }

  async fetchActivityData() {
    const activityStartDate = this.state.selectedDate;
    if (!activityStartDate) throw new Error("Activity start date is not available.");

    const referenceDateForEndTimes = this.config.multiday && this.state.selectedEndDate
                                       ? this.state.selectedEndDate
                                       : activityStartDate;

    const utcEarliestStart = convertLocalTimeToUTC(this.config.activityEarliestStartTime, activityStartDate, this.config.timezone);
    const utcLatestStart = convertLocalTimeToUTC(this.config.activityLatestStartTime, activityStartDate, this.config.timezone);
    const utcEarliestEnd = convertLocalTimeToUTC(this.config.activityEarliestEndTime, referenceDateForEndTimes, this.config.timezone);
    const utcLatestEnd = convertLocalTimeToUTC(this.config.activityLatestEndTime, referenceDateForEndTimes, this.config.timezone);

    let params = {
      date: formatDatetime(activityStartDate, this.config.timezone),
      activity_name: this.config.activityName,
      activity_type: this.config.activityType,
      activity_start_location: this.config.activityStartLocation,
      activity_start_location_type: this.config.activityStartLocationType,
      activity_end_location: this.config.activityEndLocation,
      activity_end_location_type: this.config.activityEndLocationType,
      activity_earliest_start_time: utcEarliestStart,
      activity_latest_start_time: utcLatestStart,
      activity_earliest_end_time: utcEarliestEnd,
      activity_latest_end_time: utcLatestEnd,
      activity_duration_minutes: this.config.activityDurationMinutes
    };

    if (this.config.multiday && this.state.selectedEndDate) {
        const startDateLuxon = DateTime.fromJSDate(activityStartDate).startOf('day');
        const endDateLuxon = DateTime.fromJSDate(this.state.selectedEndDate).startOf('day');
        const diffDays = endDateLuxon.diff(startDateLuxon, 'days').days;
        params.activity_duration_days = Math.max(1, diffDays + 1);
    }

    if (this.elements.originInput.attributes["data-lat"] && this.elements.originInput.attributes["data-lon"]) {
      params["user_start_location"] = `${this.elements.originInput.attributes['data-lat'].value},${this.elements.originInput.attributes['data-lon'].value}`;
      params["user_start_location_type"] = "coordinates";
    } else {
      params["user_start_location"] = this.elements.originInput.value;
      params["user_start_location_type"] = "address";
    }

    if (this.config.activityStartLocationDisplayName) params.activity_start_location_display_name = this.config.activityStartLocationDisplayName;
    if (this.config.activityEndLocationDisplayName) params.activity_end_location_display_name = this.config.activityEndLocationDisplayName;
    if (this.config.activityStartTimeLabel) params.activity_start_time_label = this.config.activityStartTimeLabel;
    if (this.config.activityEndTimeLabel) params.activity_end_time_label = this.config.activityEndTimeLabel;

    const queryString = new URLSearchParams(params);
    const response = await fetch(
      `${this.config.apiBaseUrl}/connections?${queryString}`,
      { headers: { "Authorization": `Bearer ${this.config.apiToken}` } }
    );

    if (!response.ok) {
      if (response.status === 401) {
        const responseBody = await response.json();
        if (this.config.apiToken !== "" && responseBody["detail"] === "Authentication credentials were not provided.") {
          window.location.reload(true);
        }
      }
      const error = new Error(this.t('errors.api.unknown')); error.response = response; throw error;
    }
    const result = await response.json();
    if (!result?.connections?.from_activity || !result?.connections?.to_activity) {
      console.error("API response missing expected connection data:", result);
      const apiError = new Error(this.t('errors.api.invalidDataReceived'));
      apiError.response = { json: async () => ({ error: "Invalid connection data", code: "APP_INVALID_DATA" }), status: 500 };
      throw apiError;
    }
    this.state.toConnections = result.connections.to_activity;
    this.state.fromConnections = result.connections.from_activity;
    const toIndex = result.connections.recommended_to_activity_connection;
    const fromIndex = result.connections.recommended_from_activity_connection;
    this.state.recommendedToIndex = (typeof toIndex === 'number' && toIndex >= 0 && toIndex < this.state.toConnections.length) ? toIndex : 0;
    this.state.recommendedFromIndex = (typeof fromIndex === 'number' && fromIndex >= 0 && fromIndex < this.state.fromConnections.length) ? fromIndex : 0;

    if (this.state.toConnections.length === 0 && this.state.fromConnections.length === 0) console.warn("No connections received.");
    else if (this.state.toConnections.length === 0) console.warn("No 'to_activity' connections received.");
    else if (this.state.fromConnections.length === 0) console.warn("No 'from_activity' connections received.");

    this.renderConnectionResults();
  }

  renderSuggestions() {
    this.elements.suggestionsContainer.innerHTML = this.state.suggestions
      .map(feature => `
        <div class="suggestion-item" role="option" tabindex="0"
             data-value="${feature.diana_properties.display_name.replace(/"/g, '&quot;')}"
             data-location_type="${feature.diana_properties.location_type}"
             data-lat="${feature.geometry.coordinates[1]}" data-lon="${feature.geometry.coordinates[0]}">
          ${feature.diana_properties.display_name}
        </div>`).join('');
    this.elements.suggestionsContainer.style.display = this.state.suggestions.length > 0 ? 'block' : 'none';
    this.elements.originInput.setAttribute('aria-expanded', this.state.suggestions.length > 0 ? 'true' : 'false');
  }

  renderConnectionResults() {
    this.showError(null, 'results');
    this.elements.topSlider.innerHTML = ''; this.elements.bottomSlider.innerHTML = '';
    this.elements.responseBox.innerHTML = this.t('selectTimeSlot');
    this.elements.responseBoxBottom.innerHTML = this.t('selectTimeSlot');
    this.elements.activityTimeBox.innerHTML = this.config.activityName;

    if (this.state.toConnections.length === 0 && this.state.fromConnections.length === 0) {
      this.showError(this.t('errors.api.noConnectionsFound'), 'form'); return;
    }
    if (this.state.toConnections.length === 0) {
      this.elements.responseBox.innerHTML = this.t('errors.api.noToConnectionsFound');
    } else {
      this.calculateAnytimeConnections(this.state.toConnections, "to");
      this.renderTimeSlots('topSlider', this.state.toConnections, 'to');
    }
    if (this.state.fromConnections.length === 0) {
      this.elements.responseBoxBottom.innerHTML = this.t('errors.api.noFromConnectionsFound');
    } else {
      this.calculateAnytimeConnections(this.state.fromConnections, "from");
      this.renderTimeSlots('bottomSlider', this.state.fromConnections, 'from');
    }

    for (let i = 0; i < this.state.toConnections.length; i++) {
      if (this.state.toConnections[i].connection_id === this.state.recommendedToIndex) { this.state.recommendedToIndex = i; break; }
    }
    for (let i = 0; i < this.state.fromConnections.length; i++) {
      if (this.state.fromConnections[i].connection_id === this.state.recommendedFromIndex) { this.state.recommendedFromIndex = i; break; }
    }

    if (this.state.toConnections.length > 0 && this.state.recommendedToIndex < this.state.toConnections.length) {
      const recTo = this.state.toConnections[this.state.recommendedToIndex];
      this.filterConnectionsByTime('to', convertUTCToLocalTime(recTo.connection_start_timestamp, this.config.timezone), convertUTCToLocalTime(recTo.connection_end_timestamp, this.config.timezone));
    }
    if (this.state.fromConnections.length > 0 && this.state.recommendedFromIndex < this.state.fromConnections.length) {
      const recFrom = this.state.fromConnections[this.state.recommendedFromIndex];
      this.filterConnectionsByTime('from', convertUTCToLocalTime(recFrom.connection_start_timestamp, this.config.timezone), convertUTCToLocalTime(recFrom.connection_end_timestamp, this.config.timezone));
    }
    this.addSwipeBehavior('topSlider'); this.addSwipeBehavior('bottomSlider');
  }

  renderTimeSlots(sliderId, connections, type) {
    const slider = this.elements[sliderId]; slider.innerHTML = '';
    connections.forEach((conn, index) => {
      const startTimeLocal = convertUTCToLocalTime(conn.connection_start_timestamp, this.config.timezone);
      const endTimeLocal = convertUTCToLocalTime(conn.connection_end_timestamp, this.config.timezone);
      const duration = calculateTimeDifference(conn.connection_start_timestamp, conn.connection_end_timestamp, (key) => this.t(key));
      const anytime = conn.connection_anytime;
      const btn = document.createElement('button');
      btn.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div style="font-size: 14px; margin-bottom: 4px; font-weight: bold;">${startTimeLocal} - ${endTimeLocal}</div>
          <div style="display: flex; justify-content:space-between; width: 100%; width: -moz-available; width: -webkit-fill-available; width: fill-available; align-items: center; font-size: 12px; color: #666;">
            <span>${duration}</span>
            <div style="display: flex; gap:2px; align-items: center;">
              ${anytime ? this.getTransportIcon("WALK_BLACK") : `
              <span>${conn.connection_transfers}</span>
              <svg width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14.8537 8.85354L12.8537 10.8535C12.7598 10.9474 12.6326 11.0001 12.4999 11.0001C12.3672 11.0001 12.24 10.9474 12.1462 10.8535C12.0523 10.7597 11.9996 10.6325 11.9996 10.4998C11.9996 10.3671 12.0523 10.2399 12.1462 10.146L13.293 8.99979H2.70678L3.85366 10.146C3.94748 10.2399 4.00018 10.3671 4.00018 10.4998C4.00018 10.6325 3.94748 10.7597 3.85366 10.8535C3.75983 10.9474 3.63259 11.0001 3.49991 11.0001C3.36722 11.0001 3.23998 10.9474 3.14616 10.8535L1.14616 8.85354C1.09967 8.8071 1.06279 8.75196 1.03763 8.69126C1.01246 8.63056 0.999512 8.5655 0.999512 8.49979C0.999512 8.43408 1.01246 8.36902 1.03763 8.30832C1.06279 8.24762 1.09967 8.19248 1.14616 8.14604L3.14616 6.14604C3.23998 6.05222 3.36722 5.99951 3.49991 5.99951C3.63259 5.99951 3.75983 6.05222 3.85366 6.14604C3.94748 6.23986 4.00018 6.36711 4.00018 6.49979C4.00018 6.63247 3.94748 6.75972 3.85366 6.85354L2.70678 7.99979H13.293L12.1462 6.85354C12.0523 6.75972 11.9996 6.63247 11.9996 6.49979C11.9996 6.36711 12.0523 6.23986 12.1462 6.14604C12.24 6.05222 12.3672 5.99951 12.4999 5.99951C12.6326 5.99951 12.7598 6.05222 12.8537 6.14604L14.8537 8.14604C14.9001 8.19248 14.937 8.24762 14.9622 8.30832C14.9873 8.36902 15.0003 8.43408 15.0003 8.49979C15.0003 8.5655 14.9873 8.63056 14.9622 8.69126C14.937 8.75196 14.9001 8.8071 14.8537 8.85354Z" fill="black"/>
              </svg>
              `}
            </div>
          </div>
        </div>`;
      btn.addEventListener('click', () => this.filterConnectionsByTime(type, startTimeLocal, endTimeLocal));
      const isRecommended = (type === 'to' && index === this.state.recommendedToIndex) || (type === 'from' && index === this.state.recommendedFromIndex);
      if (isRecommended) btn.classList.add('active-time');
      slider.appendChild(btn);
    });
  }

  calculateAnytimeConnections(connections, type) {
    const activityDateForCalc = this.config.multiday && type === "from" && this.state.selectedEndDate
                                ? this.state.selectedEndDate
                                : this.state.selectedDate;

    connections.forEach(conn => {
      if (conn.connection_anytime && conn.connection_elements && conn.connection_elements.length > 0) {
        const connectionDuration = conn.connection_elements[0].duration;
        if (type === "to") {
          conn.connection_end_timestamp = convertLocalTimeToUTCDatetime(this.config.activityEarliestStartTime, activityDateForCalc, this.config.timezone);
          conn.connection_start_timestamp = addMinutesToDate(conn.connection_end_timestamp, -connectionDuration);
        } else {
          conn.connection_start_timestamp = convertLocalTimeToUTCDatetime(this.config.activityLatestEndTime, activityDateForCalc, this.config.timezone);
          conn.connection_end_timestamp = addMinutesToDate(conn.connection_start_timestamp, connectionDuration);
        }
        conn.connection_elements[0].departure_time = conn.connection_start_timestamp;
        conn.connection_elements[0].arrival_time = conn.connection_end_timestamp;
      }
    });
  }

  filterConnectionsByTime(type, startTimeLocal, endTimeLocal) {
    const connections = type === 'from' ? this.state.fromConnections : this.state.toConnections;
    const sliderId = type === 'from' ? 'bottomSlider' : 'topSlider';
    const targetBox = type === 'from' ? this.elements.responseBoxBottom : this.elements.responseBox;
    const slider = this.elements[sliderId];
    slider.querySelectorAll('button').forEach(btn => {
      btn.classList.remove('active-time');
      if (btn.textContent.includes(`${startTimeLocal} - ${endTimeLocal}`)) btn.classList.add('active-time');
    });
    const filtered = connections.filter(conn =>
      convertUTCToLocalTime(conn.connection_start_timestamp, this.config.timezone) === startTimeLocal &&
      convertUTCToLocalTime(conn.connection_end_timestamp, this.config.timezone) === endTimeLocal
    );
    if (filtered.length > 0) {
        this.updateActivityTimeBox(filtered[0], type);
        targetBox.innerHTML = this.renderConnectionDetails(filtered, type);
        requestAnimationFrame(() => {
          const firstElement = targetBox.querySelector('.connection-elements > div:nth-child(1)');
          if (firstElement) firstElement.scrollIntoView({ behavior: 'smooth', block: 'center'});
        });
    } else {
        targetBox.innerHTML = `<div>${this.t('noConnectionDetails')}</div>`;
    }
  }

  updateActivityTimeBox(connection, type) {
    if (!connection) return;
    try {
      const activityStartDate = this.state.selectedDate;
      const activityEndDate = this.config.multiday && this.state.selectedEndDate
                              ? this.state.selectedEndDate
                              : activityStartDate;

      const connectionStartTimeLocal = convertUTCToLocalTime(connection.connection_start_timestamp, this.config.timezone);
      const connectionEndTimeLocal = convertUTCToLocalTime(connection.connection_end_timestamp, this.config.timezone);

      let calculatedActivityStartLocal, calculatedActivityEndLocal;

      if (type === 'to') {
        const earliestConfigStartLocal = convertConfigTimeToLocalTime(this.config.activityEarliestStartTime, activityStartDate, this.config.timezone);
        calculatedActivityStartLocal = getLaterTime(connectionEndTimeLocal, earliestConfigStartLocal, this.config.timezone);
        calculatedActivityEndLocal = this.state.activityTimes.end || null;
        this.state.activityTimes.start = calculatedActivityStartLocal;
      } else {
        const latestConfigEndLocal = convertConfigTimeToLocalTime(this.config.activityLatestEndTime, activityEndDate, this.config.timezone);
        calculatedActivityEndLocal = getEarlierTime(connectionStartTimeLocal, latestConfigEndLocal, this.config.timezone);
        calculatedActivityStartLocal = this.state.activityTimes.start || null;
        this.state.activityTimes.end = calculatedActivityEndLocal;
      }

      let dateRangeDisplayHtml = '';
      let durationDisplayHtml = '';
      let warningDuration = false;

      const isMultiDayDisplay = this.config.multiday && activityStartDate && activityEndDate &&
                               activityStartDate.getTime() !== activityEndDate.getTime();

      if (isMultiDayDisplay) {
        const formattedStartDate = formatFullDateForDisplay(activityStartDate, this.config.language);
        const formattedEndDate = formatFullDateForDisplay(activityEndDate, this.config.language);
        dateRangeDisplayHtml = `
          <div class="activity-time-row">
            <span class="activity-time-label"><strong>${this.t('dateRangeLabel')}</strong></span>
            <span class="activity-time-value">${formattedStartDate} - ${formattedEndDate}</span>
          </div>`;

        const numDays = Math.round(DateTime.fromJSDate(activityEndDate).diff(DateTime.fromJSDate(activityStartDate), 'days').days) + 1;

        durationDisplayHtml = `
          <div class="activity-time-row">
              <span class="activity-time-label">${this.t('activityDuration')}</span>
              <span class="activity-time-value">${numDays} ${numDays === 1 ? this.t('daySg') : this.t('dayPl')}</span>
          </div>`;
        warningDuration = false;
      } else {
        if (calculatedActivityStartLocal && calculatedActivityEndLocal) {
          const startDateForDuration = DateTime.fromFormat(calculatedActivityStartLocal, 'HH:mm', { zone: this.config.timezone })
                                          .set({ year: activityStartDate.getFullYear(), month: activityStartDate.getMonth() + 1, day: activityStartDate.getDate() });
          const endDateForDuration = DateTime.fromFormat(calculatedActivityEndLocal, 'HH:mm', { zone: this.config.timezone })
                                        .set({ year: activityStartDate.getFullYear(), month: activityStartDate.getMonth() + 1, day: activityStartDate.getDate() });

          const durationResult = calculateDurationLocalWithDates(startDateForDuration, endDateForDuration, (key) => this.t(key));
          durationDisplayHtml = `
              <div class="activity-time-row">
                  <span class="activity-time-label"><strong>${this.t('activityDuration')}</strong></span>
                  <span class="activity-time-value">${durationResult.text}</span>
              </div>`;
          warningDuration = durationResult.totalMinutes < parseInt(this.config.activityDurationMinutes, 10);
        } else {
          durationDisplayHtml = `
              <div class="activity-time-row">
                  <span class="activity-time-label"><strong>${this.t('activityDuration')}</strong></span>
                  <span class="activity-time-value">--</span>
              </div>`;
        }
      }
      this.state.activityTimes.warning_duration = warningDuration;


      this.elements.activityTimeBox.innerHTML = `
        <div class="activity-time-card">
          <div class="activity-time-header">${this.config.activityName}</div>
          <div class="activity-time-meta">
            ${isMultiDayDisplay ? dateRangeDisplayHtml : ''}
            <div class="activity-time-row">
              <span class="activity-time-label">${this.config.activityStartTimeLabel || this.t("activityStart")}</span>
              <span class="activity-time-value">${this.state.activityTimes.start || '--:--'} ${isMultiDayDisplay ? `(${formatLegDateForDisplay(activityStartDate.toISOString(), this.config.timezone, this.config.language)})` : ''}</span>
              <span class="activity-time-divider">•</span>
              <span class="activity-time-value">${this.config.activityStartLocationDisplayName || this.config.activityStartLocation}</span>
            </div>

            ${durationDisplayHtml}
            ${this.state.activityTimes.warning_duration ? `
              <div class="activity-time-row">
                  <span class="activity-time-label"></span> <div class="activity-time-warning-text">
                      ${this.t("warnings.duration")} (${getTimeFormatFromMinutes(this.config.activityDurationMinutes, (key) => this.t(key))})
                  </div>
              </div>
            ` : ''}

            <div class="activity-time-row">
              <span class="activity-time-label">${this.config.activityEndTimeLabel || this.t("activityEnd")}</span>
              <span class="activity-time-value">${this.state.activityTimes.end || '--:--'} ${isMultiDayDisplay ? `(${formatLegDateForDisplay(activityEndDate.toISOString(), this.config.timezone, this.config.language)})` : ''}</span>
              <span class="activity-time-divider">•</span>
              <span class="activity-time-value">${this.config.activityEndLocationDisplayName || this.config.activityEndLocation}</span>
            </div>
          </div>
        </div>`;
    } catch (error) {
      console.error("Error updating activity time box:", error);
      this.elements.activityTimeBox.innerHTML = `<div class="error-message">${this.t('errors.activityTimeError')}</div>`;
    }
  }

  renderConnectionDetails(connections, type) {
    if (!connections || connections.length === 0) {
      return `<div>${this.t('noConnectionDetails')}</div>`;
    }

    return connections.map(conn => {
      if (!conn.connection_elements || conn.connection_elements.length === 0) {
        return `<div>${this.t('noConnectionElements')}</div>`;
      }

      const filteredElements = conn.connection_elements.filter((element, index, arr) => {
        let durationMinutes = 0;
        if (typeof element.duration === 'number') {
            durationMinutes = element.duration;
        } else {
            const durationStr = calculateTimeDifference(element.departure_time, element.arrival_time, (key) => this.t(key));
            durationMinutes = parseDurationToMinutes(durationStr, (key) => this.t(key));
        }

        if (arr.length === 1) {
          return true;
        }

        if (type === 'from' && index === 0 && durationMinutes <= 1) {
          return false;
        }
        if (type === 'to' && index === arr.length - 1 && durationMinutes <= 1) {
          return false;
        }
        return true;
      });

      if (filteredElements.length === 0) {
          return `<div>${this.t('noConnectionElements')}</div>`;
      }

      let html = `<div class="connection-elements">`;
      let currentLegDateStr = null;

      if (type === 'from' && this.state.activityTimes.end) {
          const firstEffectiveLegDepartureISO = filteredElements[0].departure_time;
          const activityEndDate = this.config.multiday && this.state.selectedEndDate ? this.state.selectedEndDate : this.state.selectedDate;

          const activityEndDateTime = DateTime.fromFormat(this.state.activityTimes.end, 'HH:mm', { zone: this.config.timezone })
                                          .set({ year: activityEndDate.getFullYear(), month: activityEndDate.getMonth() + 1, day: activityEndDate.getDate() });

          const firstLegDepartureDateTime = DateTime.fromISO(firstEffectiveLegDepartureISO, {zone: 'utc'}).setZone(this.config.timezone);

          if (activityEndDateTime.isValid && firstLegDepartureDateTime.isValid && firstLegDepartureDateTime > activityEndDateTime) {
              const waitDuration = calculateDurationLocalWithDates(activityEndDateTime, firstLegDepartureDateTime, (key) => this.t(key));
              if (waitDuration.totalMinutes > 0) {
                  html += `
                  <div class="connection-element waiting-block">
                      <div class="element-time">
                      <span>${this.state.activityTimes.end}</span>
                      ${this.t('waiting.afterActivity')}
                      </div>
                      <div id="eleCont">
                      <span class="element-icon">${this.getTransportIcon('WAIT')}</span>
                      <span class="element-duration">
                          ${waitDuration.text}
                      </span>
                      </div>
                  </div>`;
              }
          }
      }

      filteredElements.forEach((element, index) => {
        const departureTime = convertUTCToLocalTime(element.departure_time, this.config.timezone);
        const arrivalTime = convertUTCToLocalTime(element.arrival_time, this.config.timezone);
        const durationDisplayString = calculateTimeDifference(element.departure_time, element.arrival_time, (key) => this.t(key));

        let icon = (element.type !== 'JNY') ? this.getTransportIcon(element.type || 'DEFAULT') : this.getTransportIcon(element.vehicle_type || 'DEFAULT');

        const legDepartureDateStr = formatLegDateForDisplay(element.departure_time, this.config.timezone, this.config.language);
        let dateDisplayHtml = '';
        if (legDepartureDateStr && (index === 0 || legDepartureDateStr !== currentLegDateStr)) {
          dateDisplayHtml = `<div class="connection-leg-date-display">${legDepartureDateStr}</div>`;
          currentLegDateStr = legDepartureDateStr;
        }

        let fromLocationDisplay = element.from_location;
        if (type === "to" && index === 0) {
          fromLocationDisplay = this.elements.originInput.value;
        } else if (type === "from" && index === 0) {
          fromLocationDisplay = this.config.activityEndLocationDisplayName;
        }

        html += `
          <div class="connection-element">
            ${dateDisplayHtml}
            <div class="element-time">
              <span>${departureTime}</span> ${fromLocationDisplay}
            </div>
            <div id="eleCont">
              <div class="element-circle"></div>
              <span class="element-icon">${icon}</span>
              <span class="element-duration">${this.getDurationString(index, type, element, durationDisplayString)}</span>
            </div>
          </div>
        `;

        if (index === filteredElements.length - 1) {
          let toLocationDisplay = element.to_location;
          let finalArrivalTime = arrivalTime;

          if (type === "to") {
            toLocationDisplay = this.config.activityStartLocationDisplayName || this.config.activityStartLocation;
          } else {
            toLocationDisplay = this.elements.originInput.value;
          }

          html += `
            <div class="connection-element">
              <div class="element-time">
                <span>${finalArrivalTime}</span> ${toLocationDisplay}
              </div>
              <div class="element-circle"></div>
            </div>
          `;
        }
      });

      if (type === 'to' && this.state.activityTimes.start && filteredElements.length > 0) {
          const lastLegArrivalTimeISO = filteredElements[filteredElements.length - 1].arrival_time;

          if (lastLegArrivalTimeISO) {
              const connectionEndDateTime = DateTime.fromISO(lastLegArrivalTimeISO, { zone: 'utc' }).setZone(this.config.timezone);
              const activityActualStartDateTime = DateTime.fromFormat(this.state.activityTimes.start, 'HH:mm', { zone: this.config.timezone })
                                                  .set({
                                                      year: connectionEndDateTime.year,
                                                      month: connectionEndDateTime.month,
                                                      day: connectionEndDateTime.day
                                                  });

              if (connectionEndDateTime.isValid && activityActualStartDateTime.isValid && activityActualStartDateTime > connectionEndDateTime) {
                  const waitDuration = calculateDurationLocalWithDates(connectionEndDateTime, activityActualStartDateTime, (key) => this.t(key));
                   if (waitDuration.totalMinutes > 0) {
                      html += `
                      <div class="connection-element waiting-block">
                          <div class="element-time">
                          <span>${convertUTCToLocalTime(lastLegArrivalTimeISO, this.config.timezone)}</span>
                          ${this.t('waiting.beforeActivity')}
                          </div>
                          <div id="eleCont">
                          <span class="element-icon">${this.getTransportIcon('WAIT')}</span>
                          <span class="element-duration">
                              ${waitDuration.text}
                          </span>
                          </div>
                      </div>`;
                  }
              }
          }
      }
      html += `</div>`;
      return html;
    }).join('');
  }

  getDurationString(index, type, element, duration) {
    let durationString = "";
    if (element.vehicle_name && element.type === "JNY") {
      let n_intermediate_stops = element.n_intermediate_stops + 1 || 0;
      const stopString = n_intermediate_stops !== 1 ? `, ${n_intermediate_stops} ${this.t("stopPl")})` : `, ${n_intermediate_stops} ${this.t("stopSg")})`;
      durationString = `${element.vehicle_name} -> ${element.direction} (${duration}`;
      durationString += (n_intermediate_stops > 0) ? ` ${stopString}` : `)`;
      return durationString;
    } else {
      durationString = `${duration}`;
    }
    if (element.type === "TRSF") durationString += ` ${this.t("durationTransferTime")}`;
    return durationString;
  }

  getTransportIcon(type) {
    // Map API vehicle type IDs or string types to SVG icons
    const icons = {
      1: `<svg width="16" height="16" viewBox="0 0 12 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.5 0.5H2.5C1.96957 0.5 1.46086 0.710714 1.08579 1.08579C0.710714 1.46086 0.5 1.96957 0.5 2.5V10.5C0.5 11.0304 0.710714 11.5391 1.08579 11.9142C1.46086 12.2893 1.96957 12.5 2.5 12.5H3L2.1 13.7C2.0606 13.7525 2.03194 13.8123 2.01564 13.8759C1.99935 13.9395 1.99574 14.0057 2.00503 14.0707C2.01431 14.1357 2.03631 14.1982 2.06976 14.2547C2.10322 14.3112 2.14747 14.3606 2.2 14.4C2.25253 14.4394 2.3123 14.4681 2.37591 14.4844C2.43952 14.5007 2.50571 14.5043 2.57071 14.495C2.63571 14.4857 2.69825 14.4637 2.75475 14.4302C2.81125 14.3968 2.8606 14.3525 2.9 14.3L4.25 12.5H7.75L9.1 14.3C9.17957 14.4061 9.29801 14.4762 9.42929 14.495C9.56056 14.5137 9.69391 14.4796 9.8 14.4C9.90609 14.3204 9.97622 14.202 9.99498 14.0707C10.0137 13.9394 9.97956 13.8061 9.9 13.7L9 12.5H9.5C10.0304 12.5 10.5391 12.2893 10.9142 11.9142C11.2893 11.5391 11.5 11.0304 11.5 10.5V2.5C11.5 1.96957 11.2893 1.46086 10.9142 1.08579C10.5391 0.710714 10.0304 0.5 9.5 0.5ZM2.5 1.5H9.5C9.76522 1.5 10.0196 1.60536 10.2071 1.79289C10.3946 1.98043 10.5 2.23478 10.5 2.5V6.5H1.5V2.5C1.5 2.23478 1.60536 1.98043 1.79289 1.79289C1.98043 1.60536 2.23478 1.5 2.5 1.5ZM9.5 11.5H2.5C2.23478 11.5 1.98043 11.3946 1.79289 11.2071C1.60536 11.0196 1.5 10.7652 1.5 10.5V7.5H10.5V10.5C10.5 10.7652 10.3946 11.0196 10.2071 11.2071C10.0196 11.3946 9.76522 11.5 9.5 11.5ZM4 9.75C4 9.89834 3.95601 10.0433 3.8736 10.1667C3.79119 10.29 3.67406 10.3861 3.53701 10.4429C3.39997 10.4997 3.24917 10.5145 3.10368 10.4856C2.9582 10.4567 2.82456 10.3852 2.71967 10.2803C2.61478 10.1754 2.54335 10.0418 2.51441 9.89632C2.48547 9.75083 2.50032 9.60003 2.55709 9.46299C2.61386 9.32594 2.70999 9.20881 2.83332 9.1264C2.95666 9.04399 3.10166 9 3.25 9C3.44891 9 3.63968 9.07902 3.78033 9.21967C3.92098 9.36032 4 9.55109 4 9.75ZM9.5 9.75C9.5 9.89834 9.45601 10.0433 9.3736 10.1667C9.29119 10.29 9.17406 10.3861 9.03701 10.4429C8.89997 10.4997 8.74917 10.5145 8.60368 10.4856C8.4582 10.4567 8.32456 10.3852 8.21967 10.2803C8.11478 10.1754 8.04335 10.0418 8.01441 9.89632C7.98547 9.75083 8.00033 9.60003 8.05709 9.46299C8.11386 9.32594 8.20999 9.20881 8.33332 9.1264C8.45666 9.04399 8.60166 9 8.75 9C8.94891 9 9.13968 9.07902 9.28033 9.21967C9.42098 9.36032 9.5 9.55109 9.5 9.75Z" fill="#34C759"/></svg>`,
      2: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M16 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>`,
      3: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M18.5 3L17.5135 2.50675C17.1355 2.31776 16.9465 2.22326 16.7485 2.15662C16.5725 2.09744 16.3915 2.05471 16.2077 2.02897C16.0008 2 15.7895 2 15.3669 2H8.63313C8.21053 2 7.99923 2 7.79227 2.02897C7.60847 2.05471 7.42745 2.09744 7.25155 2.15662C7.05348 2.22326 6.86449 2.31776 6.4865 2.50675L5.5 3M11 6L9 2M13 6L15 2M4 13H20M17 20L18 22M7 20L6.00016 22M8.5 16.5H8.51M15.5 16.5H15.51M8.8 20H15.2C16.8802 20 17.7202 20 18.362 19.673C18.9265 19.3854 19.3854 18.9265 19.673 18.362C20 17.7202 20 16.8802 20 15.2V10.8C20 9.11984 20 8.27976 19.673 7.63803C19.3854 7.07354 18.9265 6.6146 18.362 6.32698C17.7202 6 16.8802 6 15.2 6H8.8C7.11984 6 6.27976 6 5.63803 6.32698C5.07354 6.6146 4.6146 7.07354 4.32698 7.63803C4 8.27976 4 9.11984 4 10.8V15.2C4 16.8802 4 17.7202 4.32698 18.362C4.6146 18.9265 5.07354 19.3854 5.63803 19.673C6.27976 20 7.11984 20 8.8 20ZM9 16.5C9 16.7761 8.77614 17 8.5 17C8.22386 17 8 16.7761 8 16.5C8 16.2239 8.22386 16 8.5 16C8.77614 16 9 16.2239 9 16.5ZM16 16.5C16 16.7761 15.7761 17 15.5 17C15.2239 17 15 16.7761 15 16.5C15 16.2239 15.2239 16 15.5 16C15.7761 16 16 16.2239 16 16.5Z" stroke="#34C759" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>`,
      4: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M9.5 22H14.5M8 2H16M12 5V2M4 12H20M17 19L18.5 22M7 19L5.5 22M8.5 15.5H8.51M15.5 15.5H15.51M8.8 19H15.2C16.8802 19 17.7202 19 18.362 18.673C18.9265 18.3854 19.3854 17.9265 19.673 17.362C20 16.7202 20 15.8802 20 14.2V9.8C20 8.11984 20 7.27976 19.673 6.63803C19.3854 6.07354 18.9265 5.6146 18.362 5.32698C17.7202 5 16.8802 5 15.2 5H8.8C7.11984 5 6.27976 5 5.63803 5.32698C5.07354 5.6146 4.6146 6.07354 4.32698 6.63803C4 7.27976 4 8.11984 4 9.8V14.2C4 15.8802 4 16.7202 4.32698 17.362C4.6146 17.9265 5.07354 18.3854 5.63803 18.673C6.27976 19 7.11984 19 8.8 19ZM9 15.5C9 15.7761 8.77614 16 8.5 16C8.22386 16 8 15.7761 8 15.5C8 15.2239 8.22386 15 8.5 15C8.77614 15 9 15.2239 9 15.5ZM16 15.5C16 15.7761 15.7761 16 15.5 16C15.2239 16 15 15.7761 15 15.5C15 15.2239 15.2239 15 15.5 15C15.7761 15 16 15.2239 16 15.5Z" stroke="#34C759" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>`,
      5: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" id="svg1" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg"><defs id="defs1"/><sodipodi:namedview id="namedview1" pagecolor="#ffffff" bordercolor="#000000" borderopacity="0.25" inkscape:showpageshadow="2" inkscape:pageopacity="0.0" inkscape:pagecheckerboard="0" inkscape:deskcolor="#d1d1d1" inkscape:zoom="0.52325902" inkscape:cx="386.04208" inkscape:cy="397.50868" inkscape:window-width="1440" inkscape:window-height="830" inkscape:window-x="-6" inkscape:window-y="-6" inkscape:window-maximized="1" inkscape:current-layer="SVGRepo_iconCarrier"/><g id="SVGRepo_bgCarrier" stroke-width="0"/><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/><g id="SVGRepo_iconCarrier"><path d="m 13.760301,18.985667 v 2.2 c 0,0.28 0,0.42 -0.0545,0.527 -0.04793,0.0941 -0.12442,0.1706 -0.2185,0.2185 -0.10696,0.0545 -0.24697,0.0545 -0.527,0.0545 h -1.9 c -0.28003,0 -0.42004,0 -0.527,-0.0545 -0.09408,-0.0479 -0.17057,-0.1244 -0.2185,-0.2185 -0.0545,-0.107 -0.0545,-0.247 -0.0545,-0.527 v -2.2 M 3,12 H 21 M 3,5.5 H 21 M 6.5,15.5 H 8 m 8,0 h 1.5 M 7.8,19 h 8.4 c 1.6802,0 2.5202,0 3.162,-0.327 0.5645,-0.2876 1.0234,-0.7465 1.311,-1.311 C 21,16.7202 21,15.8802 21,14.2 V 6.8 C 21,5.11984 21,4.27976 20.673,3.63803 20.3854,3.07354 19.9265,2.6146 19.362,2.32698 18.7202,2 17.8802,2 16.2,2 H 7.8 C 6.11984,2 5.27976,2 4.63803,2.32698 4.07354,2.6146 3.6146,3.07354 3.32698,3.63803 3,4.27976 3,5.11984 3,6.8 v 7.4 c 0,1.6802 0,2.5202 0.32698,3.162 0.28762,0.5645 0.74656,1.0234 1.31105,1.311 C 5.27976,19 6.11984,19 7.8,19 Z" stroke="#34C759" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="path1"/></g></svg>`,
      6: `<svg width="16" height="16" viewBox="0 0 12 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.5 0.5H2.5C1.96957 0.5 1.46086 0.710714 1.08579 1.08579C0.710714 1.46086 0.5 1.96957 0.5 2.5V10.5C0.5 11.0304 0.710714 11.5391 1.08579 11.9142C1.46086 12.2893 1.96957 12.5 2.5 12.5H3L2.1 13.7C2.0606 13.7525 2.03194 13.8123 2.01564 13.8759C1.99935 13.9395 1.99574 14.0057 2.00503 14.0707C2.01431 14.1357 2.03631 14.1982 2.06976 14.2547C2.10322 14.3112 2.14747 14.3606 2.2 14.4C2.25253 14.4394 2.3123 14.4681 2.37591 14.4844C2.43952 14.5007 2.50571 14.5043 2.57071 14.495C2.63571 14.4857 2.69825 14.4637 2.75475 14.4302C2.81125 14.3968 2.8606 14.3525 2.9 14.3L4.25 12.5H7.75L9.1 14.3C9.17957 14.4061 9.29801 14.4762 9.42929 14.495C9.56056 14.5137 9.69391 14.4796 9.8 14.4C9.90609 14.3204 9.97622 14.202 9.99498 14.0707C10.0137 13.9394 9.97956 13.8061 9.9 13.7L9 12.5H9.5C10.0304 12.5 10.5391 12.2893 10.9142 11.9142C11.2893 11.5391 11.5 11.0304 11.5 10.5V2.5C11.5 1.96957 11.2893 1.46086 10.9142 1.08579C10.5391 0.710714 10.0304 0.5 9.5 0.5ZM2.5 1.5H9.5C9.76522 1.5 10.0196 1.60536 10.2071 1.79289C10.3946 1.98043 10.5 2.23478 10.5 2.5V6.5H1.5V2.5C1.5 2.23478 1.60536 1.98043 1.79289 1.79289C1.98043 1.60536 2.23478 1.5 2.5 1.5ZM9.5 11.5H2.5C2.23478 11.5 1.98043 11.3946 1.79289 11.2071C1.60536 11.0196 1.5 10.7652 1.5 10.5V7.5H10.5V10.5C10.5 10.7652 10.3946 11.0196 10.2071 11.2071C10.0196 11.3946 9.76522 11.5 9.5 11.5ZM4 9.75C4 9.89834 3.95601 10.0433 3.8736 10.1667C3.79119 10.29 3.67406 10.3861 3.53701 10.4429C3.39997 10.4997 3.24917 10.5145 3.10368 10.4856C2.9582 10.4567 2.82456 10.3852 2.71967 10.2803C2.61478 10.1754 2.54335 10.0418 2.51441 9.89632C2.48547 9.75083 2.50032 9.60003 2.55709 9.46299C2.61386 9.32594 2.70999 9.20881 2.83332 9.1264C2.95666 9.04399 3.10166 9 3.25 9C3.44891 9 3.63968 9.07902 3.78033 9.21967C3.92098 9.36032 4 9.55109 4 9.75ZM9.5 9.75C9.5 9.89834 9.45601 10.0433 9.3736 10.1667C9.29119 10.29 9.17406 10.3861 9.03701 10.4429C8.89997 10.4997 8.74917 10.5145 8.60368 10.4856C8.4582 10.4567 8.32456 10.3852 8.21967 10.2803C8.11478 10.1754 8.04335 10.0418 8.01441 9.89632C7.98547 9.75083 8.00033 9.60003 8.05709 9.46299C8.11386 9.32594 8.20999 9.20881 8.33332 9.1264C8.45666 9.04399 8.60166 9 8.75 9C8.94891 9 9.13968 9.07902 9.28033 9.21967C9.42098 9.36032 9.5 9.55109 9.5 9.75Z" fill="#34C759"/></svg>`,
      7: `<svg width="16" height="16" viewBox="0 0 512.000000 512.000000" preserveAspectRatio="xMidYMid meet" id="svg3" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg"><defs id="defs3"/><sodipodi:namedview id="namedview3" pagecolor="#ffffff" bordercolor="#34C759" borderopacity="0.25" inkscape:showpageshadow="2" inkscape:pageopacity="0.0" inkscape:pagecheckerboard="0" inkscape:deskcolor="#d1d1d1" inkscape:document-units="pt" inkscape:zoom="0.61319416" inkscape:cx="528.38076" inkscape:cy="500.65708" inkscape:window-width="1440" inkscape:window-height="830" inkscape:window-x="-6" inkscape:window-y="-6" inkscape:window-maximized="1" inkscape:current-layer="g3"/><g transform="translate(0.000000,512.000000) scale(0.100000,-0.100000)" fill="#34C759" stroke="#34C759" id="g3"><path d="M 2715,3925 C 1989,3785 1319,3657 1227,3639 l -168,-31 -60,-72 C 731,3221 531,2711 491,2245 c -16,-183 -15,-245 6,-245 13,0 357,66 1348,258 l 232.7027,43.9459 3,242 c 1,133 -7.4413,238.2229 -10.4413,238.2229 -4,0 -261.2614,-44.1688 -406.2614,-72.1688 -144,-27 -268,-50 -273,-50 -8,0 -10,120 -9,402 l 3,401 330,64 c 182,34 336,63 343,63 9,0 12,-135 12,-641 v -642 l 48,7 c 42,6 201,36 799,153 l 193,37 2,645 3,645 145,27 c 392,75 519,99 529,99 8,0 11,-117 11,-402 v -403 l -233,-43 c -127,-24 -253,-48 -279,-54 l -182.0541,-33.7838 v -240 -240 L 3268,2534 c 28.1639,5.1762 604,118 1067,207 143,28 268,53 278,55 15,5 17,18 17,99 0,107 -14,183 -71,378 -101,351 -250,677 -372,817 -49,56 -97,90 -126,89 -14,-1 -620,-115 -1346,-254 z m 1349,0 c 69,-92 170,-312 255,-559 23,-65 41,-124 41,-131 0,-8 -55,-23 -167,-44 -93,-18 -178,-35 -190,-38 l -23,-5 v 405 c 0,433 -2,409 42,416 4,0 23,-19 42,-44 z M 2940,3355 c 0,-223 -3,-405 -6,-405 -10,0 -648,-121 -666,-126 -17,-5 -18,19 -18,400 v 405 l 38,7 c 20,4 170,33 332,64 162,32 301,58 308,59 9,1 12,-86 12,-404 z M 1210,3027 v -403 l -222,-42 c -123,-24 -228,-42 -235,-42 -16,0 35,188 88,324 95,246 294,566 353,566 14,0 16,-39 16,-403 z" id="path1" sodipodi:nodetypes="cccccscccscscccsscccccccssccccccsccsccccccscccsccsscsccccssccscss"/><path d="M2537 2260 c-1127 -219 -2050 -400 -2052 -402 -9 -9 18 -118 40 -164 31 -63 79 -108 155 -143 101 -47 71 -51 1725 268 831 161 1582 306 1670 323 218 41 288 70 388 157 81 72 167 239 167 326 0 30 -3 35 -22 34 -13 0 -945 -180 -2071 -399z" id="path2"/><path d="M4480 2046 c0 -68 -2 -74 -22 -79 -46 -11 -450 -87 -464 -87 -10 0 -14 14 -14 56 0 48 -2 55 -17 50 -10 -3 -48 -10 -85 -17 l-68 -11 0 -58 0 -57 -212 -41 c-117 -22 -230 -44 -250 -48 l-38 -6 0 57 c0 54 -1 57 -22 52 -13 -3 -51 -11 -85 -18 l-63 -12 0 -56 0 -57 -227 -43 c-126 -23 -236 -45 -245 -47 -16 -5 -18 2 -18 50 0 31 -4 56 -8 56 -12 0 -124 -20 -144 -26 -14 -4 -18 -17 -18 -59 0 -48 -3 -55 -22 -60 -13 -3 -125 -25 -250 -49 l-228 -43 0 54 c0 64 7 63 -147 28 -20 -5 -23 -12 -23 -59 l0 -55 -52 -10 c-124 -25 -424 -81 -435 -81 -9 0 -13 16 -13 50 0 58 -2 58 -105 37 l-60 -13 -3 -57 c-2 -31 -6 -57 -10 -57 -4 0 -113 -20 -242 -45 -129 -25 -236 -45 -237 -45 -2 0 -3 25 -3 55 l0 55 -85 0 -85 0 0 -205 c0 -133 4 -205 10 -205 6 0 554 104 1218 231 664 126 1477 282 1807 345 330 63 695 132 810 154 116 23 234 45 263 51 l52 10 0 195 0 194 -80 0 -80 0 0 -74z" id="path3"/></g></svg>`,
      8: `<svg width="16" height="16" viewBox="0 0 330 330" fill="#34C759" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xml:space="preserve"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path id="XMLID_28_" d="M315,10H15C6.716,10,0,16.716,0,25s6.716,15,15,15h116.557L85.403,140H55 c-7.643,0-14.064,5.747-14.908,13.344l-10,90c-0.016,0.145-0.013,0.289-0.025,0.434c-0.021,0.262-0.038,0.523-0.045,0.786 c-0.008,0.278-0.006,0.556,0.001,0.833c0.007,0.254,0.017,0.507,0.037,0.761c0.022,0.288,0.056,0.571,0.095,0.857 c0.021,0.15,0.025,0.302,0.05,0.452l10,60C41.41,314.699,47.667,320,55,320h220c7.332,0,13.59-5.301,14.796-12.534l10-60 c0.025-0.15,0.03-0.302,0.05-0.452c0.039-0.285,0.073-0.568,0.095-0.857c0.02-0.254,0.03-0.507,0.037-0.761 c0.007-0.277,0.009-0.555,0.001-0.833c-0.008-0.263-0.024-0.524-0.045-0.786c-0.012-0.145-0.009-0.289-0.025-0.434l-10-90 C289.064,145.747,282.643,140,275,140h-30.409L198.442,40H315c8.284,0,15-6.716,15-15S323.284,10,315,10z M140,230v-60h50v60H140z M68.426,170h26.492c0.024,0,0.049,0.004,0.073,0.004c0.037,0,0.073-0.004,0.11-0.004H110v60H61.759L68.426,170z M262.293,290 H67.707l-5-30h204.586L262.293,290z M268.241,230H220v-60h14.515c0.165,0.006,0.329,0.018,0.495,0.018c0.11,0,0.22-0.016,0.33-0.018 h26.235L268.241,230z M211.551,140h-93.108l46.154-100h0.805L211.551,140z"></path> </g></svg>`,
      9: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M4 17.5L3 12L12 9L21 12L20 17.5M5 11.3333V7C5 5.89543 5.89543 5 7 5H17C18.1046 5 19 5.89543 19 7V11.3333M10 5V3C10 2.44772 10.4477 2 11 2H13C13.5523 2 14 2.44772 14 3V5M2 21C3 22 6 22 8 20C10 22 14 22 16 20C18 22 21 22 22 21" stroke="#34C759" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>`,
      10: `<svg width="16" height="16" viewBox="0 0 512 512" fill="#34C759" id="_x32_" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" stroke="#34C759"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <style type="text/css">  .st0{fill:#34C759;}  </style> <g> <path class="st0" d="M492.797,262.25h-22.109c-10.563,0-23.313-7.594-28.375-16.875l-36.406-67.094 c-5.031-9.281-17.813-16.891-28.375-16.891H206.625c-10.563,0-24.5,6.828-30.953,15.203l-54.328,70.438 c-6.469,8.375-20.391,15.219-30.938,15.219H60.531c-33.313,0-53.813,15.875-58.609,47.906L0,343.891 c0,10.578,8.656,19.234,19.219,19.234H66.5c2.344,26.969,25.031,48.188,52.625,48.188c27.563,0,50.266-21.219,52.609-48.188 h186.172c2.313,23.813,22.406,42.438,46.844,42.438s44.531-18.625,46.844-42.438h41.203c10.547,0,19.203-8.656,19.203-19.234 v-62.422C512,270.891,503.344,262.25,492.797,262.25z M119.125,382.031c-13,0-23.547-10.531-23.547-23.531 s10.547-23.531,23.547-23.531s23.531,10.531,23.531,23.531S132.125,382.031,119.125,382.031z M291.063,261.375H152.125l7.219-9.375 l44.375-57.531c3.031-3.906,11.453-8.063,16.406-8.063h70.938V261.375z M314.125,261.375v-74.969h53.844 c4.031,0,10.578,3.906,12.516,7.469l34.594,67.5H314.125z M404.75,382.031c-13,0-23.531-10.531-23.531-23.531 s10.531-23.531,23.531-23.531s23.531,10.531,23.531,23.531S417.75,382.031,404.75,382.031z"></path> <path class="st0" d="M225.859,122.844c0.016-6.219,5.063-11.281,11.281-11.281h105.25c6.234,0,11.297,5.063,11.297,11.281v30.5 h10.875v-30.5c0-12.234-9.922-22.156-22.172-22.156h-105.25c-12.234,0-22.156,9.922-22.172,22.156v30.5h10.891V122.844z"></path> <path class="st0" d="M249.188,149.938h5.531c0.266,0,0.438-0.156,0.438-0.406v-22.297c0-0.172,0.078-0.234,0.25-0.234h7.484 c0.266,0,0.422-0.188,0.422-0.438v-4.625c0-0.25-0.156-0.438-0.422-0.438h-21.859c-0.281,0-0.438,0.188-0.438,0.438v4.625 c0,0.25,0.156,0.438,0.438,0.438h7.469c0.172,0,0.266,0.063,0.266,0.234v22.297C248.766,149.781,248.938,149.938,249.188,149.938z"></path> <path class="st0" d="M275.422,121.5c-0.313,0-0.484,0.188-0.563,0.438l-10.172,27.594c-0.094,0.25,0,0.406,0.297,0.406h5.703 c0.281,0,0.469-0.125,0.563-0.406l1.656-5h10.344l1.688,5c0.094,0.281,0.266,0.406,0.578,0.406h5.641 c0.313,0,0.391-0.156,0.313-0.406l-10-27.594c-0.094-0.25-0.266-0.438-0.563-0.438H275.422z M281.516,139.313h-6.828l3.344-9.938 h0.125L281.516,139.313z"></path> <path class="st0" d="M295.516,149.938h6.016c0.375,0,0.563-0.125,0.734-0.406l5.297-8.656h0.125l5.266,8.656 c0.172,0.281,0.359,0.406,0.734,0.406h6.063c0.281,0,0.375-0.25,0.25-0.5l-8.875-14.172L319.391,122 c0.125-0.25,0.031-0.5-0.266-0.5h-6.031c-0.359,0-0.531,0.125-0.719,0.438l-4.688,7.688h-0.125l-4.688-7.688 c-0.188-0.313-0.359-0.438-0.719-0.438h-6.031c-0.313,0-0.391,0.25-0.25,0.5l8.219,13.266l-8.828,14.172 C295.094,149.688,295.219,149.938,295.516,149.938z"></path> <path class="st0" d="M326.875,121.938v27.594c0,0.25,0.188,0.406,0.438,0.406h5.531c0.25,0,0.438-0.156,0.438-0.406v-27.594 c0-0.25-0.188-0.438-0.438-0.438h-5.531C327.063,121.5,326.875,121.688,326.875,121.938z"></path> </g> </g></svg>`,
      20: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
      30: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
      31: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#000000"  xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M7.97,2.242l-5,20A1,1,0,0,1,2,23a1.025,1.025,0,0,1-.244-.03,1,1,0,0,1-.727-1.212l5-20a1,1,0,1,1,1.94.484Zm10-.484a1,1,0,1,0-1.94.484l5,20A1,1,0,0,0,22,23a1.017,1.017,0,0,0,.243-.03,1,1,0,0,0,.728-1.212ZM12,1a1,1,0,0,0-1,1V6a1,1,0,0,0,2,0V2A1,1,0,0,0,12,1Zm0,7.912a1,1,0,0,0-1,1v4.176a1,1,0,1,0,2,0V9.912A1,1,0,0,0,12,8.912ZM12,17a1,1,0,0,0-1,1v4a1,1,0,0,0,2,0V18A1,1,0,0,0,12,17Z"></path></g></svg>`,
      32: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
      33: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M9 5.25C7.03323 5.25 5.25 7.15209 5.25 9.75C5.25 12.0121 6.60204 13.7467 8.25001 14.1573V10.9014L6.33398 9.62405L7.16603 8.37597L8.792 9.45995L9.87597 7.83398L11.124 8.66603L9.75001 10.7271V14.1573C11.398 13.7467 12.75 12.0121 12.75 9.75C12.75 7.15209 10.9668 5.25 9 5.25ZM3.75 9.75C3.75 12.6785 5.62993 15.2704 8.25001 15.6906V19.5H3V21H21V19.5H18.75V18L18 17.25H12L11.25 18V19.5H9.75001V15.6906C12.3701 15.2704 14.25 12.6785 14.25 9.75C14.25 6.54892 12.0038 3.75 9 3.75C5.99621 3.75 3.75 6.54892 3.75 9.75ZM12.75 19.5H17.25V18.75H12.75V19.5Z" fill="#000"></path> </g></svg>`,
      WALK: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.50003 5C9.8956 5 10.2823 4.8827 10.6112 4.66294C10.9401 4.44318 11.1964 4.13082 11.3478 3.76537C11.4992 3.39992 11.5388 2.99778 11.4616 2.60982C11.3844 2.22186 11.194 1.86549 10.9142 1.58579C10.6345 1.30608 10.2782 1.1156 9.89021 1.03843C9.50225 0.96126 9.10012 1.00087 8.73467 1.15224C8.36921 1.30362 8.05686 1.55996 7.83709 1.88886C7.61733 2.21776 7.50003 2.60444 7.50003 3C7.50003 3.53043 7.71075 4.03914 8.08582 4.41422C8.46089 4.78929 8.9696 5 9.50003 5ZM9.50003 2C9.69781 2 9.89115 2.05865 10.0556 2.16853C10.2201 2.27841 10.3482 2.43459 10.4239 2.61732C10.4996 2.80004 10.5194 3.00111 10.4808 3.19509C10.4422 3.38907 10.347 3.56726 10.2071 3.70711C10.0673 3.84696 9.8891 3.9422 9.69512 3.98079C9.50114 4.01937 9.30007 3.99957 9.11735 3.92388C8.93462 3.84819 8.77844 3.72002 8.66856 3.55557C8.55868 3.39112 8.50003 3.19778 8.50003 3C8.50003 2.73478 8.60539 2.48043 8.79293 2.29289C8.98046 2.10536 9.23482 2 9.50003 2ZM13.5 9C13.5 9.13261 13.4474 9.25979 13.3536 9.35356C13.2598 9.44732 13.1326 9.5 13 9.5C10.7932 9.5 9.69066 8.38688 8.80503 7.4925C8.63378 7.31938 8.47003 7.155 8.30503 7.0025L7.46566 8.9325L9.79066 10.5931C9.85542 10.6394 9.9082 10.7004 9.94462 10.7712C9.98104 10.842 10 10.9204 10 11V14.5C10 14.6326 9.94735 14.7598 9.85359 14.8536C9.75982 14.9473 9.63264 15 9.50003 15C9.36742 15 9.24025 14.9473 9.14648 14.8536C9.05271 14.7598 9.00003 14.6326 9.00003 14.5V11.2575L7.05816 9.87L4.95878 14.6994C4.91993 14.7887 4.85581 14.8648 4.77431 14.9182C4.69281 14.9716 4.59747 15 4.50003 15C4.43137 15.0002 4.36345 14.9859 4.30066 14.9581C4.17911 14.9053 4.08351 14.8064 4.03488 14.6831C3.98624 14.5598 3.98855 14.4222 4.04128 14.3006L7.42128 6.5275C6.83941 6.42438 6.11378 6.6025 5.25253 7.06375C4.56566 7.44263 3.92458 7.89917 3.34191 8.42438C3.24465 8.51149 3.11717 8.55711 2.98673 8.55148C2.85628 8.54584 2.73321 8.48941 2.64383 8.39423C2.55444 8.29905 2.50584 8.17268 2.5084 8.04213C2.51096 7.91159 2.56448 7.78723 2.65753 7.69563C2.81378 7.54875 6.51316 4.11875 8.82753 6.12813C9.06691 6.33563 9.29503 6.56563 9.51503 6.78875C10.3869 7.66875 11.21 8.5 13 8.5C13.1326 8.5 13.2598 8.55268 13.3536 8.64645C13.4474 8.74022 13.5 8.86739 13.5 9Z" fill="#FF9500"/></svg>`,
      WALK_BLACK: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.50003 5C9.8956 5 10.2823 4.8827 10.6112 4.66294C10.9401 4.44318 11.1964 4.13082 11.3478 3.76537C11.4992 3.39992 11.5388 2.99778 11.4616 2.60982C11.3844 2.22186 11.194 1.86549 10.9142 1.58579C10.6345 1.30608 10.2782 1.1156 9.89021 1.03843C9.50225 0.96126 9.10012 1.00087 8.73467 1.15224C8.36921 1.30362 8.05686 1.55996 7.83709 1.88886C7.61733 2.21776 7.50003 2.60444 7.50003 3C7.50003 3.53043 7.71075 4.03914 8.08582 4.41422C8.46089 4.78929 8.9696 5 9.50003 5ZM9.50003 2C9.69781 2 9.89115 2.05865 10.0556 2.16853C10.2201 2.27841 10.3482 2.43459 10.4239 2.61732C10.4996 2.80004 10.5194 3.00111 10.4808 3.19509C10.4422 3.38907 10.347 3.56726 10.2071 3.70711C10.0673 3.84696 9.8891 3.9422 9.69512 3.98079C9.50114 4.01937 9.30007 3.99957 9.11735 3.92388C8.93462 3.84819 8.77844 3.72002 8.66856 3.55557C8.55868 3.39112 8.50003 3.19778 8.50003 3C8.50003 2.73478 8.60539 2.48043 8.79293 2.29289C8.98046 2.10536 9.23482 2 9.50003 2ZM13.5 9C13.5 9.13261 13.4474 9.25979 13.3536 9.35356C13.2598 9.44732 13.1326 9.5 13 9.5C10.7932 9.5 9.69066 8.38688 8.80503 7.4925C8.63378 7.31938 8.47003 7.155 8.30503 7.0025L7.46566 8.9325L9.79066 10.5931C9.85542 10.6394 9.9082 10.7004 9.94462 10.7712C9.98104 10.842 10 10.9204 10 11V14.5C10 14.6326 9.94735 14.7598 9.85359 14.8536C9.75982 14.9473 9.63264 15 9.50003 15C9.36742 15 9.24025 14.9473 9.14648 14.8536C9.05271 14.7598 9.00003 14.6326 9.00003 14.5V11.2575L7.05816 9.87L4.95878 14.6994C4.91993 14.7887 4.85581 14.8648 4.77431 14.9182C4.69281 14.9716 4.59747 15 4.50003 15C4.43137 15.0002 4.36345 14.9859 4.30066 14.9581C4.17911 14.9053 4.08351 14.8064 4.03488 14.6831C3.98624 14.5598 3.98855 14.4222 4.04128 14.3006L7.42128 6.5275C6.83941 6.42438 6.11378 6.6025 5.25253 7.06375C4.56566 7.44263 3.92458 7.89917 3.34191 8.42438C3.24465 8.51149 3.11717 8.55711 2.98673 8.55148C2.85628 8.54584 2.73321 8.48941 2.64383 8.39423C2.55444 8.29905 2.50584 8.17268 2.5084 8.04213C2.51096 7.91159 2.56448 7.78723 2.65753 7.69563C2.81378 7.54875 6.51316 4.11875 8.82753 6.12813C9.06691 6.33563 9.29503 6.56563 9.51503 6.78875C10.3869 7.66875 11.21 8.5 13 8.5C13.1326 8.5 13.2598 8.55268 13.3536 8.64645C13.4474 8.74022 13.5 8.86739 13.5 9Z" fill="#000"/></svg>`,
      TRSF: `<svg width="16" height="16" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.8537 8.85354L12.8537 10.8535C12.7598 10.9474 12.6326 11.0001 12.4999 11.0001C12.3672 11.0001 12.24 10.9474 12.1462 10.8535C12.0523 10.7597 11.9996 10.6325 11.9996 10.4998C11.9996 10.3671 12.0523 10.2399 12.1462 10.146L13.293 8.99979H2.70678L3.85366 10.146C3.94748 10.2399 4.00018 10.3671 4.00018 10.4998C4.00018 10.6325 3.94748 10.7597 3.85366 10.8535C3.75983 10.9474 3.63259 11.0001 3.49991 11.0001C3.36722 11.0001 3.23998 10.9474 3.14616 10.8535L1.14616 8.85354C1.09967 8.8071 1.06279 8.75196 1.03763 8.69126C1.01246 8.63056 0.999512 8.5655 0.999512 8.49979C0.999512 8.43408 1.01246 8.36902 1.03763 8.30832C1.06279 8.24762 1.09967 8.19248 1.14616 8.14604L3.14616 6.14604C3.23998 6.05222 3.36722 5.99951 3.49991 5.99951C3.63259 5.99951 3.75983 6.05222 3.85366 6.14604C3.94748 6.23986 4.00018 6.36711 4.00018 6.49979C4.00018 6.63247 3.94748 6.75972 3.85366 6.85354L2.70678 7.99979H13.293L12.1462 6.85354C12.0523 6.75972 11.9996 6.63247 11.9996 6.49979C11.9996 6.36711 12.0523 6.23986 12.1462 6.14604C12.24 6.05222 12.3672 5.99951 12.4999 5.99951C12.6326 5.99951 12.7598 6.05222 12.8537 6.14604L14.8537 8.14604C14.9001 8.19248 14.937 8.24762 14.9622 8.30832C14.9873 8.36902 15.0003 8.43408 15.0003 8.49979C15.0003 8.5655 14.9873 8.63056 14.9622 8.69126C14.937 8.75196 14.9001 8.8071 14.8537 8.85354Z" fill="black"/></svg>`,
      WAIT: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF9500"><circle cx="12" cy="12" r="9" stroke-width="2"/><path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round"/></svg>`,
      DEFAULT: `<svg width="16" height="16" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 0.5C7.5 0.632608 7.44732 0.759785 7.35355 0.853553C7.25979 0.947321 7.13261 1 7 1H5C4.86739 1 4.74021 0.947321 4.64645 0.853553C4.55268 0.759785 4.5 0.632608 4.5 0.5C4.5 0.367392 4.55268 0.240215 4.64645 0.146447C4.74021 0.0526785 4.86739 0 5 0H7C7.13261 0 7.25979 0.0526785 7.35355 0.146447C7.44732 0.240215 7.5 0.367392 7.5 0.5ZM7 11H5C4.86739 11 4.74021 11.0527 4.64645 11.1464C4.55268 11.2402 4.5 11.3674 4.5 11.5C4.5 11.6326 4.55268 11.7598 4.64645 11.8536C4.74021 11.9473 4.86739 12 5 12H7C7.13261 12 7.25979 11.9473 7.35355 11.8536C7.44732 11.7598 7.5 11.6326 7.5 11.5C7.5 11.3674 7.44732 11.2402 7.35355 11.1464C7.25979 11.0527 7.13261 11 7 11ZM11 0H9.5C9.36739 0 9.24021 0.0526785 9.14645 0.146447C9.05268 0.240215 9 0.367392 9 0.5C9 0.632608 9.05268 0.759785 9.14645 0.853553C9.24021 0.947321 9.36739 1 9.5 1H11V2.5C11 2.63261 11.0527 2.75979 11.1464 2.85355C11.2402 2.94732 11.3674 3 11.5 3C11.6326 3 11.7598 2.94732 11.8536 2.85355C11.9473 2.75979 12 2.63261 12 2.5V1C12 0.734784 11.8946 0.48043 11.7071 0.292893C11.5196 0.105357 11.2652 0 11 0ZM11.5 4.5C11.3674 4.5 11.2402 4.55268 11.1464 4.64645C11.0527 4.74021 11 4.86739 11 5V7C11 7.13261 11.0527 7.25979 11.1464 7.35355C11.2402 7.44732 11.3674 7.5 11.5 7.5C11.6326 7.5 11.7598 7.44732 11.8536 7.35355C11.9473 7.25979 12 7.13261 12 7V5C12 4.86739 11.9473 4.74021 11.8536 4.64645C11.7598 4.55268 11.6326 4.5 11.5 4.5ZM11.5 9C11.3674 9 11.2402 9.05268 11.1464 9.14645C11.0527 9.24021 11 9.36739 11 9.5V11H9.5C9.36739 11 9.24021 11.0527 9.14645 11.1464C9.05268 11.2402 9 11.3674 9 11.5C9 11.6326 9.05268 11.7598 9.14645 11.8536C9.24021 11.9473 9.36739 12 9.5 12H11C11.2652 12 11.5196 11.8946 11.7071 11.7071C11.8946 11.5196 12 11.2652 12 11V9.5C12 9.36739 11.9473 9.24021 11.8536 9.14645C11.7598 9.05268 11.6326 9 11.5 9ZM0.5 7.5C0.632608 7.5 0.759785 7.44732 0.853553 7.35355C0.947321 7.25979 1 7.13261 1 7V5C1 4.86739 0.947321 4.74021 0.853553 4.64645C0.759785 4.55268 0.632608 4.5 0.5 4.5C0.367392 4.5 0.240215 4.55268 0.146447 4.64645C0.0526785 4.74021 0 4.86739 0 5V7C0 7.13261 0.0526785 7.25979 0.146447 7.35355C0.240215 7.44732 0.367392 7.5 0.5 7.5ZM2.5 11H1V9.5C1 9.36739 0.947321 9.24021 0.853553 9.14645C0.759785 9.05268 0.632608 9 0.5 9C0.367392 9 0.240215 9.05268 0.146447 9.14645C0.0526785 9.24021 0 9.36739 0 9.5V11C0 11.2652 0.105357 11.5196 0.292893 11.7071C0.48043 11.8946 0.734784 12 1 12H2.5C2.63261 12 2.75979 11.9473 2.85355 11.8536C2.94732 11.7598 3 11.6326 3 11.5C3 11.3674 2.94732 11.2402 2.85355 11.1464C2.75979 11.0527 2.63261 11 2.5 11ZM2.5 0H1C0.734784 0 0.48043 0.105357 0.292893 0.292893C0.105357 0.48043 0 0.734784 0 1V2.5C0 2.63261 0.0526785 2.75979 0.146447 2.85355C0.240215 2.94732 0.367392 3 0.5 3C0.632608 3 0.759785 2.94732 0.853553 2.85355C0.947321 2.75979 1 2.63261 1 2.5V1H2.5C2.63261 1 2.75979 0.947321 2.85355 0.853553C2.94732 0.759785 3 0.632608 3 0.5C3 0.367392 2.94732 0.240215 2.85355 0.146447C2.75979 0.0526785 2.63261 0 2.5 0Z" fill="#AEAEB2"/></svg>`,
    };
    // Use || 'DEFAULT' to handle null or undefined types gracefully
    return icons[type] || icons["DEFAULT"];
  }


  addSwipeBehavior(sliderId) {
    const slider = this.elements[sliderId];
    if (!slider) return;

    let startX, scrollLeft, isDown = false;

    const handleStart = (pageX) => {
      isDown = true;
      startX = pageX - slider.offsetLeft;
      scrollLeft = slider.scrollLeft;
      slider.classList.add('active-swipe');
    };

    const handleEnd = () => {
      isDown = false;
      slider.classList.remove('active-swipe');
    };

    const handleMove = (pageX) => {
      if (!isDown) return;
      const x = pageX - slider.offsetLeft;
      const walk = (x - startX) * 1.5;
      slider.scrollLeft = scrollLeft - walk;
    };

    slider.addEventListener('mousedown', (e) => handleStart(e.pageX));
    slider.addEventListener('mouseleave', handleEnd);
    slider.addEventListener('mouseup', handleEnd);
    slider.addEventListener('mousemove', (e) => {
        e.preventDefault();
        handleMove(e.pageX);
    });

    slider.addEventListener('touchstart', (e) => handleStart(e.touches[0].pageX), { passive: true });
    slider.addEventListener('touchend', handleEnd);
    slider.addEventListener('touchcancel', handleEnd);
    slider.addEventListener('touchmove', (e) => {
        handleMove(e.touches[0].pageX);
    }, { passive: false });
  }

  navigateToResults() {
    this.clearMessages();
    this.elements.formPage.classList.remove("active");
    this.elements.resultsPage.classList.add("active");
    this.elements.innerContainer.style.transform = "unset";
    this.container.querySelector("#innerContainer").style.backgroundColor = "var(--bg-secondary) !important";
  }

  slideToRecommendedConnections() {
    requestAnimationFrame(() => {
        if (this.elements.activityTimeBox) {
            this.elements.activityTimeBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        const topSlider = this.elements["topSlider"];
        if (topSlider && topSlider.querySelector('.active-time')) {
            const topActiveBtn = topSlider.querySelector('.active-time');
            const scrollPos = topActiveBtn.offsetLeft - (topSlider.offsetWidth / 2) + (topActiveBtn.offsetWidth / 2);
            topSlider.scrollTo({ left: scrollPos, behavior: 'smooth' });
        }

        const bottomSlider = this.elements["bottomSlider"];
        if (bottomSlider && bottomSlider.querySelector('.active-time')) {
            const bottomActiveBtn = bottomSlider.querySelector('.active-time');
            const scrollPos = bottomActiveBtn.offsetLeft - (bottomSlider.offsetWidth / 2) + (bottomActiveBtn.offsetWidth / 2);
            bottomSlider.scrollTo({ left: scrollPos, behavior: 'smooth' });
        }
    });
  }

  navigateToForm() {
    this.clearMessages();
    this.elements.resultsPage.classList.remove("active");
    this.elements.formPage.classList.add("active");
    this.container.querySelector("#innerContainer").style.backgroundColor = "var(--bg-primary) !important";
    this.state.toConnections = [];
    this.state.fromConnections = [];
    this.state.activityTimes = { start: '', end: '', duration: '', warning_duration: false };
  }

  setLoadingState(isLoading) {
    this.state.loading = isLoading;
    this.elements.searchBtn.disabled = isLoading;
    this.elements.searchBtn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    this.elements.originInput.disabled = isLoading;

    if (this.loadingTextTimeout1) {
        clearTimeout(this.loadingTextTimeout1);
        this.loadingTextTimeout1 = null;
    }
    if (this.loadingTextTimeout2) {
        clearTimeout(this.loadingTextTimeout2);
        this.loadingTextTimeout2 = null;
    }

    if (isLoading) {
        this.elements.searchBtn.innerHTML = `<span class="loading-spinner"></span> ${this.t("loadingStateToActivity")}`;

        this.loadingTextTimeout1 = setTimeout(() => {
            if (this.state.loading) {
                this.elements.searchBtn.innerHTML = `<span class="loading-spinner"></span> ${this.t("loadingStateFromActivity")}`;

                this.loadingTextTimeout2 = setTimeout(() => {
                    if (this.state.loading) {
                        this.elements.searchBtn.innerHTML = `<span class="loading-spinner"></span> ${this.t("loadingStateSearching")}`;
                    }
                }, 600);
            }
        }, 600);
    } else {
        this.elements.searchBtn.innerHTML = this.t('search');
    }
  }

  showError(message, page = 'form') {
    this.state.error = message;
    const errorContainer = page === 'form' ? this.elements.formErrorContainer : this.elements.resultsErrorContainer;

    if (errorContainer) {
        errorContainer.textContent = message;
        errorContainer.style.display = message ? "block" : "none";
        errorContainer.setAttribute('role', message ? 'alert' : null);
    }

    if (message) {
      console.error(`Widget Error: ${message}`);
       if (page === 'results' && this.elements.resultsPage.classList.contains('active')) {
            this.elements.responseBox.innerHTML = '';
            this.elements.responseBoxBottom.innerHTML = '';
            this.elements.activityTimeBox.innerHTML = '';
            this.elements.topSlider.innerHTML = '';
            this.elements.bottomSlider.innerHTML = '';
       }
    }
  }

  showInfo(message) {
    this.state.info = message;
    if (this.elements.infoContainer) {
        this.elements.infoContainer.textContent = message;
        this.elements.infoContainer.style.display = message ? "block" : "none";
        this.elements.infoContainer.setAttribute('role', message ? 'status' : null);
    }
     if (message) {
      console.info(`Widget Info: ${message}`);
    }
  }

  clearMessages() {
    this.showError(null, 'form');
    this.showError(null, 'results');
    this.showInfo(null);
  }

  _initCustomCalendar() {
    const datesFullyDetermined = this.config.multiday && this.config.activityDurationDaysFixed && (this.config.overrideActivityStartDate || this.config.overrideActivityEndDate);

    if (this.config.multiday) {
        if (!this.rangeCalendarModal) {
            this.rangeCalendarModal = new RangeCalendarModal(
                this.state.selectedDate, this.state.selectedEndDate, this,
                (startDate, endDate) => {
                    this.state.selectedDate = startDate; this.state.selectedEndDate = endDate;
                    if (this.elements.activityDateStart) this.elements.activityDateStart.value = formatDatetime(startDate);
                    if (this.elements.dateDisplayStart) this.updateDateDisplay(startDate, 'dateDisplayStart');
                    if (this.elements.activityDateEnd) this.elements.activityDateEnd.value = formatDatetime(endDate);
                    if (this.elements.dateDisplayEnd) this.updateDateDisplay(endDate, 'dateDisplayEnd');
                    this.clearMessages();
                    if (DateTime.fromJSDate(this.state.selectedEndDate).startOf('day') < DateTime.fromJSDate(this.state.selectedDate).startOf('day')) this.showInfo(this.t('infos.endDateAfterStartDate'));
                },
                this.config.overrideActivityStartDate, this.config.overrideActivityEndDate, this.config.activityDurationDaysFixed
            );
        }

        const showRangeCalendar = (e) => {
            // Prevent native picker on mobile if custom calendar is to be shown by click
            if (window.matchMedia("(max-width: 768px)").matches && e.target.closest('.date-input-container')) {
                 // If a native input is part of this container, let its default action proceed or trigger it.
                 // For now, we assume if it's mobile, native pickers are preferred.
                 // This part might need refinement based on exact desired mobile UX for multiday.
                 // If the click is on the container meant to open custom calendar, but it's mobile,
                 // we might want to manually trigger the native input if one exists.
                const nativeInput = e.target.closest('.date-input-container').querySelector('input[type="date"]');
                if (nativeInput) {
                    // nativeInput.click(); // This can be problematic
                    // nativeInput.focus();
                    return; // Let native picker handle it or do nothing if no direct input.
                }
            }
            this.rangeCalendarModal.show(this.state.selectedDate, this.state.selectedEndDate);
        };

        if (!datesFullyDetermined) {
            if (!this.config.overrideActivityStartDate && this.elements.activityDateStart) {
                const sDIC = this.elements.activityDateStart.closest('.date-input-container');
                if (sDIC) sDIC.addEventListener('click', (e) => { e.stopPropagation(); showRangeCalendar(e); });
            }
            if (!this.config.overrideActivityEndDate && this.elements.activityDateEnd && !this.config.activityDurationDaysFixed) {
                const eDIC = this.elements.activityDateEnd.closest('.date-input-container');
                if (eDIC) eDIC.addEventListener('click', (e) => { e.stopPropagation(); showRangeCalendar(e); });
            }
        }
        // Native input listeners for multiday
        if (this.elements.activityDateStart) {
            this.elements.activityDateStart.addEventListener('change', (e) => {
                const [y, m, d] = e.target.value.split('-').map(Number); const nSD = new Date(Date.UTC(y, m - 1, d));
                this.state.selectedDate = nSD; this.updateDateDisplay(nSD, 'dateDisplayStart');
                if (this.config.activityDurationDaysFixed) {
                    this.state.selectedEndDate = DateTime.fromJSDate(nSD).plus({ days: this.config.activityDurationDaysFixed - 1 }).toJSDate();
                    if (this.elements.activityDateEnd) this.elements.activityDateEnd.value = formatDatetime(this.state.selectedEndDate);
                    this.updateDateDisplay(this.state.selectedEndDate, 'dateDisplayEnd');
                } else if (this.state.selectedEndDate && nSD > this.state.selectedEndDate) {
                    this.state.selectedEndDate = new Date(nSD.valueOf());
                    if (this.elements.activityDateEnd) this.elements.activityDateEnd.value = formatDatetime(this.state.selectedEndDate);
                    this.updateDateDisplay(this.state.selectedEndDate, 'dateDisplayEnd');
                } this.clearMessages();
            });
        }
        if (this.elements.activityDateEnd) {
            this.elements.activityDateEnd.addEventListener('change', (e) => {
                if (this.config.activityDurationDaysFixed) return;
                const [y, m, d] = e.target.value.split('-').map(Number); const nED = new Date(Date.UTC(y, m - 1, d));
                this.state.selectedEndDate = nED; this.updateDateDisplay(nED, 'dateDisplayEnd');
                if (this.state.selectedDate && nED < this.state.selectedDate) {
                    this.state.selectedDate = new Date(nED.valueOf());
                    if (this.elements.activityDateStart) this.elements.activityDateStart.value = formatDatetime(this.state.selectedDate);
                    this.updateDateDisplay(this.state.selectedDate, 'dateDisplayStart');
                } this.clearMessages();
                if (DateTime.fromJSDate(this.state.selectedEndDate).startOf('day') < DateTime.fromJSDate(this.state.selectedDate).startOf('day')) this.showInfo(this.t('infos.endDateAfterStartDate'));
            });
        }

        if (this.config.overrideActivityStartDate && this.elements.dateDisplayStart) this.updateDateDisplay(this.state.selectedDate, 'dateDisplayStart');
        if (this.config.overrideActivityEndDate && this.elements.dateDisplayEnd) this.updateDateDisplay(this.state.selectedEndDate, 'dateDisplayEnd');
        if (datesFullyDetermined) {
            if(this.elements.dateDisplayStart) this.updateDateDisplay(this.state.selectedDate, 'dateDisplayStart');
            if(this.elements.dateDisplayEnd) this.updateDateDisplay(this.state.selectedEndDate, 'dateDisplayEnd');
        }

    } else { // Single day
      if (!this.config.overrideActivityStartDate && this.elements.activityDate && this.elements.otherDateText && this.elements.dateBtnOther && this.elements.dateSelectorButtonsGroup) {
        const dateInputElement = this.elements.activityDate; // Hidden input[type=date]
        const otherDateTextElement = this.elements.otherDateText; // Span inside "Other Date" button
        const otherDateButtonElement = this.elements.dateBtnOther; // The "Other Date" button
        const dateButtonsGroupElement = this.elements.dateSelectorButtonsGroup; // The container of all three buttons

        // Instantiate SingleCalendar for desktop use, anchored to the date buttons group.
        // The trigger element for the custom calendar is the "Other Date" button.
        if (!this.singleCalendarInstance) {
            this.singleCalendarInstance = new SingleCalendar(
                dateInputElement,
                otherDateTextElement,
                this.state.selectedDate,
                this,
                (newDate) => { // Calendar onDateSelectCallback
                    this.state.selectedDate = newDate;
                    if (this.elements.activityDate) {
                        this.elements.activityDate.value = formatDatetime(newDate, this.config.timezone);
                    }
                    this._updateSingleDayDateButtonStates();
                    this.clearMessages();
                },
                dateButtonsGroupElement // Element to ANCHOR the calendar TO.
                                        // The actual trigger is handled by the "Other Date" button listener below for desktop.
            );
        }

        this.elements.dateBtnToday?.addEventListener('click', () => {
            const today = DateTime.now().setZone(this.config.timezone).startOf('day').toJSDate();
            this.onDateSelectedByButton(today);
        });

        this.elements.dateBtnTomorrow?.addEventListener('click', () => {
            const tomorrow = DateTime.now().setZone(this.config.timezone).plus({ days: 1 }).startOf('day').toJSDate();
            this.onDateSelectedByButton(tomorrow);
        });

        // Click listener for "Other Date" button
        otherDateButtonElement.addEventListener('click', (e) => {
            e.stopPropagation();

            if (window.matchMedia("(max-width: 768px)").matches) {
                // Mobile: Trigger native date picker
                if (this.elements.activityDate) {
                    try {
                        // Try to programmatically open the native picker
                        if (typeof this.elements.activityDate.showPicker === 'function') {
                            this.elements.activityDate.showPicker();
                        } else {
                            // Fallback for browsers not supporting showPicker()
                            this.elements.activityDate.focus(); // Focus might bring up picker on some devices
                            // this.elements.activityDate.click(); // Click might also work on some
                        }
                    } catch (err) {
                        console.warn("Error trying to show native date picker:", err);
                        // As a last resort, just focus
                        this.elements.activityDate.focus();
                    }
                }
            } else {
                // Desktop: Toggle custom calendar
                if (this.singleCalendarInstance) {
                    if (this.singleCalendarInstance.calendarContainer.classList.contains("active")) {
                        this.singleCalendarInstance.hide();
                    } else {
                        const dateToShow = this.state.selectedDate || DateTime.now().setZone(this.config.timezone).startOf('day').toJSDate();
                        this.singleCalendarInstance.setSelectedDate(dateToShow, false); // Sync date before showing
                        this.singleCalendarInstance.show();
                    }
                }
            }
        });

        // Listener for the native date input (for mobile "Other Date" and accessibility fallback)
        if (this.elements.activityDate) {
            this.elements.activityDate.addEventListener('change', (e) => {
                if(e.target.value) { // Make sure a value is selected
                    // Safari on iOS might emit 'change' with empty value if cancelled.
                    const [year, month, day] = e.target.value.split('-').map(Number);
                    const newSelectedDate = new Date(Date.UTC(year, month - 1, day)); // Use UTC to avoid timezone shifts from native picker
                    this.state.selectedDate = newSelectedDate;
                    this._updateSingleDayDateButtonStates();
                    this.clearMessages();
                    if (this.singleCalendarInstance) {
                        this.singleCalendarInstance.setSelectedDate(newSelectedDate, false); // Sync custom calendar without triggering its callback
                    }
                }
            });
        }
        this._updateSingleDayDateButtonStates();

      } else if (this.config.overrideActivityStartDate && this.elements.dateDisplay) {
         this.updateDateDisplay(this.state.selectedDate, 'dateDisplay');
      }
    }
  }

  onDateSelectedByButton(date) {
    this.state.selectedDate = date;
    if (this.elements.activityDate) {
        this.elements.activityDate.value = formatDatetime(date, this.config.timezone);
    }
    this._updateSingleDayDateButtonStates();

    if (this.singleCalendarInstance) {
        this.singleCalendarInstance.setSelectedDate(date, false); // Sync custom calendar, don't trigger its own callback
        this.singleCalendarInstance.hide();
    }
    this.clearMessages();
  }

  _updateSingleDayDateButtonStates() {
    if (this.config.multiday || !this.elements.dateBtnToday || !this.elements.dateBtnTomorrow || !this.elements.dateBtnOther || !this.elements.otherDateText) {
        return;
    }

    const today = DateTime.now().setZone(this.config.timezone).startOf('day').toJSDate();
    const tomorrow = DateTime.now().setZone(this.config.timezone).plus({ days: 1 }).startOf('day').toJSDate();
    const selected = this.state.selectedDate ? DateTime.fromJSDate(this.state.selectedDate).setZone(this.config.timezone).startOf('day').toJSDate() : null;

    this.elements.dateBtnToday.classList.remove('active');
    this.elements.dateBtnTomorrow.classList.remove('active');
    this.elements.dateBtnOther.classList.remove('active');
    this.elements.otherDateText.textContent = this.t('otherDate');
    if (this.elements.dateBtnOther.children[1]) this.elements.dateBtnOther.children[1].setAttribute("stroke", "#000");


    if (selected) {
        const locale = this.config.language === 'DE' ? 'de-DE' : 'en-GB';
        if (selected.getTime() === today.getTime()) {
            this.elements.dateBtnToday.classList.add('active');
        } else if (selected.getTime() === tomorrow.getTime()) {
            this.elements.dateBtnTomorrow.classList.add('active');
        } else {
            this.elements.dateBtnOther.classList.add('active');
            this.elements.otherDateText.textContent = formatDateForDisplay(selected, locale, this.config.timezone);
            if (this.elements.dateBtnOther.children[1]) this.elements.dateBtnOther.children[1].setAttribute("stroke", "#fff");
        }
        if (this.elements.activityDate) {
            this.elements.activityDate.value = formatDatetime(selected, this.config.timezone);
        }
    } else {
         this.elements.otherDateText.textContent = this.t('otherDate');
         if (this.elements.activityDate) {
            this.elements.activityDate.value = '';
         }
    }
  }


  updateDateDisplay(date, displayElementId) {
    const displayElement = this.elements[displayElementId];
    if (!displayElement) return;

    const localeMap = { EN: 'en-GB', DE: 'de-DE' };
    const locale = localeMap[this.config.language] || 'en-GB';
    if (date && !isNaN(date.getTime())) {
      displayElement.textContent = formatDateForDisplay(date, locale, this.config.timezone);
      displayElement.classList.remove("placeholder");
    } else {
      displayElement.textContent = this.t('selectDate');
      displayElement.classList.add("placeholder");
    }
  }
}