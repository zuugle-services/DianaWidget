import styles from './styles/widget.scss';
import {DateTime} from 'luxon';
import translations from '../translations';
import {debounce, formatDateForDisplay, getApiErrorTranslationKey} from '../utils';
import {
    addMinutesToDate,
    calculateDurationLocalWithDates,
    calculateInitialStartDate,
    calculateTimeDifference,
    convertConfigTimeToLocalTime,
    convertLocalTimeToUTC,
    convertLocalTimeToUTCDatetime,
    convertUTCToLocalTime,
    formatDatetime,
    formatLegDateForDisplay,
    getEarlierTime,
    getLaterTime,
    getTimeFormatFromMinutes,
    parseDurationToMinutes
} from '../datetimeUtils';

import {PageManager} from '../components/PageManager';
import {UIManager} from '../components/UIManager';
import {RangeCalendarModal, SingleCalendar} from "../components/Calendar";

import {helpContent} from '../templates/helpContent.js';
import {legalContent} from '../templates/legalContent.js';

export default class DianaWidget {
    defaultConfig = {
        activityName: "[Activity Name]",
        requiredFields: [
            'activityStartLocation',
            'activityStartLocationType',
            'activityEndLocation',
            'activityEndLocationType',
            'activityEarliestStartTime',
            'activityLatestStartTime',
            'activityEarliestEndTime',
            'activityLatestEndTime',
            'activityDurationMinutes',
            'apiToken'
        ],
        activityStartLocationDisplayName: null,
        activityEndLocationDisplayName: null,
        timezone: "Europe/Vienna",
        activityStartTimeLabel: null,
        activityEndTimeLabel: null,
        apiBaseUrl: "https://api.zuugle-services.net",
        language: 'EN',
        dev: false,
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
        activityDurationDaysFixed: null,
        share: true,
        allowShareView: true,
        shareURLPrefix: null,
        hideOverriddenActivityStartDate: true,
        dateList: null,
        onDateChange: null,
        onApiTokenExpired: null,
    };

    constructor(config = {}, containerId = "dianaWidgetContainer") {
        this.config = {...this.defaultConfig, ...config};
        const configErrors = this.validateConfig(this.config);

        this.container = document.getElementById(containerId);
        if (this.container?.shadowRoot) {
            this.shadowRoot = this.container.shadowRoot;
        } else if (this.container) {
            this.shadowRoot = this.container.attachShadow({mode: 'open'});
        }

        if (configErrors.length > 0) {
            this._handleConfigErrors(configErrors, containerId);
            return;
        }

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const shareId = urlParams.get('diana-share');
            const isShareView = this.config.allowShareView !== false && !!shareId;
            if (isShareView) this.config.shareId = shareId;
            this.config.readOnly = isShareView;
            if (this.config.shareURLPrefix === null) this.config.shareURLPrefix = window.location.href;

            if (!this.container) {
                console.error(`Container with ID "${containerId}" not found.`);
                return;
            }

            if (this.config.displayStartDate || this.config.displayEndDate) {
                const now = DateTime.now().startOf('day');
                let startDate = this.config.displayStartDate ? DateTime.fromISO(this.config.displayStartDate).startOf('day') : null;
                let endDate = this.config.displayEndDate ? DateTime.fromISO(this.config.displayEndDate).startOf('day') : null;
                let shouldDisplay = true;
                if (startDate && now < startDate) shouldDisplay = false;
                if (endDate && now > endDate) shouldDisplay = false;
                if (!shouldDisplay) {
                    if (this.container) this.container.innerHTML = '';
                    console.info(`DianaWidget: Current date is outside the display range. Widget will not be displayed.`);
                    return;
                }
            }

            this.CACHE_KEY_USER_START_LOCATION = containerId + '_userStartLocation';

            let style = document.createElement('style');
            style.innerHTML = `
              #${containerId} {
                max-height: 790px;
              }
            `;
            document.body.appendChild(style);

            let initialSelectedStartDate, initialSelectedEndDate = null;
            if (this.config.multiday && this.config.activityDurationDaysFixed) {
                if (this.config.overrideActivityEndDate) {
                    const endDt = DateTime.fromISO(this.config.overrideActivityEndDate, {zone: 'utc'});
                    initialSelectedEndDate = endDt.toJSDate();
                    initialSelectedStartDate = endDt.minus({days: this.config.activityDurationDaysFixed - 1}).toJSDate();
                } else if (this.config.overrideActivityStartDate) {
                    const startDt = DateTime.fromISO(this.config.overrideActivityStartDate, {zone: 'utc'});
                    initialSelectedStartDate = startDt.toJSDate();
                    initialSelectedEndDate = startDt.plus({days: this.config.activityDurationDaysFixed - 1}).toJSDate();
                } else {
                    initialSelectedStartDate = calculateInitialStartDate(this.config.timezone, this.config.activityLatestEndTime, this.config.activityDurationMinutes);
                    initialSelectedEndDate = DateTime.fromJSDate(initialSelectedStartDate).plus({days: this.config.activityDurationDaysFixed - 1}).toJSDate();
                }
            }

            if (!initialSelectedStartDate) {
                initialSelectedStartDate = this.config.overrideActivityStartDate
                    ? DateTime.fromISO(this.config.overrideActivityStartDate, {zone: 'utc'}).toJSDate()
                    : calculateInitialStartDate(this.config.timezone, this.config.activityLatestEndTime, this.config.activityDurationMinutes);
            }
            if (this.config.multiday && !initialSelectedEndDate) {
                initialSelectedEndDate = this.config.overrideActivityEndDate
                    ? DateTime.fromISO(this.config.overrideActivityEndDate, {zone: 'utc'}).toJSDate()
                    : DateTime.fromJSDate(initialSelectedStartDate).plus({days: 1}).toJSDate();
            }
            if (this.config.multiday && initialSelectedStartDate && initialSelectedEndDate && DateTime.fromJSDate(initialSelectedEndDate) < DateTime.fromJSDate(initialSelectedStartDate)) {
                initialSelectedEndDate = new Date(initialSelectedStartDate.valueOf());
            }

            this.state = {
                fromConnections: [],
                toConnections: [],
                selectedToConnection: null,
                selectedFromConnection: null,
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
                },
                currentContentKey: null,
                preselectTimes: null
            };

            this.loadingTextTimeout1 = null;
            this.loadingTextTimeout2 = null;
            this.singleCalendarInstance = null;
            this.pageManager = null;
            this.uiManager = null;

            this.debouncedHandleAddressInput = debounce((query) => this.handleAddressInput(query), 700);

            // The main initialization logic is now split.
            if (shareId && this.config.allowShareView) {
                // If a share ID exists and sharing is allowed, load data from the backend first.
                this._loadFromShareID(shareId);
            } else {
                // Otherwise, initialize the DOM for the interactive mode.
                this.initDOM().catch(error => {
                    console.error("Error during async DOM initialization:", error);
                    this._showFatalError(this.t('errors.widgetLoadErrorTitle'), error.message);
                });
            }
        } catch (error) {
            console.error("Failed to initialize Diana GreenConnect Widget:", error);
            const fallbackContainer = document.getElementById(containerId);
            if (fallbackContainer) {
                this._showFallbackUI();
            }
        }
    }

    _applyExternalStyles() {
        // List of CSS custom properties that can be themed from the outside.
        const themableProperties = [
            '--primary-color', '--secondary-color', '--success-color', '--warning-color', '--error-color',
            '--wait-color', '--text-primary', '--text-secondary', '--text-tertiary', '--text-muted',
            '--text-disabled', '--text-error', '--text-info', '--text-warning', '--icon-input-color',
            '--bg-primary', '--bg-secondary', '--bg-tertiary', '--bg-hover', '--bg-error', '--bg-info',
            '--bg-transparent', '--bg-waiting-block', '--border-primary', '--border-secondary',
            '--border-tertiary', '--border-error', '--border-info', '--shadow-verylight', '--shadow-light',
            '--shadow-medium', '--shadow-dark', '--shadow-gray'
        ];

        if (!this.container || !this.dianaWidgetRootContainer) {
            return;
        }

        const hostStyles = getComputedStyle(this.container);

        themableProperties.forEach(prop => {
            const value = hostStyles.getPropertyValue(prop).trim();
            if (value) {
                this.dianaWidgetRootContainer.style.setProperty(prop, value);
            }
        });
    }

    validateConfig(config) {
        const errors = [];

        if (!translations[config.language]) {
            console.warn(`Unsupported language '${config.language}', falling back to EN`);
            config.language = 'EN';
        }

        const missingFields = config.requiredFields.filter(field => !config[field]);
        if (config.multiday && !config.activityDurationMinutes) {
            const index = missingFields.indexOf('activityDurationMinutes');
            if (index > -1) {
                missingFields.splice(index, 1);
            }
        }
        if (missingFields.length > 0) {
            errors.push(`Missing required configuration: ${missingFields.join(', ')}`);
        }

        if (config.apiBaseUrl[config.apiBaseUrl.length - 1] === "/") {
            config.apiBaseUrl = config.apiBaseUrl.slice(0, -1);
        }

        if (!DateTime.local().setZone(config.timezone).isValid) {
            errors.push(`Invalid timezone '${config.timezone}'. Error: ${DateTime.local().setZone(config.timezone).invalidReason}`);
            config.timezone = 'Europe/Vienna';
        }

        const validLocationTypes = ['coordinates', 'coord', 'coords', 'address', 'station'];
        if (config.activityStartLocationType && !validLocationTypes.includes(config.activityStartLocationType)) {
            errors.push(`Invalid activityStartLocationType '${config.activityStartLocationType}'.`);
        }
        if (config.activityEndLocationType && !validLocationTypes.includes(config.activityEndLocationType)) {
            errors.push(`Invalid activityEndLocationType '${config.activityEndLocationType}'.`);
        }

        if (config.activityDurationMinutes) {
            const duration = parseInt(config.activityDurationMinutes, 10);
            if (isNaN(duration) || duration <= 0) {
                errors.push(`Invalid activityDurationMinutes '${config.activityDurationMinutes}'. Must be a positive integer.`);
            }
        }

        const timeRegex = /^(2[0-3]|[01]?[0-9]):([0-5]?[0-9])(:([0-5]?[0-9]))?$/;
        const timeFields = ['activityEarliestStartTime', 'activityLatestStartTime', 'activityEarliestEndTime', 'activityLatestEndTime'];
        timeFields.forEach(field => {
            if (config[field] && !timeRegex.test(config[field])) {
                errors.push(`Invalid time format for '${field}': '${config[field]}'. Expected HH:MM or HH:MM:SS`);
            }
        });

        // Check for logical time errors only if formats are valid
        if (!errors.some(e => e.includes('Invalid time format'))) {
            try {
                const earliestStart = convertLocalTimeToUTC(config.activityEarliestStartTime, new Date("2000-10-10"), config.timezone);
                const latestStart = convertLocalTimeToUTC(config.activityLatestStartTime, new Date("2000-10-10"), config.timezone);
                if (latestStart < earliestStart) {
                    errors.push(`activityLatestStartTime (${config.activityLatestStartTime}) cannot be before activityEarliestStartTime (${config.activityEarliestStartTime}).`);
                }

                const earliestEnd = convertLocalTimeToUTC(config.activityEarliestEndTime, new Date("2000-10-10"), config.timezone);
                const latestEnd = convertLocalTimeToUTC(config.activityLatestEndTime, new Date("2000-10-10"), config.timezone);
                if (latestEnd < earliestEnd) {
                    errors.push(`activityLatestEndTime (${config.activityLatestEndTime}) cannot be before activityEarliestEndTime (${config.activityEarliestEndTime}).`);
                }
            } catch (e) {
                errors.push("There was an issue parsing activity time configurations for logical validation.");
            }
        }

        if (config.overrideUserStartLocation && (typeof config.overrideUserStartLocation !== 'string')) {
            errors.push(`Invalid overrideUserStartLocation '${config.overrideUserStartLocation}'. Must be a string or null.`);
        }
        if (config.overrideUserStartLocation && (!config.overrideUserStartLocationType || !validLocationTypes.includes(config.overrideUserStartLocationType))) {
            errors.push(`Invalid or missing overrideUserStartLocationType '${config.overrideUserStartLocationType}'.`);
        } else if (config.overrideUserStartLocation && ['coordinates', 'coord', 'coords'].includes(config.overrideUserStartLocationType)) {
            const coordsRegex = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
            if (!coordsRegex.test(config.overrideUserStartLocation)) {
                errors.push(`Invalid coordinate format for overrideUserStartLocation: '${config.overrideUserStartLocation}'. Expected "lat,lon".`);
            }
        }

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (config.displayStartDate && (!dateRegex.test(config.displayStartDate) || !DateTime.fromISO(config.displayStartDate).isValid)) {
            errors.push(`Invalid displayStartDate: ${config.displayStartDate}.`);
        }
        if (config.displayEndDate && (!dateRegex.test(config.displayEndDate) || !DateTime.fromISO(config.displayEndDate).isValid)) {
            errors.push(`Invalid displayEndDate: ${config.displayEndDate}.`);
        }
        if (config.displayStartDate && config.displayEndDate && DateTime.fromISO(config.displayStartDate) > DateTime.fromISO(config.displayEndDate)) {
            errors.push(`displayStartDate cannot be after displayEndDate.`);
        }
        if (config.overrideActivityStartDate && (!dateRegex.test(config.overrideActivityStartDate) || !DateTime.fromISO(config.overrideActivityStartDate).isValid)) {
            errors.push(`Invalid overrideActivityStartDate: ${config.overrideActivityStartDate}.`);
        }
        if (config.overrideActivityEndDate) {
            if (!dateRegex.test(config.overrideActivityEndDate) || !DateTime.fromISO(config.overrideActivityEndDate).isValid) {
                errors.push(`Invalid overrideActivityEndDate: ${config.overrideActivityEndDate}.`);
            } else if (!config.multiday) {
                console.warn("Warning: 'overrideActivityEndDate' is provided but 'multiday' is false. It will be ignored.");
                config.overrideActivityEndDate = null;
            } else if (config.overrideActivityStartDate && DateTime.fromISO(config.overrideActivityEndDate) < DateTime.fromISO(config.overrideActivityStartDate)) {
                errors.push(`overrideActivityEndDate cannot be before overrideActivityStartDate.`);
            }
        }

        if (config.multiday && config.activityDurationDaysFixed && config.overrideActivityStartDate && config.overrideActivityEndDate) {
            const start = DateTime.fromISO(config.overrideActivityStartDate);
            const end = DateTime.fromISO(config.overrideActivityEndDate);
            if (start.isValid && end.isValid) {
                // +1 because a 2-day duration is start_date -> start_date + 1 day. Diff will be 1 day.
                const diffInDays = end.diff(start, 'days').as('days') + 1;
                const fixedDuration = parseInt(config.activityDurationDaysFixed, 10);
                if (diffInDays !== fixedDuration) {
                    errors.push(`The duration between overrideActivityStartDate (${config.overrideActivityStartDate}) and overrideActivityEndDate (${config.overrideActivityEndDate}) is ${diffInDays} days, which contradicts the fixed duration of ${fixedDuration} days.`);
                }
            }
        }

        return errors;
    }

    _handleConfigErrors(errors, containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container with ID "${containerId}" not found.`);
            return;
        }

        if (this.config.dev) {
            const errorMsg = `Configuration Errors:\n- ${errors.join('\n- ')}`;
            console.error("Diana GreenConnect Widget: " + errorMsg);
            this._showFatalError("Widget Configuration Error", `<pre style="text-align: left; white-space: pre-wrap;">${errorMsg}</pre>`);
        } else {
            console.error(`Diana GreenConnect Widget: Configuration errors found. Showing fallback. Details: ${errors.join(', ')}`);
            this._showFallbackUI();
        }
    }

    _showFallbackUI() {
        this._showFatalError(this.t('errors.widgetLoadErrorTitle'), this.t('errors.api.internalError'));
    }

    t(keyPath, replacements = {}) {
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

        let text = result || `[${keyPath}]`;

        for (const placeholder in replacements) {
            if (Object.hasOwnProperty.call(replacements, placeholder)) {
                const regex = new RegExp(`{${placeholder}}`, 'g');
                text = text.replace(regex, replacements[placeholder]);
            }
        }

        return text;
    }

    async initDOM() {
        this.uiManager = new UIManager();
        let dianaWidgetRootContainer = document.createElement('div');
        dianaWidgetRootContainer.className = 'diana-container';
        this.shadowRoot.innerHTML = '';

        const styleTag = document.createElement('style');
        styleTag.textContent = styles;
        this.shadowRoot.appendChild(styleTag);

        this.shadowRoot.appendChild(dianaWidgetRootContainer);
        this.dianaWidgetRootContainer = dianaWidgetRootContainer;

        this._applyExternalStyles();

        const templateArgs = {
            config: this.config,
            t: (key) => this.t(key),
            state: this.state,
            formatDateForDisplay,
            formatDatetime,
            getTransportIcon: (type) => this.getTransportIcon(type)
        };

        const formPageHTML = await this.uiManager.loadTemplate('formPageTemplate', templateArgs);
        const resultsPageHTML = await this.uiManager.loadTemplate('resultsPageTemplate', templateArgs);
        const contentPageHTML = await this.uiManager.loadTemplate('contentPageTemplate', templateArgs);

        this.dianaWidgetRootContainer.innerHTML = `
          <div id="activityModal" class="modal visible">
            <div id="innerContainer" class="modal-content">
              ${formPageHTML}
              ${resultsPageHTML}
              ${contentPageHTML}
            </div>
          </div>
        `;

        this.cacheDOMElements();
        this.pageManager = new PageManager(
            this.elements.formPage,
            this.elements.resultsPage,
            this.elements.innerContainer,
            this.elements.contentPage
        );

        this.setupAccessibility();
        if (this.config.multiday) {
            if (this.elements.activityDateStart && this.state.selectedDate) {
                this.elements.activityDateStart.value = formatDatetime(this.state.selectedDate, this.config.timezone);
            }
            if (this.elements.activityDateEnd && this.state.selectedEndDate) {
                this.elements.activityDateEnd.value = formatDatetime(this.state.selectedEndDate, this.config.timezone);
            }

            this.updateDateDisplay(this.state.selectedDate, 'dateDisplayStart');
            this.updateDateDisplay(this.state.selectedEndDate, 'dateDisplayEnd');
        } else {
            if (this.elements.activityDate && this.state.selectedDate) {
                this.elements.activityDate.value = formatDatetime(this.state.selectedDate, this.config.timezone);
            }
        }
        this.setupEventListeners();
        this._setupDateInput();
        this._initCustomCalendar();
        this._initializeOriginInputWithOverridesAndCache();
    }

    _setupDateInput() {
        if (this.config.multiday || this.config.overrideActivityStartDate) {
            return;
        }

        if (this.config.dateList) {
            const now = DateTime.now().setZone(this.config.timezone).startOf('day');
            this.state.availableDates = this.config.dateList
                .map(d => DateTime.fromISO(d, {zone: 'utc'}).startOf('day'))
                .filter(dt => dt >= now)
                .sort((a, b) => a - b);

            if (this.state.availableDates.length > 0) {
                const dateContainer = this.elements.dateSelectorButtonsGroup?.parentElement;
                if (dateContainer) {
                    dateContainer.innerHTML = '';
                    dateContainer.className = 'date-select-container';

                    const label = document.createElement('label');
                    label.htmlFor = 'diana-date-select';
                    label.textContent = this.t('activityDate');
                    label.className = 'form-label';
                    dateContainer.appendChild(label);

                    const select = document.createElement('select');
                    select.id = 'diana-date-select';
                    this.state.availableDates.forEach(dt => {
                        const option = document.createElement('option');
                        const isoDate = dt.toISODate();
                        option.value = isoDate;
                        option.textContent = this.formatDateForSelect(dt);
                        select.appendChild(option);
                    });
                    dateContainer.appendChild(select);
                    this.elements.dateSelect = select;

                    const initialDate = this.state.availableDates[0].toJSDate();
                    this.onDateSelectedByButton(initialDate);

                    select.addEventListener('change', (e) => {
                        const selectedIso = e.target.value;
                        const newDate = DateTime.fromISO(selectedIso, {zone: 'utc'}).toJSDate();
                        this.onDateSelectedByButton(newDate);
                    });
                }
            }
        }
    }

    formatDateForSelect(luxonDate) {
        const localeMap = {EN: 'en-GB', DE: 'de-DE', FR: 'fr-FR', IT: 'it-IT', TH: 'th-TH', ES: 'es-ES'};
        const locale = localeMap[this.config.language] || (this.config.language ? `${this.config.language.toLowerCase()}-${this.config.language.toUpperCase()}` : 'en-GB');
        return luxonDate.setLocale(locale).toFormat('ccc, dd. MMM yyyy');
    }

    /**
     * Sets the selected activity date from outside the widget.
     * @param {string} dateString - The date to set, in 'YYYY-MM-DD' format.
     */
    setSelectedDate(dateString) {
        try {
            const newDateDt = DateTime.fromISO(dateString, {zone: 'utc'}).startOf('day');
            if (!newDateDt.isValid) {
                console.error(`DianaWidget.setSelectedDate: Invalid date string provided: "${dateString}"`);
                return;
            }

            const today = DateTime.now().setZone(this.config.timezone).startOf('day');
            if (newDateDt < today) {
                console.warn(`DianaWidget.setSelectedDate: Past date provided: "${dateString}". Date not set.`);
                return;
            }

            const newDate = newDateDt.toJSDate();

            if (this.elements.dateSelect) { // The dropdown is active
                const isoDate = newDateDt.toISODate();
                const optionExists = Array.from(this.elements.dateSelect.options).some(opt => opt.value === isoDate);
                if (optionExists) {
                    this.elements.dateSelect.value = isoDate;
                    this.onDateSelectedByButton(newDate);
                } else {
                    console.warn(`DianaWidget.setSelectedDate: Date "${dateString}" is not in the provided dateList.`);
                }
            } else { // The standard date picker is active
                this.onDateSelectedByButton(newDate);
            }
        } catch (error) {
            console.error(`DianaWidget.setSelectedDate: Error setting date.`, error);
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
            originInput.disabled = true;
            originInput.classList.add('disabled');
            if (this.elements.currentLocationBtn) this.elements.currentLocationBtn.style.display = 'none';
            if (this.elements.clearInputBtn) this.elements.clearInputBtn.style.display = 'none';
            return;
        }
        const cachedLocation = this._getCachedStartLocation();
        if (cachedLocation) {
            originInput.value = cachedLocation.value;
            if (cachedLocation.lat && cachedLocation.lon) {
                originInput.setAttribute('data-lat', cachedLocation.lat);
                originInput.setAttribute('data-lon', cachedLocation.lon);
            }
        }

        // Set initial button state based on input value
        if (this.elements.clearInputBtn && this.elements.currentLocationBtn) {
            if (originInput.value.trim()) {
                this.elements.clearInputBtn.style.display = 'block';
                this.elements.currentLocationBtn.style.display = 'none';
            } else {
                this.elements.clearInputBtn.style.display = 'none';
                this.elements.currentLocationBtn.style.display = 'block';
            }
        }
    }

    _shouldCacheUserStartLocation() {
        const cacheConfig = this.config.cacheUserStartLocation;
        if (typeof cacheConfig === 'function') {
            try {
                return !!cacheConfig();
            } catch (error) {
                console.error("Error executing cacheUserStartLocation callback:", error);
                return false;
            }
        }
        return !!cacheConfig;
    }

    _getCachedStartLocation() {
        if (!this._shouldCacheUserStartLocation()) return null;
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
        if (!this._shouldCacheUserStartLocation()) return;
        try {
            const locationData = {
                value: value, lat: lat ? lat.toString() : null, lon: lon ? lon.toString() : null, timestamp: Date.now()
            };
            localStorage.setItem(this.CACHE_KEY_USER_START_LOCATION, JSON.stringify(locationData));
        } catch (error) {
            console.error("Error saving start location to cache:", error);
        }
    }

    cacheDOMElements() {
        this.elements = {
            modal: this.shadowRoot.querySelector("#activityModal"),
            innerContainer: this.shadowRoot.querySelector("#innerContainer"),
            formPage: this.shadowRoot.querySelector("#formPage"),
            resultsPage: this.shadowRoot.querySelector("#resultsPage"),
            contentPage: this.shadowRoot.querySelector("#contentPage"),
            originInput: this.shadowRoot.querySelector("#originInput"),
            suggestionsContainer: this.shadowRoot.querySelector("#suggestions"),
            searchBtn: this.shadowRoot.querySelector("#searchBtn"),
            backBtn: this.shadowRoot.querySelector("#backBtn"),
            formErrorContainer: this.shadowRoot.querySelector("#formErrorContainer"),
            formDebugContainer: this.shadowRoot.querySelector("#formDebugContainer"),
            resultsErrorContainer: this.shadowRoot.querySelector("#resultsErrorContainer"),
            resultsDebugContainer: this.shadowRoot.querySelector("#resultsDebugContainer"),
            infoContainer: this.shadowRoot.querySelector("#infoContainer"),

            collapsibleToActivity: this.shadowRoot.querySelector("#collapsibleToActivity"),
            collapsibleFromActivity: this.shadowRoot.querySelector("#collapsibleFromActivity"),
            responseBox: this.shadowRoot.querySelector("#responseBox"),
            responseBoxBottom: this.shadowRoot.querySelector("#responseBox-bottom"),

            topSlider: this.shadowRoot.querySelector("#topSlider"),
            bottomSlider: this.shadowRoot.querySelector("#bottomSlider"),
            activityTimeBox: this.shadowRoot.querySelector("#activity-time"),
            currentLocationBtn: this.shadowRoot.querySelector("#currentLocationBtn"),
            clearInputBtn: this.shadowRoot.querySelector("#clearInputBtn"),
            activityDateStart: this.shadowRoot.querySelector("#activityDateStart"),
            dateDisplayStart: this.shadowRoot.querySelector("#dateDisplayStart"),
            activityDateEnd: this.shadowRoot.querySelector("#activityDateEnd"),
            dateDisplayEnd: this.shadowRoot.querySelector("#dateDisplayEnd"),
            activityDate: this.shadowRoot.querySelector("#activityDate"),
            dateDisplay: this.shadowRoot.querySelector("#dateDisplay"),
            dateBtnToday: this.shadowRoot.querySelector("#dateBtnToday"),
            dateBtnTomorrow: this.shadowRoot.querySelector("#dateBtnTomorrow"),
            dateBtnOther: this.shadowRoot.querySelector("#dateBtnOther"),
            otherDateText: this.shadowRoot.querySelector("#otherDateText"),
            dateSelectorButtonsGroup: this.shadowRoot.querySelector(".date-selector-buttons"),
            toActivityDateDisplay: this.shadowRoot.querySelector("#toActivityDateDisplay"),
            fromActivityDateDisplay: this.shadowRoot.querySelector("#fromActivityDateDisplay"),

            // Menu elements
            formPageMenuButton: this.shadowRoot.querySelector("#formPage .menu-btn-dots"),
            resultsPageMenuButton: this.shadowRoot.querySelector("#resultsPage .menu-btn-dots"),
            contentPageMenuButton: this.shadowRoot.querySelector("#contentPage .menu-btn-dots"),
            formMenuDropdown: this.shadowRoot.querySelector("#formMenuDropdown"),
            resultsMenuDropdown: this.shadowRoot.querySelector("#resultsMenuDropdown"),
            contentMenuDropdown: this.shadowRoot.querySelector("#contentMenuDropdown"),

            // Page-specific elements
            contentPageBackBtn: this.shadowRoot.querySelector("#contentPageBackBtn"),
            contentPageTitle: this.shadowRoot.querySelector("#contentPageTitle"),
            contentPageBody: this.shadowRoot.querySelector("#contentPageBody"),
        };
    }

    setupAccessibility() {
        if (!this.elements) return; // Guard against elements not being cached yet

        if (this.elements.originInput) {
            this.elements.originInput.setAttribute('aria-autocomplete', 'list');
            this.elements.originInput.setAttribute('aria-controls', 'suggestions');
            this.elements.originInput.setAttribute('aria-expanded', 'false');
        }


        if (this.config.multiday) {
            if (this.elements.activityDateStart) this.elements.activityDateStart.setAttribute('aria-hidden', 'true');
            if (this.elements.activityDateEnd) this.elements.activityDateEnd.setAttribute('aria-hidden', 'true');
        } else {
            if (this.elements.activityDate) this.elements.activityDate.setAttribute('aria-hidden', 'true');
        }

        if (this.elements.searchBtn) this.elements.searchBtn.setAttribute('aria-label', this.t('ariaLabels.searchButton'));
        if (this.elements.backBtn) this.elements.backBtn.setAttribute('aria-label', this.t('ariaLabels.backButton'));
        if (this.elements.contentPageBackBtn) this.elements.contentPageBackBtn.setAttribute('aria-label', this.t('ariaLabels.backButton'));

        if (this.elements.currentLocationBtn) {
            this.elements.currentLocationBtn.setAttribute('aria-label', this.t('useCurrentLocation'));
        }
        if (this.elements.clearInputBtn) {
            this.elements.clearInputBtn.setAttribute('aria-label', this.t('clearInput'));
        }
        if (this.elements.responseBox) this.elements.responseBox.setAttribute('aria-busy', 'false');
        if (this.elements.responseBoxBottom) this.elements.responseBoxBottom.setAttribute('aria-busy', 'false');

        if (this.elements.formPageMenuButton) this.elements.formPageMenuButton.setAttribute('aria-label', this.t('ariaLabels.menuButton'));
        if (this.elements.resultsPageMenuButton) this.elements.resultsPageMenuButton.setAttribute('aria-label', this.t('ariaLabels.menuButton'));
        if (this.elements.contentPageMenuButton) this.elements.contentPageMenuButton.setAttribute('aria-label', this.t('ariaLabels.menuButton'));
    }

    setupEventListeners() {
        if (!this.elements) return;

        if (!this.config.overrideUserStartLocation && this.elements.originInput) {
            this.elements.originInput.addEventListener('input', (e) => {
                this.elements.originInput.removeAttribute("data-lat");
                this.elements.originInput.removeAttribute("data-lon");
                this.clearMessages();
                this.debouncedHandleAddressInput(e.target.value.trim());

                if (this.elements.clearInputBtn && this.elements.currentLocationBtn) {
                    if (e.target.value.trim()) {
                        this.elements.clearInputBtn.style.display = 'block';
                        this.elements.currentLocationBtn.style.display = 'none';
                    } else {
                        this.elements.clearInputBtn.style.display = 'none';
                        this.elements.currentLocationBtn.style.display = 'block';
                    }
                }
            });
            if (this.elements.suggestionsContainer) {
                this.elements.suggestionsContainer.addEventListener('click', (e) => {
                    if (e.target.classList.contains('suggestion-item')) this.handleSuggestionSelect(e.target.dataset.value, e.target.dataset.lat, e.target.dataset.lon);
                });
            }

            this.elements.originInput.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') this.handleSuggestionNavigation(e);
                else if (e.key === 'Enter') this.handleSuggestionEnter(e);
            });
            if (this.elements.currentLocationBtn) this.elements.currentLocationBtn.addEventListener('click', () => this.handleCurrentLocation());

            if (this.elements.clearInputBtn) this.elements.clearInputBtn.addEventListener('click', () => {
                this.elements.originInput.value = '';
                this.elements.originInput.removeAttribute("data-lat");
                this.elements.originInput.removeAttribute("data-lon");
                if (this.elements.clearInputBtn) this.elements.clearInputBtn.style.display = 'none';
                if (this.elements.currentLocationBtn) this.elements.currentLocationBtn.style.display = 'block';
                this.elements.originInput.focus();
                this.state.suggestions = [];
                this.renderSuggestions();
            });
        }
        if (this.elements.searchBtn) this.elements.searchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleSearch();
        });

        if (this.elements.backBtn) this.elements.backBtn.addEventListener('click', () => this.navigateToForm());
        if (this.elements.contentPageBackBtn) this.elements.contentPageBackBtn.addEventListener('click', () => this.closeMenuOrContentPage());

        this.elements.collapsibleToActivity?.addEventListener('click', () => this.toggleCollapsible('to'));
        this.elements.collapsibleFromActivity?.addEventListener('click', () => this.toggleCollapsible('from'));

        if (this.elements.responseBox) this.elements.responseBox.addEventListener('click', (e) => this.handleBuyTicketClick(e));
        if (this.elements.responseBoxBottom) this.elements.responseBoxBottom.addEventListener('click', (e) => this.handleBuyTicketClick(e));


        // --- Generic Menu Handling ---
        const menuButtons = [this.elements.formPageMenuButton, this.elements.resultsPageMenuButton, this.elements.contentPageMenuButton];
        const menuDropdowns = [this.elements.formMenuDropdown, this.elements.resultsMenuDropdown, this.elements.contentMenuDropdown];

        menuButtons.forEach((button, index) => {
            if (button) {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const dropdown = menuDropdowns[index];
                    if (!dropdown) return;

                    const isVisible = dropdown.style.display === 'block';
                    // Close all dropdowns first
                    menuDropdowns.forEach(d => {
                        if (d) d.style.display = 'none';
                    });
                    // Toggle the clicked one
                    if (!isVisible) {
                        dropdown.style.display = 'block';
                    }
                });
            }
        });

        menuDropdowns.forEach(dropdown => {
            if (dropdown) {
                dropdown.addEventListener('click', (e) => {
                    const menuItem = e.target.closest('.menu-dropdown-item');
                    if (menuItem) {
                        e.preventDefault();
                        if (menuItem.classList.contains('disabled')) {
                            return; // Do nothing if disabled
                        }
                        if (menuItem.id === 'shareMenuItem') {
                            this.handleShare();
                        } else if (menuItem.dataset.contentKey) {
                            this.navigateToContentPage(menuItem.dataset.contentKey);
                        }
                        // Close all dropdowns
                        menuDropdowns.forEach(d => {
                            if (d) d.style.display = 'none';
                        });
                    }
                });
            }
        });

        document.addEventListener("click", (e) => {
            if (this.elements.suggestionsContainer?.style.display === 'block' && !this.elements.suggestionsContainer.contains(e.target) && this.elements.originInput && !this.elements.originInput.contains(e.target)) {
                this.state.suggestions = [];
                this.renderSuggestions();
            }
            // Close menu dropdowns if click is outside
            const clickedInsideMenu = menuButtons.some(b => b && b.contains(e.target)) || menuDropdowns.some(d => d && d.style.display === 'block' && d.contains(e.target));
            if (!clickedInsideMenu) {
                menuDropdowns.forEach(d => {
                    if (d) d.style.display = 'none';
                });
            }
        });
    }

    /**
     * Toggles the collapsible state of a journey box, if it has content.
     * @param {string} type - 'to' or 'from'.
     */
    toggleCollapsible(type) {
        const container = type === 'to'
            ? this.elements.collapsibleToActivity
            : this.elements.collapsibleFromActivity;

        if (container && container.classList.contains('has-summary')) {
            container.classList.toggle('expanded');
        }
    }

    _handleSessionExpired() {
        // Disable UI elements to prevent further interaction
        const elementsToDisable = [
            this.elements.originInput,
            this.elements.searchBtn,
            this.elements.currentLocationBtn,
            this.elements.clearInputBtn,
            this.elements.dateBtnToday,
            this.elements.dateBtnTomorrow,
            this.elements.dateBtnOther,
            this.elements.dateSelect,
            this.elements.activityDateStart,
            this.elements.activityDateEnd,
            this.elements.activityDate
        ];

        this.shadowRoot.querySelectorAll(".date-input-container").forEach(el => {
            if (el) {
                el.disabled = true;
                el.style.pointerEvents = 'none';
                el.classList.add('disabled-by-session-expiry');
            }
        });

        elementsToDisable.forEach(el => {
            if (el) {
                el.disabled = true;
                el.style.pointerEvents = 'none';
                el.classList.add('disabled-by-session-expiry');
            }
        });

        // Display a non-dismissible error message with a reload button
        if (this.elements.formErrorContainer) {
            const messageContainer = document.createElement('div');
            messageContainer.className = 'session-expired-message';

            const messageText = document.createElement('span');
            messageText.textContent = this.t('errors.sessionExpired');
            messageContainer.appendChild(messageText);

            const reloadButton = document.createElement('button');
            reloadButton.textContent = this.t('reloadPage');
            reloadButton.className = 'reload-button';
            reloadButton.onclick = () => window.location.reload(true);
            messageContainer.appendChild(reloadButton);

            this.elements.formErrorContainer.innerHTML = ''; // Clear previous errors
            this.elements.formErrorContainer.appendChild(messageContainer);
            this.elements.formErrorContainer.style.display = 'block';
            this.elements.formErrorContainer.setAttribute('role', 'alert');
        }
    }

    async _fetchApi(url, originalOptions = {}, isRetry = false) {
        const options = {
            ...originalOptions,
            headers: {
                ...originalOptions.headers,
                'Authorization': `Bearer ${this.config.apiToken}`
            }
        };

        const response = await fetch(url, options);

        if (response.ok) {
            return response;
        }

        if (response.status === 401 && !isRetry) {
            if (typeof this.config.onApiTokenExpired === 'function') {
                try {
                    const newToken = await this.config.onApiTokenExpired();
                    if (typeof newToken === 'string' && newToken) {
                        this.config.apiToken = newToken;
                        return this._fetchApi(url, originalOptions, true);
                    }
                    throw new Error("onApiTokenExpired callback did not return a valid string token.");
                } catch (error) {
                    console.error("Token refresh via onApiTokenExpired failed:", error);
                    this._handleSessionExpired();
                    const sessionError = new Error(this.t('errors.sessionExpired'));
                    sessionError.isSessionExpired = true;
                    throw sessionError;
                }
            } else {
                this._handleSessionExpired();
                const sessionError = new Error(this.t('errors.sessionExpired'));
                sessionError.isSessionExpired = true;
                throw sessionError;
            }
        }

        const error = new Error(`API Error: ${response.status} ${response.statusText}`);
        error.response = response;
        try {
            error.body = await response.clone().json();
        } catch (e) {
            error.body = await response.clone().text();
        }
        throw error;
    }


    async handleCurrentLocation() {
        this.clearMessages();
        if (!navigator.geolocation) {
            this.showError(this.t('errors.geolocationNotSupported'), 'form');
            return;
        }
        if (this.elements.currentLocationBtn) {
            this.elements.currentLocationBtn.style.pointerEvents = 'none';
            this.elements.currentLocationBtn.style.opacity = '0.5';
        }
        if (this.elements.originInput) this.elements.originInput.disabled = true;

        this.showInfo(this.t('infos.fetchingLocation'));
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true, timeout: 10000, maximumAge: 0
                });
            });
            const {latitude, longitude} = position.coords;
            await this.fetchReverseGeocode(latitude, longitude);
        } catch (error) {
            let errorMsg = this.t('errors.geolocationError');
            if (error.code) {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMsg = this.t('errors.geolocationPermissionDenied');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMsg = this.t('errors.geolocationPositionUnavailable');
                        break;
                    case error.TIMEOUT:
                        errorMsg = this.t('errors.geolocationTimeout');
                        break;
                }
            }
            this.showError(errorMsg, 'form');
        } finally {
            if (this.elements.currentLocationBtn) {
                this.elements.currentLocationBtn.style.pointerEvents = 'auto';
                this.elements.currentLocationBtn.style.opacity = '1';
            }
            if (this.elements.originInput) this.elements.originInput.disabled = false;
            if (this.state.info === this.t('infos.fetchingLocation')) this.showInfo(null);
        }
    }

    async fetchReverseGeocode(latitude, longitude) {
        this.showInfo(this.t('infos.fetchingAddress'));
        try {
            const response = await this._fetchApi(
                `${this.config.apiBaseUrl}/reverse-geocode?lat=${latitude}&lon=${longitude}`,
                {
                    method: 'GET',
                    headers: {'Content-Type': 'application/json'}
                });

            const data = await response.json();
            if (data.features && data.features.length > 0 && data.features[0].diana_properties && data.features[0].diana_properties.display_name) {
                const displayName = data.features[0].diana_properties.display_name;
                this.elements.originInput.value = displayName;
                this.elements.originInput.setAttribute('data-lat', latitude.toString());
                this.elements.originInput.setAttribute('data-lon', longitude.toString());
                this.state.suggestions = [];
                this.renderSuggestions();
                this.clearMessages();
                this._setCachedStartLocation(displayName, latitude, longitude);

                if (this.elements.clearInputBtn) this.elements.clearInputBtn.style.display = 'block';
                if (this.elements.currentLocationBtn) this.elements.currentLocationBtn.style.display = 'none';
            } else {
                throw new Error(this.t('errors.reverseGeocodeNoResults'));
            }
        } catch (error) {
            if (error.isSessionExpired) return;

            console.error("Reverse geocode error:", error);
            let errorMessage;
            if (error.body && typeof error.body === 'object' && error.body.code) {
                errorMessage = this.t(getApiErrorTranslationKey(error.body.code));
            } else if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
                errorMessage = !window.navigator.onLine ? this.t('errors.api.networkError') : this.t('errors.api.apiUnreachable');
            } else {
                errorMessage = error.message || this.t('errors.reverseGeocodeFailed');
            }
            this.showError(errorMessage, 'form');
        } finally {
            if (this.state.info === this.t('infos.fetchingAddress')) this.showInfo(null);
        }
    }

    async handleAddressInput(query) {
        if (query.length < 2) {
            this.state.suggestions = [];
            this.renderSuggestions();
            return;
        }
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
        this.state.suggestions = [];
        this.renderSuggestions();
        this.elements.originInput.focus();
        this.clearMessages();
        this._setCachedStartLocation(value, lat, lon);

        if (this.elements.clearInputBtn) this.elements.clearInputBtn.style.display = 'block';
        if (this.elements.currentLocationBtn) this.elements.currentLocationBtn.style.display = 'none';
    }

    handleSuggestionNavigation(e) {
        if (!this.elements.suggestionsContainer || this.state.suggestions.length === 0) return;
        e.preventDefault(); // Prevent cursor movement in input

        const items = Array.from(this.elements.suggestionsContainer.querySelectorAll('.suggestion-item'));
        if (items.length === 0) return;

        let currentIndex = items.findIndex(item => item.classList.contains('active-suggestion'));

        items.forEach(item => item.classList.remove('active-suggestion'));

        if (e.key === 'ArrowDown') {
            currentIndex = (currentIndex + 1) % items.length;
        } else if (e.key === 'ArrowUp') {
            currentIndex = (currentIndex - 1 + items.length) % items.length;
        }

        if (currentIndex >= 0 && currentIndex < items.length) {
            items[currentIndex].classList.add('active-suggestion');
            items[currentIndex].focus(); // Make it focusable for screen readers and further interaction
            // Scroll into view if necessary
            items[currentIndex].scrollIntoView({block: 'nearest', inline: 'nearest'});
            this.elements.originInput.setAttribute('aria-activedescendant', items[currentIndex].id || `suggestion-item-${currentIndex}`); // Assuming items have IDs
        }
    }

    handleSuggestionEnter(e) {
        if (!this.elements.suggestionsContainer || this.state.suggestions.length === 0) return;

        const activeItem = this.elements.suggestionsContainer.querySelector('.suggestion-item.active-suggestion');
        if (activeItem) {
            e.preventDefault(); // Prevent form submission if input is in a form
            this.handleSuggestionSelect(activeItem.dataset.value, activeItem.dataset.lat, activeItem.dataset.lon);
        } else if (this.state.suggestions.length > 0 && this.elements.originInput.value.trim().length >= 2) {
            // If no specific item is active but there are suggestions and input has text,
            // potentially select the first one or trigger search directly.
            // For now, let's assume if Enter is pressed without an active suggestion,
            // the user might intend to search with the current text if it's valid.
            // Or, if the first suggestion is implicitly selected, uncomment the following:
            // const firstItem = this.elements.suggestionsContainer.querySelector('.suggestion-item');
            // if (firstItem) {
            //   this.handleSuggestionSelect(firstItem.dataset.value, firstItem.dataset.lat, firstItem.dataset.lon);
            // }
            // If the intention is to proceed with search if enter is hit:
            // this.handleSearch(); // Be cautious with this, as it might not always be the desired UX.
        }
        // If no active item and no clear "next step", the default browser behavior for Enter on an input might occur (e.g., form submission).
    }

    async handleSearch() {
        if (this.loadingTextTimeout1) clearTimeout(this.loadingTextTimeout1);
        if (this.loadingTextTimeout2) clearTimeout(this.loadingTextTimeout2);
        this.loadingTextTimeout1 = null;
        this.loadingTextTimeout2 = null;
        this.clearMessages();

        // Ensure boxes are collapsed before a new search
        this.elements.collapsibleToActivity?.classList.remove('expanded');
        this.elements.collapsibleFromActivity?.classList.remove('expanded');

        if (!this.config.overrideUserStartLocation && this.elements.originInput && !this.elements.originInput.value) {
            this.showInfo(this.t('infos.originRequired'));
            return;
        }


        const datesFullyDetermined = this.config.multiday && this.config.activityDurationDaysFixed && (this.config.overrideActivityStartDate || this.config.overrideActivityEndDate);

        if (!datesFullyDetermined) {
            const activityDateStartInput = this.config.multiday ? this.elements.activityDateStart : this.elements.activityDate;
            const activityDateEndInput = this.config.multiday ? this.elements.activityDateEnd : null;

            if (!this.config.overrideActivityStartDate && (!activityDateStartInput || !activityDateStartInput.value)) {
                this.showInfo(this.t('infos.dateRequired'), 'form');
                return;
            }
            if (this.config.multiday && !this.config.overrideActivityEndDate && (!activityDateEndInput || !activityDateEndInput.value) && !this.config.activityDurationDaysFixed) {
                this.showInfo(this.t('infos.endDateRequired'), 'form');
                return;
            }
        }


        if (!this.config.multiday && !this.config.overrideActivityStartDate) {
            // Single day date is already in this.state.selectedDate via _updateSingleDayDateButtonStates or native picker change
        } else if (this.config.multiday) {
            if (!this.config.overrideActivityStartDate && !datesFullyDetermined) {
                const inputVal = this.elements.activityDateStart?.value;
                if (inputVal) this.state.selectedDate = DateTime.fromISO(inputVal, {zone: 'utc'}).toJSDate();
            }
            if (!this.config.overrideActivityEndDate && !datesFullyDetermined) {
                if (this.elements.activityDateEnd?.value) {
                    this.state.selectedEndDate = DateTime.fromISO(this.elements.activityDateEnd.value, {zone: 'utc'}).toJSDate();
                } else if (this.config.activityDurationDaysFixed && this.state.selectedDate) {
                    this.state.selectedEndDate = DateTime.fromJSDate(this.state.selectedDate).plus({days: this.config.activityDurationDaysFixed - 1}).toJSDate();
                }
            }
        }


        if (this.config.multiday && this.state.selectedDate && this.state.selectedEndDate && DateTime.fromJSDate(this.state.selectedDate).startOf('day') > DateTime.fromJSDate(this.state.selectedEndDate).startOf('day')) {
            this.showInfo(this.t('infos.endDateAfterStartDate'));
            return;
        }

        this.setLoadingState(true);
        try {
            await this.fetchActivityData();
            this.navigateToResults();
            this.slideToRecommendedConnections();
        } catch (error) {
            if (error.isSessionExpired) {
                this.setLoadingState(false);
                return;
            }
            console.error("Search error:", error);
            let errorMessage = this.t('errors.connectionError');
            let errorResponse = null;
            if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
                errorMessage = !window.navigator.onLine ? this.t('errors.api.networkError') : this.t('errors.api.apiUnreachable');
            } else if (error.response) {
                errorResponse = error.response;
                errorResponse = error.response.clone();
                try {
                    const errorBody = await error.response.json();
                    if (errorBody && errorBody.code) errorMessage = this.t(getApiErrorTranslationKey(errorBody.code));
                    else if (errorBody && errorBody.error) errorMessage = this.t('errors.api.unknown');
                } catch (parseError) {
                    errorMessage = this.t('errors.api.unknown');
                }
            } else if (error.message) {
                // Use the error message directly if it's not one of the known API error patterns
                errorMessage = error.message || this.t('errors.api.unknown');
            }
            this.showError(errorMessage, 'form', false, errorResponse);
        } finally {
            this.setLoadingState(false);
        }
    }

    async fetchSuggestions(query) {
        try {
            const fetch_lang = navigator.language.split("-")[0];
            const response = await this._fetchApi(
                `${this.config.apiBaseUrl}/address-autocomplete?q=${encodeURIComponent(query)}&lang=${fetch_lang}`
            );
            return await response.json();
        } catch (error) {
            if (error.isSessionExpired) {
                return {features: []};
            }
            console.error("Suggestions error:", error);
            let errorMessage = this.t('errors.suggestionError');
            if (error.body && typeof error.body === 'object' && error.body.code) {
                errorMessage = this.t(getApiErrorTranslationKey(error.body.code));
            } else if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
                errorMessage = !window.navigator.onLine ? this.t('errors.api.networkError') : this.t('errors.api.apiUnreachable');
            }
            this.showError(errorMessage, 'form');
            return {features: []};
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
            date: formatDatetime(activityStartDate, this.config.timezone), // Use timezone for date formatting if it's local
            activity_name: this.config.activityName,
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
            if (!this.config.activityDurationMinutes) {
                params.activity_duration_minutes = 0;
            }
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
        const response = await this._fetchApi(
            `${this.config.apiBaseUrl}/connections?${queryString}`
        );

        const result = await response.json();
        if (!result?.connections?.from_activity || !result?.connections?.to_activity) {
            console.error("API response missing expected connection data:", result);
            const apiError = new Error(this.t('errors.api.invalidDataReceived'));
            apiError.response = {
                json: async () => ({error: "Invalid connection data", code: "APP_INVALID_DATA"}),
                status: 500
            };
            throw apiError;
        }
        this.state.toConnections = result.connections.to_activity;
        this.state.fromConnections = result.connections.from_activity;

        // Mark original first and last elements
        this.state.toConnections.forEach(conn => {
            if (conn.connection_elements && conn.connection_elements.length > 0) {
                conn.connection_elements[0].isOriginalFirst = true;
                conn.connection_elements[conn.connection_elements.length - 1].isOriginalLast = true;
            }
        });
        this.state.fromConnections.forEach(conn => {
            if (conn.connection_elements && conn.connection_elements.length > 0) {
                conn.connection_elements[0].isOriginalFirst = true;
                conn.connection_elements[conn.connection_elements.length - 1].isOriginalLast = true;
            }
        });

        // Process connections to filter short walks and adjust times
        this._processAndFilterConnections(this.state.toConnections, 'to');
        this._processAndFilterConnections(this.state.fromConnections, 'from');

        const toIndex = result.connections.recommended_to_activity_connection;
        const fromIndex = result.connections.recommended_from_activity_connection;
        this.state.recommendedToIndex = (typeof toIndex === 'number' && toIndex >= 0 && toIndex < this.state.toConnections.length) ? toIndex : 0;
        this.state.recommendedFromIndex = (typeof fromIndex === 'number' && fromIndex >= 0 && fromIndex < this.state.fromConnections.length) ? fromIndex : 0;

        if (this.state.toConnections.length === 0 && this.state.fromConnections.length === 0) console.warn("No connections received.");
        else if (this.state.toConnections.length === 0) console.warn("No 'to_activity' connections received.");
        else if (this.state.fromConnections.length === 0) console.warn("No 'from_activity' connections received.");

        this.renderConnectionResults();
    }

    _getElementDurationMinutes(element) {
        if (typeof element.duration === 'number') {
            return element.duration;
        }
        // Fallback to calculate from timestamps
        const durationStr = calculateTimeDifference(element.departure_time, element.arrival_time, (key) => this.t(key));
        return parseDurationToMinutes(durationStr, (key) => this.t(key));
    }

    _processAndFilterConnections(connections, type) {
        connections.forEach(conn => {
            if (!conn.connection_elements || conn.connection_elements.length <= 1) {
                return; // Nothing to filter if 0 or 1 elements
            }

            if (type === 'to') {
                const lastElement = conn.connection_elements[conn.connection_elements.length - 1];
                const durationLastLegMinutes = this._getElementDurationMinutes(lastElement);

                if (durationLastLegMinutes <= 5 && lastElement.type === "WALK") {
                    // Filter out the last element
                    const removedElement = conn.connection_elements.pop();
                    // Adjust the main connection's end time to the start time of the removed walk
                    conn.connection_end_timestamp = removedElement.departure_time;
                }
            } else if (type === 'from') {
                const firstElement = conn.connection_elements[0];
                const durationFirstLegMinutes = this._getElementDurationMinutes(firstElement);

                if (durationFirstLegMinutes <= 5 && firstElement.type === "WALK") {
                    // Filter out the first element
                    const removedElement = conn.connection_elements.shift();
                    // Adjust the main connection's start time to the arrival time of the removed walk
                    conn.connection_start_timestamp = removedElement.arrival_time;
                }
            }
        });
    }

    renderSuggestions() {
        if (!this.elements.suggestionsContainer || !this.elements.originInput) return;
        this.elements.suggestionsContainer.innerHTML = this.state.suggestions
            .map(feature => `
        <div class="suggestion-item" role="option" tabindex="0"
             data-value="${feature.diana_properties.display_name.replace(/"/g, '"')}"
             data-location_type="${feature.diana_properties.location_type}"
             data-lat="${feature.geometry.coordinates[1]}" data-lon="${feature.geometry.coordinates[0]}">
          ${feature.diana_properties.display_name}
        </div>`).join('');
        this.elements.suggestionsContainer.style.display = this.state.suggestions.length > 0 ? 'block' : 'none';
        this.elements.originInput.setAttribute('aria-expanded', this.state.suggestions.length > 0 ? 'true' : 'false');
    }

    renderConnectionResults() {
        this.showError(null, 'results');
        this.elements.topSlider.innerHTML = '';
        this.elements.bottomSlider.innerHTML = '';

        if (this.elements.collapsibleToActivity) {
            this.elements.collapsibleToActivity.querySelector('.summary-content-wrapper').innerHTML = `<span class="summary-placeholder">${this.t('selectTimeSlotForSummary')}</span>`;
            this.elements.collapsibleToActivity.classList.remove('has-summary', 'expanded');
        }
        if (this.elements.collapsibleFromActivity) {
            this.elements.collapsibleFromActivity.querySelector('.summary-content-wrapper').innerHTML = `<span class="summary-placeholder">${this.t('selectTimeSlotForSummary')}</span>`;
            this.elements.collapsibleFromActivity.classList.remove('has-summary', 'expanded');
        }

        this.elements.activityTimeBox.innerHTML = this.config.activityName;


        if (this.state.toConnections.length === 0 && this.state.fromConnections.length === 0) {
            this.showError(this.t('errors.api.noConnectionsFound'), 'results');
            this.navigateToForm();
            this.showError(this.t('errors.api.noConnectionsFound'), 'form');
            return;
        }
        if (this.state.toConnections.length === 0) {
            this.elements.responseBox.innerHTML = this.t('errors.api.noToConnectionsFound');
            this.elements.collapsibleToActivity.querySelector('.summary-content-wrapper').innerHTML = `<span class="summary-placeholder">${this.t('errors.api.noToConnectionsFound')}</span>`;
        } else {
            this.calculateAnytimeConnections(this.state.toConnections, "to");
            this.renderTimeSlots('topSlider', this.state.toConnections, 'to');
        }
        if (this.state.fromConnections.length === 0) {
            this.elements.responseBoxBottom.innerHTML = this.t('errors.api.noFromConnectionsFound');
            this.elements.collapsibleFromActivity.querySelector('.summary-content-wrapper').innerHTML = `<span class="summary-placeholder">${this.t('errors.api.noFromConnectionsFound')}</span>`;
        } else {
            this.calculateAnytimeConnections(this.state.fromConnections, "from");
            this.renderTimeSlots('bottomSlider', this.state.fromConnections, 'from');
        }

        // Ensure recommended indices are valid after potential filtering or empty arrays
        if (this.state.toConnections.length > 0) {
            let foundRecommendedTo = false;
            for (let i = 0; i < this.state.toConnections.length; i++) {
                if (this.state.toConnections[i].connection_id === this.state.recommendedToIndex) { // Original recommendedToIndex was an ID
                    this.state.recommendedToIndex = i; // Update to be an array index
                    foundRecommendedTo = true;
                    break;
                }
            }
            if (!foundRecommendedTo) this.state.recommendedToIndex = 0; // Default to first if ID not found
        } else {
            this.state.recommendedToIndex = 0; // Or handle as no connections
        }

        if (this.state.fromConnections.length > 0) {
            let foundRecommendedFrom = false;
            for (let i = 0; i < this.state.fromConnections.length; i++) {
                if (this.state.fromConnections[i].connection_id === this.state.recommendedFromIndex) { // Original recommendedFromIndex was an ID
                    this.state.recommendedFromIndex = i; // Update to be an array index
                    foundRecommendedFrom = true;
                    break;
                }
            }
            if (!foundRecommendedFrom) this.state.recommendedFromIndex = 0;
        } else {
            this.state.recommendedFromIndex = 0;
        }


        if (this.state.toConnections.length > 0 && this.state.recommendedToIndex < this.state.toConnections.length) {
            const recTo = this.state.toConnections[this.state.recommendedToIndex];
            this.filterConnectionsByTime('to', convertUTCToLocalTime(recTo.connection_start_timestamp, this.config.timezone), convertUTCToLocalTime(recTo.connection_end_timestamp, this.config.timezone));
        }
        if (this.state.fromConnections.length > 0 && this.state.recommendedFromIndex < this.state.fromConnections.length) {
            const recFrom = this.state.fromConnections[this.state.recommendedFromIndex];
            this.filterConnectionsByTime('from', convertUTCToLocalTime(recFrom.connection_start_timestamp, this.config.timezone), convertUTCToLocalTime(recFrom.connection_end_timestamp, this.config.timezone));
        }


        // Automatically expand single "anytime" connections
        if (this.state.toConnections.length === 1 && this.state.toConnections[0].connection_anytime) {
            if (this.elements.collapsibleToActivity) {
                this.elements.collapsibleToActivity.classList.add('expanded');
            }
        }
        if (this.state.fromConnections.length === 1 && this.state.fromConnections[0].connection_anytime) {
            if (this.elements.collapsibleFromActivity) {
                this.elements.collapsibleFromActivity.classList.add('expanded');
            }
        }


        this.addSwipeBehavior('topSlider');
        this.addSwipeBehavior('bottomSlider');

        if (this.state.preselectTimes) {
            const {
                to_start,
                to_end,
                from_start,
                from_end
            } = this.state.preselectTimes;

            if (to_start && to_end && this.state.toConnections.length > 0) {
                const toConn = this.state.toConnections.find(c =>
                    c.connection_start_timestamp === to_start && c.connection_end_timestamp === to_end
                );
                if (toConn) {
                    const startTimeLocal = convertUTCToLocalTime(toConn.connection_start_timestamp, this.config.timezone);
                    const endTimeLocal = convertUTCToLocalTime(toConn.connection_end_timestamp, this.config.timezone);
                    this.filterConnectionsByTime('to', startTimeLocal, endTimeLocal);
                }
            }

            if (from_start && from_end && this.state.fromConnections.length > 0) {
                const fromConn = this.state.fromConnections.find(c =>
                    c.connection_start_timestamp === from_start && c.connection_end_timestamp === from_end
                );
                if (fromConn) {
                    const startTimeLocal = convertUTCToLocalTime(fromConn.connection_start_timestamp, this.config.timezone);
                    const endTimeLocal = convertUTCToLocalTime(fromConn.connection_end_timestamp, this.config.timezone);
                    this.filterConnectionsByTime('from', startTimeLocal, endTimeLocal);
                }
            }
            delete this.state.preselectTimes;
        }
        this.slideToRecommendedConnections();
    }

    renderTimeSlots(sliderId, connections, type) {
        const slider = this.elements[sliderId];
        slider.innerHTML = '';
        let lastDate = null; // To track the date of the last processed connection

        connections.forEach((conn, index) => {
            // Determine the date of the current connection in the configured timezone
            const connDate = DateTime.fromISO(conn.connection_start_timestamp, { zone: 'utc' })
                .setZone(this.config.timezone)
                .toISODate();

            // If the date has changed from the previous connection, or if it's the first one
            if (lastDate !== connDate) {
                // Create and insert the vertical date separator
                const dateSeparator = document.createElement('div');
                dateSeparator.classList.add('slider-date-separator');
                dateSeparator.textContent = formatLegDateForDisplay(conn.connection_start_timestamp, this.config.timezone, this.config.language, "dd. MMM");
                slider.appendChild(dateSeparator);

                // Update the tracker for the next iteration
                lastDate = connDate;
            }

            const startTimeLocal = convertUTCToLocalTime(conn.connection_start_timestamp, this.config.timezone);
            const endTimeLocal = convertUTCToLocalTime(conn.connection_end_timestamp, this.config.timezone);
            const duration = calculateTimeDifference(conn.connection_start_timestamp, conn.connection_end_timestamp, (key) => this.t(key));
            const anytime = conn.connection_anytime;
            const btn = document.createElement('button');
            btn.dataset.index = index; // Add index for easy targeting

            const transfersHtml = anytime ? this.getTransportIcon("WALK_BLACK") : `
                <div class="transfers-group">
                  <span>${conn.connection_transfers}</span>
                  <svg width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14.8537 8.85354L12.8537 10.8535C12.7598 10.9474 12.6326 11.0001 12.4999 11.0001C12.3672 11.0001 12.24 10.9474 12.1462 10.8535C12.0523 10.7597 11.9996 10.6325 11.9996 10.4998C11.9996 10.3671 12.0523 10.2399 12.1462 10.146L13.293 8.99979H2.70678L3.85366 10.146C3.94748 10.2399 4.00018 10.3671 4.00018 10.4998C4.00018 10.6325 3.94748 10.7597 3.85366 10.8535C3.75983 10.9474 3.63259 11.0001 3.49991 11.0001C3.36722 11.0001 3.23998 10.9474 3.14616 10.8535L1.14616 8.85354C1.09967 8.8071 1.06279 8.75196 1.03763 8.69126C1.01246 8.63056 0.999512 8.5655 0.999512 8.49979C0.999512 8.43408 1.01246 8.36902 1.03763 8.30832C1.06279 8.24762 1.09967 8.19248 1.14616 8.14604L3.14616 6.14604C3.23998 6.05222 3.36722 5.99951 3.49991 5.99951C3.63259 5.99951 3.75983 6.05222 3.85366 6.14604C3.94748 6.23986 4.00018 6.36711 4.00018 6.49979C4.00018 6.63247 3.94748 6.75972 3.85366 6.85354L2.70678 7.99979H13.293L12.1462 6.85354C12.0523 6.75972 11.9996 6.63247 11.9996 6.49979C11.9996 6.36711 12.0523 6.23986 12.1462 6.14604C12.24 6.05222 12.3672 5.99951 12.4999 5.99951C12.6326 5.99951 12.7598 6.05222 12.8537 6.14604L14.8537 8.14604C14.9001 8.19248 14.937 8.24762 14.9622 8.30832C14.9873 8.36902 15.0003 8.43408 15.0003 8.49979C15.0003 8.5655 14.9873 8.63056 14.9622 8.69126C14.937 8.75196 14.9001 8.8071 14.8537 8.85354Z" fill="black"/>
                  </svg>
                </div>
            `;

            const dotPlaceholder = type === 'from' ? `<div class="duration-dot"></div>` : '';

            btn.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
                  <div style="font-size: 14px; margin-bottom: 4px; font-weight: bold;">${startTimeLocal} - ${endTimeLocal}</div>
                  <div class="slider-button-details">
                    <span>${duration}</span>
                    ${dotPlaceholder}
                    ${transfersHtml}
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
                    conn.connection_end_timestamp = convertLocalTimeToUTCDatetime(this.config.activityLatestStartTime, activityDateForCalc, this.config.timezone);
                    conn.connection_start_timestamp = addMinutesToDate(conn.connection_end_timestamp, -connectionDuration);
                } else {
                    conn.connection_start_timestamp = convertLocalTimeToUTCDatetime(this.config.activityEarliestEndTime, activityDateForCalc, this.config.timezone);
                    conn.connection_end_timestamp = addMinutesToDate(conn.connection_start_timestamp, connectionDuration);
                }
                conn.connection_elements[0].departure_time = conn.connection_start_timestamp;
                conn.connection_elements[0].arrival_time = conn.connection_end_timestamp;
            }
        });
    }

    /**
     * Renders a compact summary of a connection for the collapsible header.
     * @param {object} connection - The connection object.
     * @param {string} type - 'to' or 'from'.
     * @returns {string} HTML string for the summary.
     */
    _renderConnectionSummary(connection, type) {
        if (!connection || !connection.connection_elements || connection.connection_elements.length === 0) return '';

        const startTimeLocal = convertUTCToLocalTime(connection.connection_start_timestamp, this.config.timezone);
        const endTimeLocal = convertUTCToLocalTime(connection.connection_end_timestamp, this.config.timezone);
        const duration = calculateTimeDifference(connection.connection_start_timestamp, connection.connection_end_timestamp, (key) => this.t(key));
        const transfers = connection.connection_transfers;

        let fromLocation, toLocation;

        if (type === 'to') {
            fromLocation = this.elements.originInput.value;
            toLocation = connection.connection_elements[connection.connection_elements.length - 1].to_location;
        } else { // 'from'
            fromLocation = connection.connection_elements[0].from_location;
            toLocation = this.elements.originInput.value;
        }

        const mainTransportTypes = [...connection.connection_elements
            .filter(el => el.type === 'JNY')
            .map(el => el.vehicle_type)
        ];

        if (connection.connection_anytime || (connection.connection_elements.length > 0 && connection.connection_elements.every(el => el.type === 'WALK'))) {
            if (!mainTransportTypes.includes('WALK')) {
                mainTransportTypes.unshift('WALK');
            }
        }

        const iconsHTML = mainTransportTypes.slice(0, 4).map(t => `<span title="${this.getTransportName(t)}" alt="${this.getTransportName(t)}">${this.getTransportIcon(t)}</span>`).join('');

        const isLive = connection.connection_elements && connection.connection_elements.length > 0 && connection.connection_elements.every(el => el.provider === 'live');
        const liveIndicatorHTML = isLive ? `<span class="live-indicator">${this.t('live')}</span>` : '';

        return `
            <div class="summary-line-1">
                <strong>${type === "to" ? this.t("journeyToActivity") + "  " : this.t("journeyFromActivity") + "  "}${startTimeLocal} - ${endTimeLocal}</strong>
                <div class="summary-icons">${iconsHTML}</div>
            </div>
            <div class="summary-line-2">
                ${fromLocation} - ${toLocation}
            </div>
            <div class="summary-line-3">
                <span>${duration} &bull; ${transfers} ${this.t('transfers')}</span>
                ${liveIndicatorHTML}
            </div>
        `;
    }

    _updateOppositeSlider(sourceType) {
        const { selectedToConnection, selectedFromConnection, toConnections, fromConnections } = this.state;
        const { topSlider, bottomSlider, collapsibleToActivity, collapsibleFromActivity } = this.elements;

        if (sourceType === 'to') {
            // Update 'from' slider based on 'to' selection
            const fromButtons = bottomSlider.querySelectorAll('button');
            if (!selectedToConnection) {
                fromButtons.forEach(btn => btn.classList.remove('disabled'));
                this._updateFromConnectionDots(); // Clear dots
                return;
            }
            const arrivalTime = DateTime.fromISO(selectedToConnection.connection_end_timestamp, { zone: 'utc' });

            // Disable invalid buttons
            fromConnections.forEach((fromConn, index) => {
                const departureTime = DateTime.fromISO(fromConn.connection_start_timestamp, { zone: 'utc' });
                const button = bottomSlider.querySelector(`button[data-index="${index}"]`);
                if (button) {
                    if (departureTime < arrivalTime) {
                        button.classList.add('disabled');
                    } else {
                        button.classList.remove('disabled');
                    }
                }
            });

            // Check if current 'from' selection is now invalid
            if (selectedFromConnection) {
                const selectedDepartureTime = DateTime.fromISO(selectedFromConnection.connection_start_timestamp, { zone: 'utc' });
                if (selectedDepartureTime < arrivalTime) {
                    // It's invalid, so clear it
                    this.state.selectedFromConnection = null;
                    this.state.activityTimes.end = ''; // Clear end time
                    this.state.activityTimes.duration = ''; // Clear duration

                    // Reset UI for 'from' connection
                    const summaryWrapper = collapsibleFromActivity?.querySelector('.summary-content-wrapper');
                    if (summaryWrapper) {
                        summaryWrapper.innerHTML = `<span class="summary-placeholder">${this.t('selectTimeSlotForSummary')}</span>`;
                        collapsibleFromActivity.classList.remove('has-summary', 'expanded');
                    }
                    this.elements.responseBoxBottom.innerHTML = '';
                    bottomSlider.querySelectorAll('button.active-time').forEach(btn => btn.classList.remove('active-time'));

                    // Re-render activity box with partial data
                    this.elements.activityTimeBox.innerHTML = this.getActivityTimeBoxHTML();
                }
            }
            this._updateFromConnectionDots();


        } else if (sourceType === 'from') {
            // Update 'to' slider based on 'from' selection
            const toButtons = topSlider.querySelectorAll('button');
            if (!selectedFromConnection) {
                toButtons.forEach(btn => btn.classList.remove('disabled'));
                return;
            }
            const departureTime = DateTime.fromISO(selectedFromConnection.connection_start_timestamp, { zone: 'utc' });

            // Disable invalid buttons
            toConnections.forEach((toConn, index) => {
                const arrivalTime = DateTime.fromISO(toConn.connection_end_timestamp, { zone: 'utc' });
                const button = topSlider.querySelector(`button[data-index="${index}"]`);
                if (button) {
                    if (arrivalTime > departureTime) {
                        button.classList.add('disabled');
                    } else {
                        button.classList.remove('disabled');
                    }
                }
            });

            // Check if current 'to' selection is now invalid
            if (selectedToConnection) {
                const selectedArrivalTime = DateTime.fromISO(selectedToConnection.connection_end_timestamp, { zone: 'utc' });
                if (selectedArrivalTime > departureTime) {
                    // It's invalid, so clear it
                    this.state.selectedToConnection = null;
                    this.state.activityTimes.start = ''; // Clear start time
                    this.state.activityTimes.duration = ''; // Clear duration

                    // Reset UI for 'to' connection
                    const summaryWrapper = collapsibleToActivity?.querySelector('.summary-content-wrapper');
                    if (summaryWrapper) {
                        summaryWrapper.innerHTML = `<span class="summary-placeholder">${this.t('selectTimeSlotForSummary')}</span>`;
                        collapsibleToActivity.classList.remove('has-summary', 'expanded');
                    }
                    this.elements.responseBox.innerHTML = '';
                    topSlider.querySelectorAll('button.active-time').forEach(btn => btn.classList.remove('active-time'));

                    // Re-render activity box with partial data
                    this.elements.activityTimeBox.innerHTML = this.getActivityTimeBoxHTML();
                    this._updateFromConnectionDots(); // Clear dots
                }
            }
        }
    }

    filterConnectionsByTime(type, startTimeLocal, endTimeLocal) {
        const connections = type === 'from' ? this.state.fromConnections : this.state.toConnections;
        const sliderId = type === 'from' ? 'bottomSlider' : 'topSlider';
        const targetBox = type === 'from' ? this.elements.responseBoxBottom : this.elements.responseBox;
        const container = type === 'to' ? this.elements.collapsibleToActivity : this.elements.collapsibleFromActivity;
        const summaryWrapper = container?.querySelector('.summary-content-wrapper');

        const slider = this.elements[sliderId];
        slider.querySelectorAll('button').forEach(btn => {
            btn.classList.remove('active-time');
            const timeDiv = btn.querySelector('div > div:first-child');
            if (timeDiv && timeDiv.textContent.includes(`${startTimeLocal} - ${endTimeLocal}`)) {
                btn.classList.add('active-time');
            }
        });
        const filtered = connections.filter(conn =>
            convertUTCToLocalTime(conn.connection_start_timestamp, this.config.timezone) === startTimeLocal &&
            convertUTCToLocalTime(conn.connection_end_timestamp, this.config.timezone) === endTimeLocal
        );

        if (filtered.length > 0) {
            const selectedConnection = filtered[0];
            this.updateActivityTimeBox(selectedConnection, type);
            targetBox.innerHTML = this.renderConnectionDetails(filtered, type);

            if (summaryWrapper && container) {
                summaryWrapper.innerHTML = this._renderConnectionSummary(selectedConnection, type);
                container.classList.add('has-summary');
            }

            // Collapse containers on new selection, unless they are single "anytime" connections.
            if (this.elements.collapsibleToActivity && !(this.state.toConnections.length === 1 && this.state.toConnections[0].connection_anytime)) {
                this.elements.collapsibleToActivity.classList.remove('expanded');
            }
            if (this.elements.collapsibleFromActivity && !(this.state.fromConnections.length === 1 && this.state.fromConnections[0].connection_anytime)) {
                this.elements.collapsibleFromActivity.classList.remove('expanded');
            }

            if (type === 'to') {
                this.state.selectedToConnection = selectedConnection;
            } else {
                this.state.selectedFromConnection = selectedConnection;
            }
            this._updateOppositeSlider(type);
        } else {
            targetBox.innerHTML = `<div>${this.t('noConnectionDetails')}</div>`;
            if (summaryWrapper && container) {
                summaryWrapper.innerHTML = `<span class="summary-placeholder">${this.t('noConnectionDetails')}</span>`;
                container.classList.remove('has-summary', 'expanded');
            }
        }
    }


    _updateFromConnectionDots() {
        if (this.config.multiday || !this.elements.bottomSlider) {
            return;
        }

        const recommendedDurationMinutes = parseInt(this.config.activityDurationMinutes, 10);

        // Clear all dots if no 'to' connection is selected
        if (!this.state.selectedToConnection) {
            this.elements.bottomSlider.querySelectorAll('.duration-dot').forEach(dot => {
                dot.className = 'duration-dot'; // Reset classes
            });
            return;
        }

        const arrivalTimeToActivity = DateTime.fromISO(this.state.selectedToConnection.connection_end_timestamp, { zone: 'utc' }).setZone(this.config.timezone);

        this.state.fromConnections.forEach((fromConn, index) => {
            const button = this.elements.bottomSlider.querySelector(`button[data-index="${index}"]`);
            if (!button) return;

            const dotElement = button.querySelector('.duration-dot');
            if (!dotElement) return;

            // Reset dot style
            dotElement.className = 'duration-dot';

            const departureTimeFromActivity = DateTime.fromISO(fromConn.connection_start_timestamp, { zone: 'utc' }).setZone(this.config.timezone);

            // Skip if this 'from' connection is invalid based on the 'to' connection
            if (departureTimeFromActivity < arrivalTimeToActivity) return;

            const durationResult = calculateDurationLocalWithDates(arrivalTimeToActivity, departureTimeFromActivity, (key) => this.t(key));
            const actualMinutes = durationResult.totalMinutes;

            if (actualMinutes < recommendedDurationMinutes) {
                dotElement.classList.add('dot-too-short');
            } else if ((actualMinutes / recommendedDurationMinutes) > 1.10) {
                dotElement.classList.add('dot-too-long');
            }
        });
    }


    updateActivityTimeBox(connection, type) {
        if (!connection) return;
        try {
            const activityStartDate = this.state.selectedDate;
            const activityEndDate = this.config.multiday && this.state.selectedEndDate ? this.state.selectedEndDate : activityStartDate;

            // The connection timestamps are pre-adjusted by _processAndFilterConnections, so we use them directly.
            const connectionStartTimeLocal = convertUTCToLocalTime(connection.connection_start_timestamp, this.config.timezone);
            const connectionEndTimeLocal = convertUTCToLocalTime(connection.connection_end_timestamp, this.config.timezone);

            if (type === 'to') {
                const earliestConfigStartLocal = convertConfigTimeToLocalTime(this.config.activityEarliestStartTime, activityStartDate, this.config.timezone);
                this.state.activityTimes.start = getLaterTime(connectionEndTimeLocal, earliestConfigStartLocal, this.config.timezone);
            } else { // type === 'from'
                const latestConfigEndLocal = convertConfigTimeToLocalTime(this.config.activityLatestEndTime, activityEndDate, this.config.timezone);
                this.state.activityTimes.end = getEarlierTime(connectionStartTimeLocal, latestConfigEndLocal, this.config.timezone);
            }

            if (!this.config.multiday && this.state.activityTimes.start && this.state.activityTimes.end) {
                const startDateForDuration = DateTime.fromFormat(this.state.activityTimes.start, 'HH:mm', {zone: this.config.timezone})
                    .set({
                        year: activityStartDate.getFullYear(),
                        month: activityStartDate.getMonth() + 1,
                        day: activityStartDate.getDate()
                    });
                const endDateForDuration = DateTime.fromFormat(this.state.activityTimes.end, 'HH:mm', {zone: this.config.timezone})
                    .set({
                        year: activityStartDate.getFullYear(),
                        month: activityStartDate.getMonth() + 1,
                        day: activityStartDate.getDate()
                    });
                const durationResult = calculateDurationLocalWithDates(startDateForDuration, endDateForDuration, (key) => this.t(key));
                this.state.activityTimes.warning_duration = durationResult.totalMinutes < parseInt(this.config.activityDurationMinutes, 10);
            } else {
                this.state.activityTimes.warning_duration = false;
            }

            this.elements.activityTimeBox.innerHTML = this.getActivityTimeBoxHTML();

        } catch (error) {
            console.error("Error updating activity time box:", error);
            this.elements.activityTimeBox.innerHTML = `<div class="error-message">${this.t('errors.activityTimeError')}</div>`;
        }
    }

    getActivityTimeBoxHTML() {
        try {
            const activityStartDate = this.state.selectedDate;
            const activityEndDate = this.config.multiday && this.state.selectedEndDate ? this.state.selectedEndDate : activityStartDate;
            const recommendedDurationMinutes = parseInt(this.config.activityDurationMinutes, 10);

            let durationDisplayHtml;
            let durationWarningHtml = '';

            const isMultiDayDisplay = this.config.multiday && activityStartDate && activityEndDate &&
                DateTime.fromJSDate(activityEndDate).startOf('day') > DateTime.fromJSDate(activityStartDate).startOf('day');

            if (isMultiDayDisplay) {
                const numDays = Math.round(DateTime.fromJSDate(activityEndDate).diff(DateTime.fromJSDate(activityStartDate), 'days').days) + 1;
                const numNights = numDays - 1;
                const daysText = numDays === 1 ? this.t('daySg') : this.t('dayPl');

                if (numNights > 0) {
                    const nightsText = numNights === 1 ? this.t('nightSg') : this.t('nightPl');
                    durationDisplayHtml = `<span>${numDays} ${daysText} / ${numNights} ${nightsText}</span>`;
                } else {
                    durationDisplayHtml = `<span>${numDays} ${daysText}</span>`;
                }
            } else {
                if (this.state.activityTimes.start && this.state.activityTimes.end) {
                    const startDateForDuration = DateTime.fromFormat(this.state.activityTimes.start, 'HH:mm', {zone: this.config.timezone})
                        .set({
                            year: activityStartDate.getFullYear(),
                            month: activityStartDate.getMonth() + 1,
                            day: activityStartDate.getDate()
                        });
                    const endDateForDuration = DateTime.fromFormat(this.state.activityTimes.end, 'HH:mm', {zone: this.config.timezone})
                        .set({
                            year: activityStartDate.getFullYear(),
                            month: activityStartDate.getMonth() + 1,
                            day: activityStartDate.getDate()
                        });

                    if (endDateForDuration < startDateForDuration) {
                        durationDisplayHtml = `<span>--</span>`;
                    } else {
                        const durationResult = calculateDurationLocalWithDates(startDateForDuration, endDateForDuration, (key) => this.t(key));
                        this.state.activityTimes.duration = durationResult.text; // Store for sharing
                        durationDisplayHtml = `<span>${durationResult.text}</span>`;
                        const actualMinutes = durationResult.totalMinutes;
                        const diffMinutes = actualMinutes - recommendedDurationMinutes;

                        if (diffMinutes < 0) {
                            const timeShorter = getTimeFormatFromMinutes(Math.abs(diffMinutes), (k) => this.t(k));
                            const visibleWarningText = `${timeShorter} ${this.t("warnings.durationShorter")}`;
                            const tooltipText = `${this.t("warnings.duration")} (${getTimeFormatFromMinutes(recommendedDurationMinutes, (k) => this.t(k))})`;
                            const rabbitIcon = `<svg style="fill: var(--error-color); color: var(--error-color);" width="18" height="18" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M 29.3459 49.1765 C 30.6543 49.1765 31.7945 48.5597 34.2618 48.5597 C 36.7292 48.5597 37.4018 49.1765 39.2335 49.1765 C 42.0001 49.1765 43.4582 48.0176 43.4582 46.0924 C 43.4582 42.8027 39.8694 40.5971 34.2431 40.5971 C 31.4767 40.5971 30.2244 40.8587 28.6730 41.2513 L 26.6542 36.6531 C 24.6542 32.2419 21.4767 29.3634 16.9533 29.3634 L 14.7477 29.3634 C 14.0187 29.3634 13.5327 29.0456 13.5327 28.3353 C 13.5327 27.1765 15.0841 26.8961 16.7851 26.8961 C 22.2430 26.8961 26.2991 29.9054 28.7664 35.9615 L 30.0374 39.0830 C 31.3085 38.8213 32.6730 38.6905 34.0562 38.6905 C 35.1590 38.6905 36.1684 38.7653 37.2338 38.9148 C 38.3554 38.0737 39.6638 37.1952 41.5514 36.3727 C 43.6450 37.7933 46.0188 38.7092 48.5234 38.7092 C 53.6825 38.7092 56.0000 37.5877 56.0000 32.7092 C 56.0000 26.8213 51.7382 22.4101 46.0750 22.4288 L 41.0469 15.7559 C 38.2245 12.0923 34.8786 10.3353 31.5701 10.3353 C 28.8412 10.3353 24.7851 11.9054 24.7851 14.1110 C 24.7851 15.6064 27.8131 17.6998 30.1496 19.1391 L 40.9160 25.7185 C 40.0749 26.5223 39.3086 26.9522 38.3925 26.9522 C 36.9348 26.9522 35.4392 26.0737 33.1777 24.7653 C 27.4019 21.4382 22.9720 18.3167 16.9907 18.3167 C 10.7664 18.3167 6.0374 21.8867 3.5140 28.8400 C 1.5140 28.8400 0 30.1485 0 32.0737 C 0 34.2419 1.7196 35.6064 4.0748 35.6064 C 6.8038 39.4195 11.2711 40.9522 16.5608 40.9522 C 16.8412 40.9522 17.1215 40.9335 17.4019 40.9335 L 24.9720 47.2139 C 26.8412 48.9148 27.9253 49.1765 29.3459 49.1765 Z M 48.0936 31.8120 C 47.2525 31.8120 46.5796 31.1017 46.5796 30.2793 C 46.5796 29.4382 47.2713 28.6905 48.1123 28.6905 C 48.9721 28.6905 49.6263 29.3634 49.6263 30.2045 C 49.6263 31.0456 48.9346 31.8120 48.0936 31.8120 Z M 15.8318 50.6531 C 19.4393 50.6531 21.6262 49.9616 23.4206 48.7279 L 17.6449 43.9055 C 17.3832 43.9242 17.0655 43.9616 16.6729 43.9616 C 15.7383 43.9616 14.3552 43.6812 12.7103 43.6812 C 10.6168 43.6812 9.3271 44.8027 9.3271 46.4849 C 9.3271 48.9896 11.8692 50.6531 15.8318 50.6531 Z"></path></g></svg>`;


                            durationWarningHtml = `
                                <div class="activity-duration-warning-wrapper">
                                    <span class="warning-icon-wrapper">
                                        ${rabbitIcon}
                                        <span class="warning-tooltip">${tooltipText}</span>
                                        <span>${visibleWarningText}</span>
                                    </span>
                                </div>`;
                        } else if (diffMinutes > 0 && (actualMinutes / recommendedDurationMinutes) > 1.10) {
                            const timeLonger = getTimeFormatFromMinutes(diffMinutes, (k) => this.t(k));
                            const visibleWarningText = `${timeLonger} ${this.t("warnings.durationLonger")}`;
                            const tooltipText = `${this.t("warnings.duration")} (${getTimeFormatFromMinutes(recommendedDurationMinutes, (k) => this.t(k))})`;
                            const turtleIcon = `<svg style="fill: var(--primary-color); color: var(--primary-color);" width="18" height="18" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M 4.8942 42.0850 C 8.1403 42.0850 11.4863 40.6700 14.1332 37.9400 C 15.9810 38.9388 17.7789 39.8544 20.4590 39.8544 C 23.3888 39.8544 25.2200 39.0886 26.8680 38.1730 C 29.4317 40.7200 32.7443 42.1183 35.9238 42.1183 C 38.5708 42.1183 40.5850 41.0196 40.5850 38.9887 C 40.5850 37.0577 39.1534 36.2586 37.2057 35.7259 C 36.7062 35.5928 36.2068 35.4762 35.7077 35.3431 C 43.0986 35.1932 43.1818 31.4477 48.1426 31.4477 C 52.6541 31.4477 56.0000 29.8829 56.0000 26.7866 C 56.0000 20.1611 52.2045 16.6320 47.7932 16.6320 C 43.2653 16.6320 40.8512 19.4952 39.8857 23.2574 C 39.3365 25.3050 38.3710 26.5868 36.9060 27.3193 L 35.8573 25.3882 C 31.4958 17.2479 27.3674 13.9851 20.6920 13.9685 C 13.4673 13.9851 9.7717 17.1314 4.3948 27.3193 C 2.7634 30.4322 0 31.1148 0 33.0624 C 0 34.4275 1.0488 35.3431 3.1629 35.3431 L 4.8775 35.3431 C 4.1617 35.5428 3.4459 35.7259 2.7967 35.9590 C 1.2319 36.5083 .2331 37.3407 .2331 38.9388 C .2331 40.9697 2.2473 42.0850 4.8942 42.0850 Z M 20.6920 16.6154 C 25.1867 16.6154 28.0499 18.6296 30.3805 21.6094 C 27.6338 23.9233 24.3044 25.2218 20.4923 25.2218 C 16.7301 25.2218 13.4507 23.9899 10.7539 21.7259 C 13.6005 17.9471 16.3971 16.6154 20.6920 16.6154 Z M 40.5018 31.9305 C 39.7361 31.3478 38.8537 30.2491 38.3212 29.3169 C 40.1356 28.6344 41.3507 27.4191 42.0666 24.5725 C 42.8658 21.1433 44.6969 19.1457 47.7932 19.1457 C 50.9727 19.1457 53.6196 22.0755 53.6196 26.3871 C 53.6196 27.9852 51.1725 29.0172 48.6421 29.0172 C 44.7634 29.0172 42.6326 30.5654 40.5018 31.9305 Z M 48.2759 25.1219 C 49.0083 25.1219 49.5909 24.5226 49.5909 23.7901 C 49.5909 23.0577 49.0083 22.4750 48.2759 22.4750 C 47.5433 22.4750 46.9606 23.0577 46.9606 23.7901 C 46.9606 24.5226 47.5433 25.1219 48.2759 25.1219 Z M 33.7098 26.8199 C 34.8584 28.8674 36.3234 31.1980 37.8050 32.6629 C 37.1225 32.6796 36.3401 32.6629 35.5409 32.6629 C 33.0607 32.6629 31.2129 33.1124 29.6647 33.7283 C 28.0499 31.5809 26.8847 28.5345 26.6183 26.2705 C 28.5660 25.5381 30.2307 24.5060 31.6291 23.3573 C 32.3447 24.4394 33.0273 25.6047 33.7098 26.8199 Z M 5.8264 32.6629 C 4.9774 32.6629 4.1118 32.6796 3.3460 32.7295 L 3.2129 32.4964 C 4.3448 31.5476 5.7598 30.3490 6.7586 28.3514 C 7.7408 26.4703 8.6397 24.8722 9.5220 23.4905 C 10.9203 24.6391 12.6350 25.6879 14.6825 26.4037 C 14.3496 28.5844 13.1510 31.6475 11.6195 33.7283 C 10.1046 33.1124 8.2735 32.6629 5.8264 32.6629 Z M 20.4590 37.2075 C 17.5458 37.2075 15.7646 35.8425 13.4673 34.6106 C 15.0155 32.4132 16.1641 29.3835 16.4970 26.9198 C 17.7289 27.2028 19.0606 27.3692 20.4923 27.3692 C 22.0238 27.3692 23.4388 27.1694 24.7539 26.8532 C 25.0036 29.4168 26.1855 32.4465 27.8002 34.6272 C 25.4863 35.8591 23.6219 37.2075 20.4590 37.2075 Z M 2.7134 38.5892 C 2.7134 37.9899 3.1463 37.5904 4.4281 37.2741 C 5.2105 37.0743 7.2913 36.4251 8.8062 35.7093 C 9.9382 35.9590 10.9203 36.3252 11.8026 36.7414 C 9.2557 38.8888 6.9750 39.8544 4.9108 39.8544 C 3.4459 39.8544 2.7134 39.3882 2.7134 38.5892 Z M 36.3902 37.3240 C 37.6717 37.6403 38.1047 38.0398 38.1047 38.6391 C 38.1047 39.4215 37.3721 39.8876 35.9071 39.8876 C 33.8762 39.8876 31.6291 38.9554 29.1320 36.8912 C 29.9810 36.4251 30.8965 36.0256 31.9786 35.7426 C 33.4770 36.4584 35.6078 37.1076 36.3902 37.3240 Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></g></svg>`;

                            durationWarningHtml = `
                                <div class="activity-duration-warning-wrapper">
                                    <span class="warning-icon-wrapper">
                                        ${turtleIcon}
                                        <span class="warning-tooltip">${tooltipText}</span>
                                        <span>${visibleWarningText}</span>
                                    </span>
                                </div>`;
                        }
                    }

                } else {
                    durationDisplayHtml = `<span>--</span>`;
                }
            }

            const locale = this.config.language.split('-')[0];
            const startLocationDisplay = this.config.activityStartLocationDisplayName || this.config.activityStartLocation;
            const endLocationDisplay = this.config.activityEndLocationDisplayName || this.config.activityEndLocation;

            const startDateTimeText = this.state.activityTimes.start ? `${formatLegDateForDisplay(activityStartDate.toISOString(), this.config.timezone, locale)} ${this.state.activityTimes.start}` : '--';
            const endDateTimeText = this.state.activityTimes.end ? `${formatLegDateForDisplay(activityEndDate.toISOString(), this.config.timezone, locale)} ${this.state.activityTimes.end}` : '--';

            const startLocationDisplayText = startLocationDisplay ? `${startLocationDisplay}` : '--';
            const endLocationDisplayText = endLocationDisplay ? `${endLocationDisplay}` : '--';

            return `
            <div class="activity-time-card">
                <div class="activity-timeline">
                    <div class="timeline-line"></div>
                    <div class="timeline-dot top"></div>
                    <div class="timeline-dot bottom"></div>
                </div>
                <div class="activity-time-content">
                    <div class="element-time-location-group">
                        <div class="element-time">${startDateTimeText}</div>
                        <div class="element-location">${startLocationDisplayText}</div>
                    </div>
                    <div class="activity-main-info">
                        <div class="activity-title">${this.config.activityName}</div>
                        <div class="activity-duration-line">
                           ${durationDisplayHtml}
                           ${durationWarningHtml}
                        </div>
                    </div>
                    <div class="element-time-location-group">
                        <div class="element-time">${endDateTimeText}</div>
                        <div class="element-location">${endLocationDisplayText}</div>
                    </div>
                </div>
            </div>`;
        } catch (error) {
            console.error("Error getting activity time box HTML:", error);
            return `<div class="error-message">${this.t('errors.activityTimeError')}</div>`;
        }
    }

    async handleBuyTicketClick(event) {
        const button = event.target.closest('.ticket-button');
        if (!button) return;

        event.stopPropagation();
        this.clearMessages();

        const connType = button.dataset.connType;
        const connection = connType === 'to' ? this.state.selectedToConnection : this.state.selectedFromConnection;

        if (!connection) {
            console.error("No selected connection found to generate ticket link.");
            return;
        }

        const originalContent = button.innerHTML;
        button.innerHTML = `<span class="loading-spinner-small"></span>`;
        button.disabled = true;

        try {
            const response = await this._fetchApi(`${this.config.apiBaseUrl}/generate-ticketshop-link`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ connection_elements: connection.connection_elements })
            });

            const result = await response.json();
            if (result.ticketshop_url) {
                window.open(result.ticketshop_url, '_blank');
            } else {
                throw new Error('No ticketshop URL returned from the server.');
            }

        } catch (error) {
            if (error.isSessionExpired) return;
            console.error('Error fetching ticketshop link:', error);
            this.showError(error.message || this.t('errors.api.internalError'), 'results', true);
        } finally {
            button.innerHTML = originalContent;
            button.disabled = false;
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

            // The connection_elements array is now pre-filtered by _processAndFilterConnections.
            const filteredElements = conn.connection_elements;

            if (filteredElements.length === 0) { // If filtering removed all elements (edge case)
                return `<div>${this.t('noConnectionElements')}</div>`;
            }

            const isLive = conn.connection_elements && conn.connection_elements.length > 0 && conn.connection_elements.every(el => el.provider === 'live');
            const liveIndicatorHTML = isLive ? `<div class="live-indicator-details"><span class="live-dot"></span>${this.t('liveConnection')}</div>` : '';

            const ticketButtonHTML = conn.connection_ticketshop_provider ? `
            <button class="ticket-button" data-conn-type="${type}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 12.5C20 11.12 20.83 10 22 10V8C22 6.9 21.1 6 20 6H4C2.9 6 2 6.9 2 8V10C3.17 10 4 11.12 4 12.5C4 13.88 3.17 15 2 15V17C2 18.1 2.9 19 4 19H20C21.1 19 22 18.1 22 17V15C20.83 15 20 13.88 20 12.5ZM11.5 16H9.5V15H11.5V16ZM11.5 14H9.5V13H11.5V14ZM11.5 12H9.5V11H11.5V12ZM11.5 10H9.5V9H11.5V10ZM14.5 16H12.5V15H14.5V16ZM14.5 14H12.5V13H14.5V14ZM14.5 12H12.5V11H14.5V12ZM14.5 10H12.5V9H14.5V10Z"></path></svg>
                ${this.t('buyTicket')} (${conn.connection_ticketshop_provider})
            </button>
            ` : '';

            const headerDetailsHTML = (liveIndicatorHTML || ticketButtonHTML) ? `
            <div class="connection-details-header">
                ${liveIndicatorHTML}
                ${ticketButtonHTML}
            </div>
            ` : '';

            let
                html = `<div class="connection-details-wrapper">${headerDetailsHTML}<div class="connection-elements">`;

            // Display waiting time after activity ends (for 'from' connections)
            if (type === 'from' && this.state.activityTimes.end && filteredElements.length > 0) {
                const firstEffectiveLegDepartureISO = filteredElements[0].departure_time;
                const firstLegDepartureDateTime = DateTime.fromISO(firstEffectiveLegDepartureISO, {
                    zone: 'utc'
                }).setZone(this.config.timezone);

                // Construct activity end time, assuming it's on the same day as the return journey starts
                let
                    activityEndDateTime = DateTime.fromFormat(this.state.activityTimes.end, 'HH:mm', {
                        zone: this.config.timezone
                    })
                        .set({
                            year: firstLegDepartureDateTime.year,
                            month: firstLegDepartureDateTime.month,
                            day: firstLegDepartureDateTime.day
                        });

                if (activityEndDateTime > firstLegDepartureDateTime) {
                    activityEndDateTime = activityEndDateTime.minus({
                        days: 1
                    });
                }

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
                          <span class="element-icon" title="${this.t('waiting.title')}" alt="${this.t('waiting.title')}">${this.getTransportIcon('WAIT')}</span>
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

                const vehicleType = (element.type !== 'JNY') ? (element.type || 'DEFAULT') : (element.vehicle_type || 'DEFAULT');
                const icon = this.getTransportIcon(vehicleType);
                const transportName = this.getTransportName(vehicleType);

                // Date display logic
                let
                    dateDisplay = '';
                const departureDate = DateTime.fromISO(element.departure_time, {
                    zone: this.config.timezone
                }).startOf('day');
                const arrivalDate = DateTime.fromISO(element.arrival_time, {
                    zone: this.config.timezone
                }).startOf('day');

                let
                    datesToShow = [];
                // Show departure date for the first leg
                if (index === 0) {
                    datesToShow.push(formatLegDateForDisplay(element.departure_time, this.config.timezone, this.config.language));
                }
                // Show arrival date if it's on a new day
                if (arrivalDate > departureDate) {
                    const arrivalDateStr = formatLegDateForDisplay(element.arrival_time, this.config.timezone, this.config.language);
                    // Prevent showing the same date twice
                    if (!datesToShow.includes(arrivalDateStr)) {
                        datesToShow.push(arrivalDateStr);
                    }
                }

                if (datesToShow.length > 0) {
                    dateDisplay = `<span class="connection-leg-date-display">${datesToShow.join('<br>')}</span>`;
                }

                let
                    fromLocationDisplay = element.from_location;
                if (element.isOriginalFirst) {
                    if (type === "to") {
                        fromLocationDisplay = this.elements.originInput.value;
                    } else { // type === "from"
                        fromLocationDisplay = this.config.activityEndLocationDisplayName || this.config.activityEndLocation;
                    }
                }

                html += `
              <div class="connection-element">
                <div class="element-time-location-group">
                    <span class="element-time">${departureTime}</span>
                    <span class="element-location">${fromLocationDisplay}</span>
                    ${element.platform_orig ? `<span class="element-platform">${this.t("platform")} ${element.platform_orig}</span>` : ''}
                </div>
                <div id="eleCont" ${dateDisplay !== "" ? 'style="margin-right: 70px;"' : ''}>
                  <div class="element-circle"></div>
                  <span class="element-icon" title="${transportName}" alt="${transportName}">${icon}</span>
                  <span class="element-duration">${this.getDurationString(index, type, element, durationDisplayString, conn)}</span>
                </div>
                ${dateDisplay}
              </div>
            `;

                // After the last leg, display the final arrival.
                if (index === filteredElements.length - 1) {
                    let
                        toLocationDisplay = element.to_location;
                    if (element.isOriginalLast) {
                        if (type === "to") {
                            toLocationDisplay = this.config.activityStartLocationDisplayName || this.config.activityStartLocation;
                        } else { // type === "from"
                            toLocationDisplay = this.elements.originInput.value;
                        }
                    }

                    html += `
                <div class="connection-element">
                  <div class="element-time-location-group">
                    <span class="element-time">${arrivalTime}</span>
                    <span class="element-location">${toLocationDisplay}</span>
                    ${element.platform_dest ? `<span class="element-platform">${this.t('platform')} ${element.platform_dest}</span>` : ''}
                  </div>
                  <div class="element-circle"></div>
                </div>
              `;
                }
            });

            // Display waiting time before activity starts (for 'to' connections)
            if (type === 'to' && this.state.activityTimes.start && filteredElements.length > 0) {
                const lastLegArrivalTimeISO = filteredElements[filteredElements.length - 1].arrival_time;

                if (lastLegArrivalTimeISO) { // Ensure lastLegArrivalTimeISO is valid
                    const connectionEndDateTime = DateTime.fromISO(lastLegArrivalTimeISO, {zone: 'utc'}).setZone(this.config.timezone);
                    // Ensure activityActualStartDateTime is on the same day as connectionEndDateTime for correct diff
                    let activityActualStartDateTime = DateTime.fromFormat(this.state.activityTimes.start, 'HH:mm', {zone: this.config.timezone})
                        .set({
                            year: connectionEndDateTime.year,
                            month: connectionEndDateTime.month,
                            day: connectionEndDateTime.day
                        });

                    if (activityActualStartDateTime < connectionEndDateTime) {
                        activityActualStartDateTime = activityActualStartDateTime.plus({days: 1});
                    }

                    if (connectionEndDateTime.isValid && activityActualStartDateTime.isValid && activityActualStartDateTime > connectionEndDateTime) {
                        const waitDuration = calculateDurationLocalWithDates(connectionEndDateTime, activityActualStartDateTime, (key) => this.t(key));
                        if (waitDuration.totalMinutes > 0) { // Only show if there's actual waiting time
                            html += `
                          <div class="connection-element waiting-block">
                              <div class="element-time">
                              <span>${convertUTCToLocalTime(lastLegArrivalTimeISO, this.config.timezone)}</span>
                              ${this.t('waiting.beforeActivity')}
                              </div>
                              <div id="eleCont">
                              <span class="element-icon" title="${this.t('waiting.title')}" alt="${this.t('waiting.title')}">${this.getTransportIcon('WAIT')}</span>
                              <span class="element-duration">
                                  ${waitDuration.text}
                              </span>
                              </div>
                          </div>`;
                        }
                    }
                }
            }

            html += `</div></div>`;
            return html;
        }).join('');
    }

    getTransportName(type) {
        // Map API vehicle type IDs or string types to translation keys
        const vehicleName = this.t(`vehicles.${type}`);

        if (vehicleName && !vehicleName.startsWith('[vehicles.')) {
            return vehicleName;
        }

        // '20' is 'Miscellaneous' in the API doc.
        return this.t('vehicles.20');
    }

    getDurationString(index, type, element, duration, conn) {
        if (conn && conn.connection_anytime && element.type === "WALK") {
            const durationMinutes = conn.connection_elements[0].duration;
            const durationText = getTimeFormatFromMinutes(durationMinutes, (k) => this.t(k));
            if (type === 'to') {
                const leaveByTime = DateTime.fromFormat(
                    this.state.activityTimes.start,
                    'HH:mm',
                    {zone: this.config.timezone}
                ).minus({
                    minutes: durationMinutes
                }).toFormat('HH:mm');
                return `${durationText} - ${this.t('anytimeLeaveBy', { time: leaveByTime })}`;
            } else { // type === 'from'
                const destination = this.elements.originInput.value;
                return `${durationText} - ${this.t('anytimeWalkTo', { destination: destination })}`;
            }
        }

        let durationString = "";
        if (element.vehicle_name && element.type === "JNY") {
            let n_intermediate_stops = element.n_intermediate_stops + 1 || 0; // n_intermediate_stops seems to be exclusive of final stop
            const stopString = n_intermediate_stops !== 1 ? `, ${n_intermediate_stops} ${this.t("stopPl")})` : `, ${n_intermediate_stops} ${this.t("stopSg")})`;
            durationString = `${element.vehicle_name} -> ${element.direction} (${duration}`;
            durationString += (n_intermediate_stops > 0) ? `${stopString}` : `)`; // Only add stop string if stops > 0
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
            7: `<svg width="16" height="16" viewBox="0 0 512.000000 512.000000" preserveAspectRatio="xMidYMid meet" id="svg3" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg"><defs id="defs3"/><sodipodi:namedview id="namedview3" pagecolor="#ffffff" bordercolor="#34C759" borderopacity="0.25" inkscape:showpageshadow="2" inkscape:pageopacity="0.0" inkscape:pagecheckerboard="0" inkscape:deskcolor="#d1d1d1" inkscape:document-units="pt" inkscape:zoom="0.61319416" inkscape:cx="528.38076" inkscape:cy="500.65708" inkscape:window-width="1440" inkscape:window-height="830" inkscape:window-x="-6" inkscape:window-y="-6" inkscape:window-maximized="1" inkscape:current-layer="g3"/><g transform="translate(0.000000,512.000000) scale(0.100000,-0.100000)" fill="#34C759" stroke="#34C759" id="g3"><path d="M 2715,3925 C 1989,3785 1319,3657 1227,3639 l -168,-31 -60,-72 C 731,3221 531,2711 491,2245 c -16,-183 -15,-245 6,-245 13,0 357,66 1348,258 l 232.7027,43.9459 3,242 c 1,133 -7.4413,238.2229 -10.4413,238.2229 -4,0 -261.2614,-44.1688 -406.2614,-72.1688 -144,-27 -268,-50 -273,-50 -8,0 -10,120 -9,402 l 3,401 330,64 c 182,34 336,63 343,63 9,0 12,-135 12,-641 v -642 l 48,7 c 42,6 201,36 799,153 l 193,37 2,645 3,645 145,27 c 392,75 519,99 529,99 8,0 11,-117 11,-402 v -403 l -233,-43 c -127,-24 -253,-48 -279,-54 l -182.0541,-33.7838 v -240 -240 L 3268,2534 c 28.1639,5.1762 604,118 1067,207 143,28 268,53 278,55 15,5 17,18 17,99 0,107 -14,183 -71,378 -101,351 -250,677 -372,817 -49,56 -97,90 -126,89 -14,-1 -620,-115 -1346,-254 z m 1349,0 c 69,-92 170,-312 255,-559 23,-65 41,-124 41,-131 0,-8 -55,-23 -167,-44 -93,-18 -178,-35 -190,-38 l -23,-5 v 405 c 0,433 -2,409 42,416 4,0 23,-19 42,-44 z M 2940,3355 c 0,-223 -3,-405 -6,-405 -10,0 -648,-121 -666,-126 -17,-5 -18,19 -18,400 v 405 l 38,7 c 20,4 170,33 332,64 162,32 301,58 308,59 9,1 12,-86 12,-404 z M 1210,3027 v -403 l -222,-42 c -123,-24 -228,-42 -235,-42 -16,0 35,188 88,324 95,246 294,566 353,566 14,0 16,-39 16,-403 z" id="path1"/><path d="M2537 2260 c-1127 -219 -2050 -400 -2052 -402 -9 -9 18 -118 40 -164 31 -63 79 -108 155 -143 101 -47 71 -51 1725 268 831 161 1582 306 1670 323 218 41 288 70 388 157 81 72 167 239 167 326 0 30 -3 35 -22 34 -13 0 -945 -180 -2071 -399z" id="path2"/><path d="M4480 2046 c0 -68 -2 -74 -22 -79 -46 -11 -450 -87 -464 -87 -10 0 -14 14 -14 56 0 48 -2 55 -17 50 -10 -3 -48 -10 -85 -17 l-68 -11 0 -58 0 -57 -212 -41 c-117 -22 -230 -44 -250 -48 l-38 -6 0 57 c0 54 -1 57 -22 52 -13 -3 -51 -11 -85 -18 l-63 -12 0 -56 0 -57 -227 -43 c-126 -23 -236 -45 -245 -47 -16 -5 -18 2 -18 50 0 31 -4 56 -8 56 -12 0 -124 -20 -144 -26 -14 -4 -18 -17 -18 -59 0 -48 -3 -55 -22 -60 -13 -3 -125 -25 -250 -49 l-228 -43 0 54 c0 64 7 63 -147 28 -20 -5 -23 -12 -23 -59 l0 -55 -52 -10 c-124 -25 -424 -81 -435 -81 -9 0 -13 16 -13 50 0 58 -2 58 -105 37 l-60 -13 -3 -57 c-2 -31 -6 -57 -10 -57 -4 0 -113 -20 -242 -45 -129 -25 -236 -45 -237 -45 -2 0 -3 25 -3 55 l0 55 -85 0 -85 0 0 -205 c0 -133 4 -205 10 -205 6 0 554 104 1218 231 664 126 1477 282 1807 345 330 63 695 132 810 154 116 23 234 45 263 51 l52 10 0 195 0 194 -80 0 -80 0 0 -74z" id="path3"/></g></svg>`,
            8: `<svg width="16" height="16" viewBox="0 0 330 330" fill="#34C759" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xml:space="preserve"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path id="XMLID_28_" d="M315,10H15C6.716,10,0,16.716,0,25s6.716,15,15,15h116.557L85.403,140H55 c-7.643,0-14.064,5.747-14.908,13.344l-10,90c-0.016,0.145-0.013,0.289-0.025,0.434c-0.021,0.262-0.038,0.523-0.045,0.786 c-0.008,0.278-0.006,0.556,0.001,0.833c0.007,0.254,0.017,0.507,0.037,0.761c0.022,0.288,0.056,0.571,0.095,0.857 c0.021,0.15,0.025,0.302,0.05,0.452l10,60C41.41,314.699,47.667,320,55,320h220c7.332,0,13.59-5.301,14.796-12.534l10-60 c0.025-0.15,0.03-0.302,0.05-0.452c0.039-0.285,0.073-0.568,0.095-0.857c0.02-0.254,0.03-0.507,0.037-0.761 c0.007-0.277,0.009-0.555,0.001-0.833c-0.008-0.263-0.024-0.524-0.045-0.786c-0.012-0.145-0.009-0.289-0.025-0.434l-10-90 C289.064,145.747,282.643,140,275,140h-30.409L198.442,40H315c8.284,0,15-6.716,15-15S323.284,10,315,10z M140,230v-60h50v60H140z M68.426,170h26.492c0.024,0,0.049,0.004,0.073,0.004c0.037,0,0.073-0.004,0.11-0.004H110v60H61.759L68.426,170z M262.293,290 H67.707l-5-30h204.586L262.293,290z M268.241,230H220v-60h14.515c0.165,0.006,0.329,0.018,0.495,0.018c0.11,0,0.22-0.016,0.33-0.018 h26.235L268.241,230z M211.551,140h-93.108l46.154-100h0.805L211.551,140z"></path> </g></svg>`,
            9: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M4 17.5L3 12L12 9L21 12L20 17.5M5 11.3333V7C5 5.89543 5.89543 5 7 5H17C18.1046 5 19 5.89543 19 7V11.3333M10 5V3C10 2.44772 10.4477 2 11 2H13C13.5523 2 14 2.44772 14 3V5M2 21C3 22 6 22 8 20C10 22 14 22 16 20C18 22 21 22 22 21" stroke="#34C759" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>`,
            10: `<svg width="16" height="16" viewBox="0 0 512 512" fill="#34C759" id="_x32_" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" stroke="#34C759"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <style type="text/css">  .st0{fill:#34C759;}  </style> <g> <path class="st0" d="M492.797,262.25h-22.109c-10.563,0-23.313-7.594-28.375-16.875l-36.406-67.094 c-5.031-9.281-17.813-16.891-28.375-16.891H206.625c-10.563,0-24.5,6.828-30.953,15.203l-54.328,70.438 c-6.469,8.375-20.391,15.219-30.938,15.219H60.531c-33.313,0-53.813,15.875-58.609,47.906L0,343.891 c0,10.578,8.656,19.234,19.219,19.234H66.5c2.344,26.969,25.031,48.188,52.625,48.188c27.563,0,50.266-21.219,52.609-48.188 h186.172c2.313,23.813,22.406,42.438,46.844,42.438s44.531-18.625,46.844-42.438h41.203c10.547,0,19.203-8.656,19.203-19.234 v-62.422C512,270.891,503.344,262.25,492.797,262.25z M119.125,382.031c-13,0-23.547-10.531-23.547-23.531 s10.547-23.531,23.547-23.531s23.531,10.531,23.531,23.531S132.125,382.031,119.125,382.031z M291.063,261.375H152.125l7.219-9.375 l44.375-57.531c3.031-3.906,11.453-8.063,16.406-8.063h70.938V261.375z M314.125,261.375v-74.969h53.844 c4.031,0,10.578,3.906,12.516,7.469l34.594,67.5H314.125z M404.75,382.031c-13,0-23.531-10.531-23.531-23.531 s10.531-23.531,23.531-23.531s23.531,10.531,23.531,23.531S417.75,382.031,404.75,382.031z"></path> <path class="st0" d="M225.859,122.844c0.016-6.219,5.063-11.281,11.281-11.281h105.25c6.234,0,11.297,5.063,11.297,11.281v30.5 h10.875v-30.5c0-12.234-9.922-22.156-22.172-22.156h-105.25c-12.234,0-22.156,9.922-22.172,22.156v30.5h10.891V122.844z"></path> <path class="st0" d="M249.188,149.938h5.531c0.266,0,0.438-0.156,0.438-0.406v-22.297c0-0.172,0.078-0.234,0.25-0.234h7.484 c0.266,0,0.422-0.188,0.422-0.438v-4.625c0-0.25-0.156-0.438-0.422-0.438h-21.859c-0.281,0-0.438,0.188-0.438,0.438v4.625 c0,0.25,0.156,0.438,0.438,0.438h7.469c0.172,0,0.266,0.063,0.266,0.234v22.297C248.766,149.781,248.938,149.938,249.188,149.938z"></path> <path class="st0" d="M275.422,121.5c-0.313,0-0.484,0.188-0.563,0.438l-10.172,27.594c-0.094,0.25,0,0.406,0.297,0.406h5.703 c0.281,0,0.469-0.125,0.563-0.406l1.656-5h10.344l1.688,5c0.094,0.281,0.266,0.406,0.578,0.406h5.641 c0.313,0,0.391-0.156,0.313-0.406l-10-27.594c-0.094-0.25-0.266-0.438-0.563-0.438H275.422z M281.516,139.313h-6.828l3.344-9.938 h0.125L281.516,139.313z"></path> <path class="st0" d="M295.516,149.938h6.016c0.375,0,0.563-0.125,0.734-0.406l5.297-8.656h0.125l5.266,8.656 c0.172,0.281,0.359,0.406,0.734,0.406h6.063c0.281,0,0.375-0.25,0.25-0.5l-8.875-14.172L319.391,122 c0.125-0.25,0.031-0.5-0.266-0.5h-6.031c-0.359,0-0.531,0.125-0.719,0.438l-4.688,7.688h-0.125l-4.688-7.688 c-0.188-0.313-0.359-0.438-0.719-0.438h-6.031c-0.313,0-0.391,0.25-0.25,0.5l8.219,13.266l-8.828,14.172 C295.094,149.688,295.219,149.938,295.516,149.938z"></path> <path class="st0" d="M326.875,121.938v27.594c0,0.25,0.188,0.406,0.438,0.406h5.531c0.25,0,0.438-0.156,0.438-0.406v-27.594 c0-0.25-0.188-0.438-0.438-0.438h-5.531C327.063,121.5,326.875,121.688,326.875,121.938z"></path> </g> </g></svg>`,
            20: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
            30: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
            31: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#000000"  xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M7.97,2.242l-5,20A1,1,0,0,1,2,23a1.025,1.025,0,0,1-.244-.03,1,1,0,0,1-.727-1.212l5-20a1,1,0,1,1,1.94.484Zm10-.484a1,1,0,1,0-1.94.484l5,20A1,1,0,0,0,22,23a1.017,1.017,0,0,0,.243-.03,1,1,0,0,0,.728-1.212ZM12,1a1,1,0,0,0-1,1V6a1,1,0,0,0,2,0V2A1,1,0,0,0,12,1Zm0,7.912a1,1,0,0,0-1,1v4.176a1,1,0,1,0,2,0V9.912A1,1,0,0,0,12,8.912ZM12,17a1,1,0,0,0-1,1v4a1,1,0,0,0,2,0V18A1,1,0,0,0,12,17Z"></path></g></svg>`,
            32: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
            33: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M9 5.25C7.03323 5.25 5.25 7.15209 5.25 9.75C5.25 12.0121 6.60204 13.7467 8.25001 14.1573V10.9014L6.33398 9.62405L7.16603 8.37597L8.792 9.45995L9.87597 7.83398L11.124 8.66603L9.75001 10.7271V14.1573C11.398 13.7467 12.75 12.0121 12.75 9.75C12.75 7.15209 10.9668 5.25 9 5.25ZM3.75 9.75C3.75 12.6785 5.62993 15.2704 8.25001 15.6906V19.5H3V21H21V19.5H18.75V18L18 17.25H12L11.25 18V19.5H9.75001V15.6906C12.3701 15.2704 14.25 12.6785 14.25 9.75C14.25 6.54892 12.0038 3.75 9 3.75C5.99621 3.75 3.75 6.54892 3.75 9.75ZM12.75 19.5H17.25V18.75H12.75V19.5Z" fill="#000"></path> </g></svg>`,
            ACTIVITY: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 4.00195H8C5.79086 4.00195 4 5.79281 4 8.00195V16.002C4 18.2111 5.79086 20.002 8 20.002H16C18.2091 20.002 20 18.2111 20 16.002V8.00195C20 5.79281 18.2091 4.00195 16 4.00195Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 12.002L14.4 10.802M12 12.002V15.002M12 12.002L9.6 10.802M12 12.002L14.4 13.202M12 12.002L9.6 13.202" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
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
            const walk = (x - startX) * 1.5; // Multiplier for faster swipe
            slider.scrollLeft = scrollLeft - walk;
        };

        // Mouse events
        slider.addEventListener('mousedown', (e) => handleStart(e.pageX));
        slider.addEventListener('mouseleave', handleEnd);
        slider.addEventListener('mouseup', handleEnd);
        slider.addEventListener('mousemove', (e) => {
            e.preventDefault(); // Prevent text selection during drag
            handleMove(e.pageX);
        });

        // Touch events
        slider.addEventListener('touchstart', (e) => handleStart(e.touches[0].pageX), {passive: true});
        slider.addEventListener('touchend', handleEnd);
        slider.addEventListener('touchcancel', handleEnd);
        slider.addEventListener('touchmove', (e) => {
            // e.preventDefault(); // Can cause issues on some browsers if not needed for scroll prevention on page
            handleMove(e.touches[0].pageX);
        }, {passive: false}); // passive: false if you need to preventDefault inside handleMove
    }

    navigateToResults() {
        this.clearMessages();
        if (this.pageManager) {
            this.pageManager.navigateToResults();
        }
    }

    slideToRecommendedConnections() {
        requestAnimationFrame(() => {
            if (this.elements.activityTimeBox) {
                this.elements.activityTimeBox.scrollIntoView({behavior: 'smooth', block: 'center'});
            }

            const topSlider = this.elements["topSlider"];
            if (topSlider && topSlider.querySelector('.active-time')) {
                const topActiveBtn = topSlider.querySelector('.active-time');
                const scrollPos = topActiveBtn.offsetLeft - (topSlider.offsetWidth / 2) + (topActiveBtn.offsetWidth / 2);
                topSlider.scrollTo({left: scrollPos, behavior: 'smooth'});
            }

            const bottomSlider = this.elements["bottomSlider"];
            if (bottomSlider && bottomSlider.querySelector('.active-time')) {
                const bottomActiveBtn = bottomSlider.querySelector('.active-time');
                const scrollPos = bottomActiveBtn.offsetLeft - (bottomSlider.offsetWidth / 2) + (bottomActiveBtn.offsetWidth / 2);
                bottomSlider.scrollTo({left: scrollPos, behavior: 'smooth'});
            }
        });
    }

    navigateToForm() {
        this.clearMessages();
        if (this.pageManager) {
            this.pageManager.navigateToForm();
        }
        this.state.toConnections = [];
        this.state.fromConnections = [];
        this.state.activityTimes = {start: '', end: '', duration: '', warning_duration: false};

        // Reset collapsible states when going back to form
        if (this.elements.collapsibleToActivity) this.elements.collapsibleToActivity.classList.remove('expanded');
        if (this.elements.collapsibleFromActivity) this.elements.collapsibleFromActivity.classList.remove('expanded');
    }

    async handleShare() {
        this.clearMessages();

        try {
            const dataToShare = {
                origin: this.elements.originInput.value,
                origin_lat: this.elements.originInput.dataset.lat || null,
                origin_lon: this.elements.originInput.dataset.lon || null,
                date: formatDatetime(this.state.selectedDate, this.config.timezone), // yyyy-MM-dd
                dateEnd: this.config.multiday ? formatDatetime(this.state.selectedEndDate, this.config.timezone) : null,
                to_connection_start_time: this.state.selectedToConnection ? this.state.selectedToConnection.connection_start_timestamp : null,
                to_connection_end_time: this.state.selectedToConnection ? this.state.selectedToConnection.connection_end_timestamp : null,
                from_connection_start_time: this.state.selectedFromConnection ? this.state.selectedFromConnection.connection_start_timestamp : null,
                from_connection_end_time: this.state.selectedFromConnection ? this.state.selectedFromConnection.connection_end_timestamp : null,
                shareURLPrefix: this.config.shareURLPrefix,
            };

            const response = await this._fetchApi(`${this.config.apiBaseUrl}/share/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToShare)
            });

            const result = await response.json();
            const shareId = result.shareId;
            if (!shareId) {
                throw new Error(this.t('errors.shareLinkCreateFailed'));
            }

            let url = new URL(this.config.shareURLPrefix);
            url.searchParams.set('diana-share', shareId);

            if (navigator.share) {
                await navigator.share({
                    title: this.config.activityName,
                    url: url.toString(),
                });
            } else if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url.toString());
                this.showInfo(this.t('shareUrlCopied'));
            } else {
                // Fallback for older browsers
                const textArea = document.createElement("textarea");
                textArea.value = url.toString();
                textArea.style.position = 'fixed';
                textArea.style.top = '-9999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    const successful = document.execCommand('copy');
                    if (successful) {
                        this.showInfo(this.t('shareUrlCopied'));
                    } else {
                        throw new Error('execCommand failed');
                    }
                } finally {
                    document.body.removeChild(textArea);
                }
            }
        } catch (error) {
            if (error.isSessionExpired) return;
            console.error("Share failed:", error);
            if (error.name !== 'AbortError') {
                this.showError(this.t('shareUrlCopyFailed'), 'results', true);
            }
        }
    }

    async _loadFromShareID(shareId) {
        await this.initDOM();
        this.setLoadingState(true, true);
        const currentUrl = new URL(window.location.href);

        try {
            const response = await this._fetchApi(`${this.config.apiBaseUrl}/share/${shareId}/`);

            if (!response.ok) { // This check is redundant now but kept for safety
                this.setLoadingState(false, true);
                this.showInfo(this.t('errors.shareLinkInvalidExpired'));
                currentUrl.searchParams.delete('diana-share');
                window.history.replaceState(null, '', currentUrl.toString());
                return;
            }

            const data = await response.json();

            // Pre-fill origin input
            if (this.elements.originInput) {
                this.elements.originInput.value = data.origin;
                if (data.origin_lat && data.origin_lon) {
                    this.elements.originInput.setAttribute('data-lat', data.origin_lat.toString());
                    this.elements.originInput.setAttribute('data-lon', data.origin_lon.toString());
                }
                if (this.elements.clearInputBtn && this.elements.currentLocationBtn) {
                    if (data.origin) {
                        this.elements.clearInputBtn.style.display = 'block';
                        this.elements.currentLocationBtn.style.display = 'none';
                    }
                }
            }

            // Validate dates
            const sharedDate = DateTime.fromISO(data.date).startOf('day');
            const sharedDateEnd = data.dateEnd ? DateTime.fromISO(data.dateEnd).startOf('day') : null;
            const today = DateTime.now().setZone(this.config.timezone).startOf('day');

            if (!sharedDate.isValid || sharedDate < today) {
                this.setLoadingState(false, true);
                this.showInfo(this.t('infos.sharedDateInPast'));
                currentUrl.searchParams.delete('diana-share');
                window.history.replaceState(null, '', currentUrl.toString());
                return;
            }

            if (this.config.multiday) {
                if (sharedDateEnd && (!sharedDateEnd.isValid || sharedDateEnd < today)) {
                    this.setLoadingState(false, true);
                    this.showInfo(this.t('infos.sharedDateInPast'));
                    currentUrl.searchParams.delete('diana-share');
                    window.history.replaceState(null, '', currentUrl.toString());
                    return;
                }

                // Check if activityDurationDaysFixed is set and if dates are valid
                if (this.config.activityDurationDaysFixed && sharedDateEnd && sharedDateEnd.diff(sharedDate, 'days').days !== this.config.activityDurationDaysFixed - 1) {
                    this.setLoadingState(false, true);
                    this.showInfo(this.t('infos.sharedDateDurationMismatch'));
                    currentUrl.searchParams.delete('diana-share');
                    window.history.replaceState(null, '', currentUrl.toString());
                    return;
                }

                this.state.selectedDate = sharedDate.toJSDate();
                this.state.selectedEndDate = sharedDateEnd ? sharedDateEnd.toJSDate() : null;

                if (this.elements.activityDateStart && this.state.selectedDate) {
                    this.elements.activityDateStart.value = formatDatetime(this.state.selectedDate, this.config.timezone);
                }
                if (this.elements.activityDateEnd && this.state.selectedEndDate) {
                    this.elements.activityDateEnd.value = formatDatetime(this.state.selectedEndDate, this.config.timezone);
                }

                this.updateDateDisplay(this.state.selectedDate, 'dateDisplayStart');
                this.updateDateDisplay(this.state.selectedEndDate, 'dateDisplayEnd');
            } else {
                // Date is valid, proceed with auto-search
                this.state.selectedDate = sharedDate.toJSDate();
                this._updateSingleDayDateButtonStates();
            }

            this.state.preselectTimes = {
                to_start: data.to_connection_start_time,
                to_end: data.to_connection_end_time,
                from_start: data.from_connection_start_time,
                from_end: data.from_connection_end_time,
            };

            this.setLoadingState(false, true);
            await this.handleSearch();

        } catch (error) {
            if (error.isSessionExpired) return;
            console.error("Failed to load data from shareID:", error);
            this.setLoadingState(false, true);
            this._showFatalError(this.t('errors.shareLinkErrorTitle'), error.message, "info", true);
        }
    }


    showMenuModal() {
        if (this.elements.menuModalOverlay) {
            this.elements.menuModalOverlay.style.display = 'flex';
            // Use requestAnimationFrame to ensure the display property has been applied before adding the class for transition
            requestAnimationFrame(() => {
                this.elements.menuModalOverlay.classList.add('visible');
            });
        }
    }

    hideMenuModal() {
        const overlay = this.elements.menuModalOverlay;
        if (overlay) {
            overlay.classList.remove('visible');
            // Wait for the transition to finish before setting display to none
            const handleTransitionEnd = () => {
                overlay.style.display = 'none';
                overlay.removeEventListener('transitionend', handleTransitionEnd);
            };
            overlay.addEventListener('transitionend', handleTransitionEnd);
        }
    }

    handleMenuSelection(menuItem) {
        if (menuItem && menuItem.dataset.contentKey) {
            this.hideMenuModal();
            // Use a timeout to allow the hide transition to start before navigating
            setTimeout(() => {
                this.navigateToContentPage(menuItem.dataset.contentKey);
            }, 50);
        }
    }

    navigateToContentPage(contentKey) {
        this.clearMessages();
        this.state.currentContentKey = contentKey;
        // Close all dropdowns before navigating
        [this.elements.formMenuDropdown, this.elements.resultsMenuDropdown, this.elements.contentMenuDropdown].forEach(d => {
            if (d) d.style.display = 'none';
        });

        if (this.pageManager) {
            this.pageManager.navigateToContentPage();
        }
        this.renderContentPage(); // Method to render the actual content
    }

    renderContentPage() {
        if (!this.elements.contentPageTitle || !this.elements.contentPageBody) return;

        let title;
        let contentHTML;

        // Get the current language, fallback to EN if not supported
        const language = this.config.language && (helpContent[this.config.language] || legalContent[this.config.language])
            ? this.config.language
            : 'EN';

        switch (this.state.currentContentKey) {
            case 'help':
                title = this.t('menu.helpAndSupport');
                contentHTML = helpContent[language];
                break;
            case 'legal':
                title = this.t('menu.legal');
                contentHTML = legalContent[language];
                break;
            default:
                title = this.t('content.defaultTitle');
                contentHTML = `<p>${this.t('content.defaultText')}</p>`;
        }

        this.elements.contentPageTitle.textContent = title;
        this.elements.contentPageBody.innerHTML = contentHTML;
    }

    closeMenuOrContentPage() {
        this.clearMessages();
        if (this.pageManager) {
            this.pageManager.returnToActivePage();
        }
        this.state.currentContentKey = null;
    }


    setLoadingState(isLoading, isFullScreen = false) {
        if (isFullScreen) {
            let loader = this.dianaWidgetRootContainer.querySelector('.full-screen-loader');
            if (isLoading) {
                if (!loader) {
                    loader = document.createElement('div');
                    loader.className = 'full-screen-loader';
                    loader.innerHTML = `
                        <div class="loading-spinner"></div>
                        <span>${this.t("loadingStateSearching")}</span>
                    `;
                    this.dianaWidgetRootContainer.appendChild(loader);
                }
                loader.style.display = 'flex';
            } else {
                if (loader) {
                    loader.style.display = 'none';
                }
            }
            return;
        }

        this.state.loading = isLoading;
        if (this.elements.searchBtn) {
            this.elements.searchBtn.disabled = isLoading;
            this.elements.searchBtn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
        }
        if (this.elements.originInput) this.elements.originInput.disabled = isLoading;


        if (this.loadingTextTimeout1) {
            clearTimeout(this.loadingTextTimeout1);
            this.loadingTextTimeout1 = null;
        }
        if (this.loadingTextTimeout2) {
            clearTimeout(this.loadingTextTimeout2);
            this.loadingTextTimeout2 = null;
        }

        if (isLoading) {
            if (this.elements.searchBtn) this.elements.searchBtn.innerHTML = `<span class="loading-spinner"></span> ${this.t("loadingStateToActivity")}`;


            this.loadingTextTimeout1 = setTimeout(() => {
                if (this.state.loading && this.elements.searchBtn) {
                    this.elements.searchBtn.innerHTML = `<span class="loading-spinner"></span> ${this.t("loadingStateFromActivity")}`;

                    this.loadingTextTimeout2 = setTimeout(() => {
                        if (this.state.loading && this.elements.searchBtn) {
                            this.elements.searchBtn.innerHTML = `<span class="loading-spinner"></span> ${this.t("loadingStateSearching")}`;
                        }
                    }, 1800);
                }
            }, 1300);
        } else {
            if (this.elements.searchBtn) this.elements.searchBtn.innerHTML = this.t('search');
        }
    }

    /**
     * Displays a full-widget message, used for fatal errors or states
     * where the main UI cannot be rendered.
     * @param {string} title The title of the message.
     * @param {string} message The main body text of the message.
     * @param {string} type 'error' or 'info' for styling.
     * @param {boolean} isShareError If true, there is a reload page button.
     */
    _showFatalError(title, message, type = 'error', isShareError = false) {
        if (!this.shadowRoot) {
            console.error("Cannot show fatal error because shadowRoot is not available.");
            if (this.container) {
                this.container.innerHTML = `<div><h3>${title}</h3><div>${message}</div></div>`;
            }
            return;
        }

        // Always clear shadow root and set up container + styles for a fatal error
        this.shadowRoot.innerHTML = '';

        const styleTag = document.createElement('style');
        styleTag.textContent = styles; // Assuming `styles` is available from import
        this.shadowRoot.appendChild(styleTag);

        this.dianaWidgetRootContainer = document.createElement('div');
        this.dianaWidgetRootContainer.className = 'diana-container';
        this.shadowRoot.appendChild(this.dianaWidgetRootContainer);
        this._applyExternalStyles();

        const boxClass = type === 'info' ? 'fatal-info-box' : 'fatal-error-box';
        const titleClass = type === 'info' ? 'title-info' : 'title-error';

        let reloadButtonHTML = '';
        if (isShareError) {
            reloadButtonHTML = `
              <p style="margin-top: 20px;">
                <a href="#" id="reload-share-error-link" class="share-error-reload-link">${this.t('reloadPage')}</a>
              </p>
            `;
        }

        const messageHTML = message.trim().startsWith('<') ? message : `<p>${message}</p>`;

        const fallbackHTML = `
          <div class="${boxClass}">
            <h3 class="${titleClass}">${title}</h3>
            ${messageHTML}
            ${reloadButtonHTML}
          </div>
        `;
        this.dianaWidgetRootContainer.innerHTML = fallbackHTML;

        if (isShareError) {
            const reloadLink = this.dianaWidgetRootContainer.querySelector('#reload-share-error-link');
            if (reloadLink) {
                reloadLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    const currentUrl = new URL(window.location.href);
                    currentUrl.searchParams.delete('diana-share');
                    window.location.href = currentUrl.toString();
                });
            }
        }
    }

    showError(message, page = 'form', preserveContent = false, rawError = null) {
        this.state.error = message;
        const errorContainer = page === 'form' ? this.elements.formErrorContainer : this.elements.resultsErrorContainer;
        const debugContainer = page === 'form' ? this.elements.formDebugContainer : this.elements.resultsDebugContainer;

        if (errorContainer) {
            errorContainer.textContent = message;
            errorContainer.style.display = message ? "block" : "none";
            errorContainer.setAttribute('role', message ? 'alert' : null);
        }

        if (debugContainer) {
            if (this.config.dev && rawError) {
                debugContainer.style.display = 'block';
                const clonedError = rawError.clone();
                clonedError.json().then(json => {
                    debugContainer.innerHTML = `
                        <div class="debug-toggle">${this.t('debug.showDetails')}</div>
                        <div class="debug-content" style="display:none;">
                            <pre>${JSON.stringify(json, null, 2)}</pre>
                        </div>`;
                    debugContainer.querySelector('.debug-toggle').addEventListener('click', (e) => {
                        const content = e.target.nextElementSibling;
                        const isVisible = content.style.display === 'block';
                        content.style.display = isVisible ? 'none' : 'block';
                        e.target.textContent = isVisible ? this.t('debug.showDetails') : this.t('debug.hideDetails');
                    });
                }).catch(() => {
                    clonedError.text().then(text => {
                        debugContainer.innerHTML = `
                        <div class="debug-toggle">${this.t('debug.showDetails')}</div>
                        <div class="debug-content" style="display:none;">
                            <pre>${text}</pre>
                        </div>`;
                        debugContainer.querySelector('.debug-toggle').addEventListener('click', (e) => {
                            const content = e.target.nextElementSibling;
                            const isVisible = content.style.display === 'block';
                            content.style.display = isVisible ? 'none' : 'block';
                            e.target.textContent = isVisible ? this.t('debug.showDetails') : this.t('debug.hideDetails');
                        });
                    });
                });
            } else {
                debugContainer.innerHTML = '';
                debugContainer.style.display = 'none';
            }
        }

        if (message) {
            console.error(`Widget Error: ${message}`);
            // Only clear content if the flag is not set
            if (page === 'results' && !preserveContent && this.elements.resultsPage?.classList.contains('active')) {
                if (this.elements.responseBox) this.elements.responseBox.innerHTML = '';
                if (this.elements.responseBoxBottom) this.elements.responseBoxBottom.innerHTML = '';
                if (this.elements.activityTimeBox) this.elements.activityTimeBox.innerHTML = '';
                if (this.elements.topSlider) this.elements.topSlider.innerHTML = '';
                if (this.elements.bottomSlider) this.elements.bottomSlider.innerHTML = '';
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
        if (this.elements.dateSelect) {
            return;
        }

        const datesFullyDetermined = this.config.multiday && this.config.activityDurationDaysFixed && (this.config.overrideActivityStartDate || this.config.overrideActivityEndDate);

        if (this.config.multiday) {
            if (!this.rangeCalendarModal) {
                this.rangeCalendarModal = new RangeCalendarModal(
                    this.state.selectedDate, this.state.selectedEndDate, this,
                    (startDate, endDate) => {
                        this.state.selectedDate = startDate;
                        this.state.selectedEndDate = endDate;
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
                if (window.matchMedia("(max-width: 768px)").matches && e.target.closest('.date-input-container')) {
                    const nativeInput = e.target.closest('.date-input-container').querySelector('input[type="date"]');
                    if (nativeInput) {
                        return; // Let native picker proceed
                    }
                }
                // Prevent default if the click was on the container but not the native input, to show custom calendar
                if (e.target.closest('.date-input-container') && e.target.tagName !== 'INPUT') {
                    e.preventDefault();
                }
                this.rangeCalendarModal.show(this.state.selectedDate, this.state.selectedEndDate);
            };


            if (!datesFullyDetermined) {
                if (!this.config.overrideActivityStartDate && this.elements.activityDateStart) {
                    const sDIC = this.elements.activityDateStart.closest('.date-input-container');
                    if (sDIC) sDIC.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showRangeCalendar(e);
                    });
                }
                if (!this.config.overrideActivityEndDate && this.elements.activityDateEnd) {
                    const eDIC = this.elements.activityDateEnd.closest('.date-input-container');
                    if (eDIC) eDIC.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showRangeCalendar(e);
                    });
                }
            }
            if (this.elements.activityDateStart) {
                this.elements.activityDateStart.addEventListener('change', (e) => {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    const nSD = new Date(Date.UTC(y, m - 1, d));
                    this.state.selectedDate = nSD;
                    this.updateDateDisplay(nSD, 'dateDisplayStart');
                    if (this.config.activityDurationDaysFixed) {
                        this.state.selectedEndDate = DateTime.fromJSDate(nSD).plus({days: this.config.activityDurationDaysFixed - 1}).toJSDate();
                        if (this.elements.activityDateEnd) this.elements.activityDateEnd.value = formatDatetime(this.state.selectedEndDate);
                        this.updateDateDisplay(this.state.selectedEndDate, 'dateDisplayEnd');
                    } else if (this.state.selectedEndDate && nSD > this.state.selectedEndDate) {
                        this.state.selectedEndDate = new Date(nSD.valueOf());
                        if (this.elements.activityDateEnd) this.elements.activityDateEnd.value = formatDatetime(this.state.selectedEndDate);
                        this.updateDateDisplay(this.state.selectedEndDate, 'dateDisplayEnd');
                    }
                    this.clearMessages();
                });
            }
            if (this.elements.activityDateEnd) {
                this.elements.activityDateEnd.addEventListener('change', (e) => {
                    if (this.config.activityDurationDaysFixed) return; // End date is fixed relative to start
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    const nED = new Date(Date.UTC(y, m - 1, d));
                    this.state.selectedEndDate = nED;
                    this.updateDateDisplay(nED, 'dateDisplayEnd');
                    if (this.state.selectedDate && nED < this.state.selectedDate) { // If new end date is before start date
                        this.state.selectedDate = new Date(nED.valueOf()); // Adjust start date to be same as end date
                        if (this.elements.activityDateStart) this.elements.activityDateStart.value = formatDatetime(this.state.selectedDate);
                        this.updateDateDisplay(this.state.selectedDate, 'dateDisplayStart');
                    }
                    this.clearMessages();
                    if (DateTime.fromJSDate(this.state.selectedEndDate).startOf('day') < DateTime.fromJSDate(this.state.selectedDate).startOf('day')) this.showInfo(this.t('infos.endDateAfterStartDate'));
                });
            }


            if (this.config.overrideActivityStartDate && this.elements.dateDisplayStart) this.updateDateDisplay(this.state.selectedDate, 'dateDisplayStart');
            if (this.config.overrideActivityEndDate && this.elements.dateDisplayEnd) this.updateDateDisplay(this.state.selectedEndDate, 'dateDisplayEnd');

            if (datesFullyDetermined) {
                if (this.elements.dateDisplayStart) this.updateDateDisplay(this.state.selectedDate, 'dateDisplayStart');
                if (this.elements.dateDisplayEnd) this.updateDateDisplay(this.state.selectedEndDate, 'dateDisplayEnd');
            }


        } else { // Single day
            if (!this.config.overrideActivityStartDate && this.elements.activityDate && this.elements.otherDateText && this.elements.dateBtnOther && this.elements.dateSelectorButtonsGroup) {
                const dateInputElement = this.elements.activityDate;
                const otherDateTextElement = this.elements.otherDateText;
                const otherDateButtonElement = this.elements.dateBtnOther;
                const dateButtonsGroupElement = this.elements.dateSelectorButtonsGroup;

                if (!this.singleCalendarInstance) {
                    this.singleCalendarInstance = new SingleCalendar(
                        dateInputElement,
                        otherDateTextElement,
                        this.state.selectedDate,
                        this,
                        (newDate) => { // Calendar onDateSelectCallback
                            this.onDateSelectedByButton(newDate);
                        },
                        otherDateButtonElement,
                        dateButtonsGroupElement,
                        styles
                    );
                }

                this.elements.dateBtnToday?.addEventListener('click', () => {
                    const today_object = DateTime.now().setZone(this.config.timezone).startOf('day').toObject();
                    const today = new Date(today_object.year, today_object.month - 1, today_object.day);
                    this.onDateSelectedByButton(today);
                });

                this.elements.dateBtnTomorrow?.addEventListener('click', () => {
                    const tomorrow_object = DateTime.now().setZone(this.config.timezone).plus({days: 1}).startOf('day').toObject();
                    const tomorrow = new Date(tomorrow_object.year, tomorrow_object.month - 1, tomorrow_object.day);
                    this.onDateSelectedByButton(tomorrow);
                });


                otherDateButtonElement.addEventListener('click', (e) => {
                    if (window.matchMedia("(max-width: 768px)").matches) {
                        e.stopPropagation();
                        if (this.elements.activityDate) {
                            try {
                                if (typeof this.elements.activityDate.showPicker === 'function') {
                                    this.elements.activityDate.showPicker();
                                } else {
                                    this.elements.activityDate.focus(); // Fallback for browsers not supporting showPicker
                                }
                            } catch (err) {
                                console.warn("Error trying to show native date picker:", err);
                                this.elements.activityDate.focus(); // Fallback
                            }
                        }
                    }
                });


                if (this.elements.activityDate) {
                    this.elements.activityDate.addEventListener('change', (e) => {
                        if (e.target.value) {
                            const [year, month, day] = e.target.value.split('-').map(Number);
                            const newSelectedDate = new Date(Date.UTC(year, month - 1, day));
                            this.onDateSelectedByButton(newSelectedDate);

                            if (this.singleCalendarInstance) {
                                this.singleCalendarInstance.setSelectedDate(newSelectedDate, false);
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

    updateDateDisplay(date, displayElementId) {
        const displayElement = this.elements[displayElementId];
        if (!displayElement) return;

        const localeMap = {EN: 'en-GB', DE: 'de-DE', FR: 'fr-FR', IT: 'it-IT', TH: 'th-TH', ES: 'es-ES'};
        const locale = localeMap[this.config.language] || (this.config.language ? `${this.config.language.toLowerCase()}-${this.config.language.toUpperCase()}` : 'en-GB');
        if (date && !isNaN(date.getTime())) {
            displayElement.textContent = formatDateForDisplay(date, locale, this.config.timezone);
            displayElement.classList.remove("placeholder");
        } else {
            displayElement.textContent = this.t('selectDate'); // Fallback or placeholder text
            displayElement.classList.add("placeholder");
        }
    }

    onDateSelectedByButton(date) {
        this.state.selectedDate = date;
        if (this.elements.activityDate) {
            this.elements.activityDate.value = formatDatetime(date, this.config.timezone);
        }
        this._updateSingleDayDateButtonStates();

        if (this.singleCalendarInstance) {
            this.singleCalendarInstance.setSelectedDate(date, false); // Update calendar's date
            this.singleCalendarInstance.hide(); // Hide custom calendar if open
        }
        this.clearMessages();

        if (typeof this.config.onDateChange === 'function') {
            try {
                const isoDate = DateTime.fromJSDate(date).toISODate();
                this.config.onDateChange(isoDate);
            } catch (e) {
                console.error("Error executing onDateChange callback:", e);
            }
        }
    }

    _updateSingleDayDateButtonStates() {
        if (this.config.multiday || !this.elements.dateBtnToday || !this.elements.dateBtnTomorrow || !this.elements.dateBtnOther || !this.elements.otherDateText) {
            return; // Not applicable for multiday or if elements are missing
        }

        const today_object = DateTime.now().setZone(this.config.timezone).startOf('day').toObject();
        const today = new Date(today_object["year"], today_object["month"] - 1, today_object["day"]);
        const tomorrow_object = DateTime.now().setZone(this.config.timezone).plus({days: 1}).startOf('day').toObject();
        const tomorrow = new Date(tomorrow_object["year"], tomorrow_object["month"] - 1, tomorrow_object["day"]);
        const selected_object = this.state.selectedDate ? DateTime.fromJSDate(this.state.selectedDate).setZone(this.config.timezone).startOf('day').toObject() : null;
        const selected = selected_object ? new Date(selected_object["year"], selected_object["month"] - 1, selected_object["day"]) : null;

        this.elements.dateBtnToday.classList.remove('active');
        this.elements.dateBtnTomorrow.classList.remove('active');
        this.elements.dateBtnOther.classList.remove('active');
        this.elements.otherDateText.textContent = this.t('otherDate'); // Default text
        if (this.elements.dateBtnOther.children[1]) this.elements.dateBtnOther.children[1].setAttribute("stroke", "#000"); // Default arrow color


        if (selected) {
            const localeMap = {EN: 'en-GB', DE: 'de-DE', FR: 'fr-FR', IT: 'it-IT', TH: 'th-TH', ES: 'es-ES'};
            const locale = localeMap[this.config.language] || (this.config.language ? `${this.config.language.toLowerCase()}-${this.config.language.toUpperCase()}` : 'en-GB');
            if (selected.getTime() === today.getTime()) {
                this.elements.dateBtnToday.classList.add('active');
            } else if (selected.getTime() === tomorrow.getTime()) {
                this.elements.dateBtnTomorrow.classList.add('active');
            } else {
                this.elements.dateBtnOther.classList.add('active');
                this.elements.otherDateText.textContent = formatDateForDisplay(selected, locale, this.config.timezone);
                if (this.elements.dateBtnOther.children[1]) this.elements.dateBtnOther.children[1].setAttribute("stroke", "#fff"); // Active arrow color
            }
            // Ensure hidden input is also updated
            if (this.elements.activityDate) {
                this.elements.activityDate.value = formatDatetime(selected, this.config.timezone);
            }
        } else {
            // No date selected, reset "Other Date" text and hidden input
            this.elements.otherDateText.textContent = this.t('otherDate');
            if (this.elements.activityDate) {
                this.elements.activityDate.value = '';
            }
        }
    }
}
