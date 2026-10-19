import styles from './styles/widget.scss';
import {DateTime} from 'luxon';
import translations from '../translations';
import {debounce, firstNonBlank, formatDateForDisplay, getApiErrorTranslationKey, resolveActivityName} from '../utils';
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
    getTimeFormatFromMinutes
} from '../datetimeUtils';

import {PageManager} from '../components/PageManager';
import {UIManager} from '../components/UIManager';
import {RangeCalendarModal, SingleCalendar} from "../components/Calendar";

import {helpContent} from '../templates/helpContent';
import {getShareOriginDialogHTML} from '../templates/partials/_shareOriginDialog';
import {getResultsSkeletonHTML} from '../templates/partials/_resultsSkeleton';
import {getLocationTypeIconHTML} from '../templates/partials/_locationIcons';

import {
    DEFAULT_CONFIG,
    DEFAULT_STATE,
    ADDRESS_INPUT_DEBOUNCE_MS,
    isCoordinateLocationType
} from '../constants';

import { validateConfig } from './Validator';
import { ConnectionRenderer } from './ConnectionRenderer';
import { getTransportIcon } from './transportIcons';
import {
    applySharedActivityToConfig,
    buildShareUrl,
    findSharedConnectionIndex,
    isValidShareId,
    readShareIdFromUrl,
    resolveShareOrigin
} from './shareConfig';
import { isConnectionDeparted, shouldIncludePastConnections } from './pastConnections';

import { ApiService } from '../services';
import type { ApiError, FetchOptions } from '../services';

import type {
    WidgetConfig,
    PartialWidgetConfig,
    WidgetState,
    Connection
} from '../types';
import type { ShareDataResponse } from '../types/api';
import type { ShareContext } from '../types/state';

/**
 * The departure point as it is held in the origin input: the text the user sees plus the
 * coordinates behind it, if the value came from a geocoded pick rather than free text.
 */
interface OriginValue {
    value: string;
    lat: string | null;
    lon: string | null;
}

/**
 * Everything `renderConnectionResults()` draws from. Captured before a re-plan so the
 * journey on screen can be put back when the re-plan turns out to be unusable.
 */
interface ConnectionSnapshot {
    toConnections: Connection[];
    fromConnections: Connection[];
    recommendedToIndex: number;
    recommendedFromIndex: number;
    activity: WidgetState['activity'];
    hasMoreBeforeToActivity: boolean | null;
    hasMoreAfterToActivity: boolean | null;
    hasMoreBeforeFromActivity: boolean | null;
    hasMoreAfterFromActivity: boolean | null;
}

/** 
 * Interface for cached DOM elements
 */
interface WidgetElements {
    modal: HTMLElement | null;
    innerContainer: HTMLElement | null;
    formPage: HTMLElement | null;
    resultsPage: HTMLElement | null;
    contentPage: HTMLElement | null;
    originInput: HTMLInputElement | null;
    suggestionsContainer: HTMLElement | null;
    searchBtn: HTMLButtonElement | null;
    backBtn: HTMLButtonElement | null;
    formErrorContainer: HTMLElement | null;
    formDebugContainer: HTMLElement | null;
    resultsErrorContainer: HTMLElement | null;
    resultsInfoContainer: HTMLElement | null;
    resultsDebugContainer: HTMLElement | null;
    infoContainer: HTMLElement | null;
    collapsibleToActivity: HTMLElement | null;
    collapsibleFromActivity: HTMLElement | null;
    responseBox: HTMLElement | null;
    responseBoxBottom: HTMLElement | null;
    topSlider: HTMLElement | null;
    bottomSlider: HTMLElement | null;
    activityTimeBox: HTMLElement | null;
    currentLocationBtn: HTMLButtonElement | null;
    clearInputBtn: HTMLButtonElement | null;
    activityDateStart: HTMLInputElement | null;
    dateDisplayStart: HTMLElement | null;
    activityDateEnd: HTMLInputElement | null;
    dateDisplayEnd: HTMLElement | null;
    activityDate: HTMLInputElement | null;
    dateDisplay: HTMLElement | null;
    dateBtnToday: HTMLButtonElement | null;
    dateBtnTomorrow: HTMLButtonElement | null;
    dateBtnOther: HTMLButtonElement | null;
    otherDateText: HTMLElement | null;
    dateSelectorButtonsGroup: HTMLElement | null;
    toActivityDateDisplay: HTMLElement | null;
    fromActivityDateDisplay: HTMLElement | null;
    formPageMenuButton: HTMLButtonElement | null;
    resultsPageMenuButton: HTMLButtonElement | null;
    contentPageMenuButton: HTMLButtonElement | null;
    formMenuDropdown: HTMLElement | null;
    resultsMenuDropdown: HTMLElement | null;
    contentMenuDropdown: HTMLElement | null;
    contentPageBackBtn: HTMLButtonElement | null;
    contentPageTitle: HTMLElement | null;
    contentPageBody: HTMLElement | null;
    menuModalOverlay?: HTMLElement | null;
    dateSelect?: HTMLSelectElement | null;
    topEarlierBtn: HTMLButtonElement | null;
    topLaterBtn: HTMLButtonElement | null;
    bottomEarlierBtn: HTMLButtonElement | null;
    bottomLaterBtn: HTMLButtonElement | null;
    useFlexToggle: HTMLInputElement | null;
    shareInfoBanner: HTMLElement | null;
    shareOriginOverlay: HTMLElement | null;
    shareOriginText: HTMLElement | null;
    shareOriginInput: HTMLInputElement | null;
    shareOriginSuggestions: HTMLElement | null;
    shareOriginLocationBtn: HTMLElement | null;
    shareOriginStatus: HTMLElement | null;
    shareOriginCloseBtn: HTMLButtonElement | null;
    shareOriginCancelBtn: HTMLButtonElement | null;
    [key: string]: HTMLElement | null | undefined;
}

export default class DianaWidget {
    // Class property declarations
    defaultConfig: WidgetConfig;
    config: WidgetConfig;
    container: HTMLElement | null;
    shadowRoot: ShadowRoot | null;
    dianaWidgetRootContainer: HTMLElement | null;
    CACHE_KEY_USER_START_LOCATION: string;
    state: WidgetState;
    loadingTextTimeout1: ReturnType<typeof setTimeout> | null;
    loadingTextTimeout2: ReturnType<typeof setTimeout> | null;
    singleCalendarInstance: SingleCalendar | null;
    rangeCalendarModal: RangeCalendarModal | null;
    pageManager: PageManager | null;
    uiManager: UIManager | null;
    elements: WidgetElements;
    debouncedHandleAddressInput: (query: string) => void;
    lastQuery: string;
    private apiService: ApiService | null;
    private connectionRenderer: ConnectionRenderer | null;

    /**
     * Memoised share link, so re-opening the share sheet for an unchanged selection
     * does not POST a second /share/ record. Keyed by connection selection + origin.
     */
    private _shareUrlCache: { key: string; shareId: string } | null;

    /**
     * The origin the currently displayed journey was actually searched with. Used to roll
     * the input and the share banner back when a re-plan from a new departure point fails.
     */
    private _lastSearchedOrigin: OriginValue | null;

    /**
     * Incremented for every re-plan in share mode. A search whose token is stale lost the
     * race to a newer one and must not paint or roll anything back.
     */
    private _originSearchToken: number;

    constructor(config: PartialWidgetConfig = {}, containerId: string = "dianaWidgetContainer") {
        // Initialize default config using imported constant
        this.defaultConfig = { ...DEFAULT_CONFIG };
        
        this.config = {...this.defaultConfig, ...config} as WidgetConfig;
        
        // Initialize properties that need default values
        this.shadowRoot = null;
        this.dianaWidgetRootContainer = null;
        this.CACHE_KEY_USER_START_LOCATION = '';
        this.loadingTextTimeout1 = null;
        this.loadingTextTimeout2 = null;
        this.singleCalendarInstance = null;
        this.rangeCalendarModal = null;
        this.pageManager = null;
        this.uiManager = null;
        this.elements = {} as WidgetElements;
        this.lastQuery = '';
        this.state = { ...DEFAULT_STATE };
        this.apiService = null;
        this.connectionRenderer = null;
        this._shareUrlCache = null;
        this._lastSearchedOrigin = null;
        this._originSearchToken = 0;
        this.debouncedHandleAddressInput = debounce((query: string) => this.handleAddressInput(query), ADDRESS_INPUT_DEBOUNCE_MS);
        
        const validationResult = validateConfig(this.config);
        this.config = validationResult.config;
        const configErrors = validationResult.errors;

        // Initialize API service after config validation
        this.apiService = new ApiService(
            this.config,
            () => this._handleSessionExpired(),
            (key: string) => this.t(key)
        );

        // Initialize connection renderer after config validation
        this.connectionRenderer = new ConnectionRenderer({
            config: this.config,
            t: (key: string, replacements?: Record<string, string>) => this.t(key, replacements),
            getTransportIcon: (type: string | number) => this.getTransportIcon(type),
            getTransportName: (type: string | number) => this.getTransportName(type)
        });

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
            const shareId = readShareIdFromUrl();
            const isShareView = this.config.allowShareView !== false && !!shareId;
            if (isShareView) this.config.shareId = shareId as string;
            this.config.readOnly = isShareView;
            if (this.config.shareURLPrefix === null) this.config.shareURLPrefix = window.location.href;

            if (!this.container) {
                console.error(`Container with ID "${containerId}" not found.`);
                return;
            }

            if (this.config.displayStartDate || this.config.displayEndDate) {
                const now = DateTime.now().startOf('day');
                const startDate = this.config.displayStartDate ? DateTime.fromISO(this.config.displayStartDate).startOf('day') : null;
                const endDate = this.config.displayEndDate ? DateTime.fromISO(this.config.displayEndDate).startOf('day') : null;
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

            const style = document.createElement('style');
            style.innerHTML = `
              #${containerId} {
                max-height: 790px;
              }
            `;
            document.body.appendChild(style);

            let initialSelectedStartDate: Date | null = null;
            let initialSelectedEndDate: Date | null = null;
            if (this.config.multiday && this.config.activityDurationDaysFixed) {
                if (this.config.overrideActivityEndDate) {
                    const endDt = DateTime.fromISO(this.config.overrideActivityEndDate, {zone: 'utc'});
                    initialSelectedEndDate = endDt.toJSDate();
                    initialSelectedStartDate = endDt.minus({days: this.config.activityDurationDaysFixed - 1}).toJSDate();
                } else if (this.config.overrideActivityStartDate) {
                    const startDt = DateTime.fromISO(this.config.overrideActivityStartDate, {zone: 'utc'});
                    initialSelectedStartDate = startDt.toJSDate();
                    initialSelectedEndDate = startDt.plus({days: this.config.activityDurationDaysFixed - 1}).toJSDate();
                } else if (this.config.activityLatestEndTime && this.config.activityDurationMinutes !== undefined) {
                    initialSelectedStartDate = calculateInitialStartDate(this.config.timezone, this.config.activityLatestEndTime, this.config.activityDurationMinutes);
                    initialSelectedEndDate = DateTime.fromJSDate(initialSelectedStartDate, {zone: 'utc'}).plus({days: this.config.activityDurationDaysFixed - 1}).toJSDate();
                } else {
                    // Fallback: use today in widget timezone as start date when no other config is available
                    const todayInZone = DateTime.now().setZone(this.config.timezone).startOf('day');
                    initialSelectedStartDate = new Date(Date.UTC(todayInZone.year, todayInZone.month - 1, todayInZone.day));
                    initialSelectedEndDate = DateTime.fromJSDate(initialSelectedStartDate, {zone: 'utc'}).plus({days: this.config.activityDurationDaysFixed - 1}).toJSDate();
                }
            }

            if (!initialSelectedStartDate) {
                if (this.config.overrideActivityStartDate) {
                    initialSelectedStartDate = DateTime.fromISO(this.config.overrideActivityStartDate, {zone: 'utc'}).toJSDate();
                } else if (this.config.activityLatestEndTime && this.config.activityDurationMinutes !== undefined) {
                    initialSelectedStartDate = calculateInitialStartDate(this.config.timezone, this.config.activityLatestEndTime, this.config.activityDurationMinutes);
                } else if (this.config.multiday) {
                    // Fallback for multiday: use today in widget timezone as start date
                    const todayInZone = DateTime.now().setZone(this.config.timezone).startOf('day');
                    initialSelectedStartDate = new Date(Date.UTC(todayInZone.year, todayInZone.month - 1, todayInZone.day));
                }
            }
            if (this.config.multiday && !initialSelectedEndDate && initialSelectedStartDate) {
                initialSelectedEndDate = this.config.overrideActivityEndDate
                    ? DateTime.fromISO(this.config.overrideActivityEndDate, {zone: 'utc'}).toJSDate()
                    : DateTime.fromJSDate(initialSelectedStartDate, {zone: 'utc'}).plus({days: this.config.activityDurationDaysFixed || 1}).toJSDate();
            }
            if (this.config.multiday && initialSelectedStartDate && initialSelectedEndDate && DateTime.fromJSDate(initialSelectedEndDate, {zone: 'utc'}) < DateTime.fromJSDate(initialSelectedStartDate, {zone: 'utc'})) {
                initialSelectedEndDate = new Date(initialSelectedStartDate.valueOf());
            }

            // Update state with calculated dates
            this.state.selectedDate = initialSelectedStartDate;
            this.state.selectedEndDate = initialSelectedEndDate;

            // The main initialization logic is now split.
            if (shareId && this.config.allowShareView) {
                // A share ID is present: fetch the share and overwrite the local config with
                // its activity data *before* the DOM is built, because the templates bake the
                // config into HTML strings exactly once.
                this._showBootSkeleton();
                this._loadFromShareID(shareId).catch(error => {
                    console.error("Error during shared journey initialization:", error);
                    this._showFatalError(this.t('errors.shareLinkErrorTitle'), error.message, "info", true);
                });
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
            if (value && this.dianaWidgetRootContainer) {
                this.dianaWidgetRootContainer.style.setProperty(prop, value);
            }
        });
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

    _showFallbackUI(): void {
        this._showFatalError(this.t('errors.widgetLoadErrorTitle'), this.t('errors.api.internalError'));
    }

    t(keyPath: string, replacements: Record<string, string> = {}): string {
        const keys = keyPath.split('.');
        let result: unknown = translations[this.config.language];
        for (const key of keys) {
            result = (result as Record<string, unknown>)?.[key];
            if (!result) break;
        }
        if (!result && this.config.language !== 'EN') {
            let fallbackResult: unknown = translations.EN;
            for (const key of keys) {
                fallbackResult = (fallbackResult as Record<string, unknown>)?.[key];
                if (!fallbackResult) break;
            }
            result = fallbackResult;
        }

        let text: string = (result as string) || `[${keyPath}]`;

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
        const dianaWidgetRootContainer = document.createElement('div');
        dianaWidgetRootContainer.className = 'diana-container';
        if (!this.shadowRoot) return;
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

        // Sibling of the modal rather than a child: `.diana-container` is the positioned,
        // non-scrolling box, so the overlay covers the widget instead of scrolling away
        // with `.modal-content`.
        this.dianaWidgetRootContainer.innerHTML = `
          <div id="activityModal" class="modal visible">
            <div id="innerContainer" class="modal-content">
              ${formPageHTML}
              ${resultsPageHTML}
              ${contentPageHTML}
            </div>
          </div>
          ${getShareOriginDialogHTML({t: (key) => this.t(key)})}
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

    _setupDateInput(): void {
        if (this.config.multiday || this.config.overrideActivityStartDate) {
            return;
        }

        if (this.config.dateList) {
            const now = DateTime.now().setZone(this.config.timezone).startOf('day');
            const availableDates = this.config.dateList
                .map(d => DateTime.fromISO(d, {zone: 'utc'}).startOf('day'))
                .filter(dt => dt >= now)
                .sort((a, b) => a.toMillis() - b.toMillis());
            
            // Store availableDates as DateTime[] on state
            this.state.availableDates = availableDates;

            if (availableDates.length > 0) {
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
                    availableDates.forEach(dt => {
                        const option = document.createElement('option');
                        const isoDate = dt.toISODate();
                        option.value = isoDate || '';
                        option.textContent = this.formatDateForSelect(dt);
                        select.appendChild(option);
                    });
                    dateContainer.appendChild(select);
                    this.elements.dateSelect = select;

                    const initialDate = availableDates[0].toJSDate();
                    this.onDateSelectedByButton(initialDate);

                    select.addEventListener('change', (e) => {
                        const selectedIso = (e.target as HTMLSelectElement).value;
                        const newDate = DateTime.fromISO(selectedIso, {zone: 'utc'}).toJSDate();
                        this.onDateSelectedByButton(newDate);
                    });
                }
            }
        }
    }

    formatDateForSelect(luxonDate: DateTime): string {
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
            if (isCoordinateLocationType(this.config.overrideUserStartLocationType)) {
                const parts = this.config.overrideUserStartLocation.split(',');
                if (parts.length === 2) {
                    originInput.setAttribute('data-lat', parts[0].trim());
                    originInput.setAttribute('data-lon', parts[1].trim());
                }
            }
            
            // Only disable the field if disableUserStartLocationField is true
            if (this.config.disableUserStartLocationField) {
                originInput.disabled = true;
                originInput.classList.add('disabled');
                if (this.elements.currentLocationBtn) this.elements.currentLocationBtn.style.display = 'none';
                if (this.elements.clearInputBtn) this.elements.clearInputBtn.style.display = 'none';
            } else {
                // Field is editable, show appropriate buttons
                if (this.elements.clearInputBtn && this.elements.currentLocationBtn) {
                    this.elements.clearInputBtn.style.display = 'block';
                    this.elements.currentLocationBtn.style.display = 'none';
                }
            }
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
        if (!this.shadowRoot) {
            this.elements = {} as WidgetElements;
            return;
        }
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
            resultsInfoContainer: this.shadowRoot.querySelector("#resultsInfoContainer"),
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

            // Scroll buttons
            topEarlierBtn: this.shadowRoot.querySelector("#topEarlierBtn"),
            topLaterBtn: this.shadowRoot.querySelector("#topLaterBtn"),
            bottomEarlierBtn: this.shadowRoot.querySelector("#bottomEarlierBtn"),
            bottomLaterBtn: this.shadowRoot.querySelector("#bottomLaterBtn"),

            // On-demand transit (Bedarfsverkehr) toggle
            useFlexToggle: this.shadowRoot.querySelector("#useFlexToggle"),

            // Share mode UI
            shareInfoBanner: this.shadowRoot.querySelector("#shareInfoBanner"),
            shareOriginOverlay: this.shadowRoot.querySelector("#shareOriginOverlay"),
            shareOriginText: this.shadowRoot.querySelector("#shareOriginText"),
            shareOriginInput: this.shadowRoot.querySelector("#shareOriginInput"),
            shareOriginSuggestions: this.shadowRoot.querySelector("#shareOriginSuggestions"),
            shareOriginLocationBtn: this.shadowRoot.querySelector("#shareOriginLocationBtn"),
            shareOriginStatus: this.shadowRoot.querySelector("#shareOriginStatus"),
            shareOriginCloseBtn: this.shadowRoot.querySelector("#shareOriginCloseBtn"),
            shareOriginCancelBtn: this.shadowRoot.querySelector("#shareOriginCancelBtn"),
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

        // Allow event listeners if either no override is set, or override is set but field is not disabled
        const shouldEnableOriginInput = !this.config.overrideUserStartLocation || 
                                       (this.config.overrideUserStartLocation && !this.config.disableUserStartLocationField);
        
        if (shouldEnableOriginInput && this.elements.originInput) {
            this.elements.originInput.addEventListener('input', (e) => {
                this.elements.originInput!.removeAttribute("data-lat");
                this.elements.originInput!.removeAttribute("data-lon");
                this.clearMessages();
                const target = e.target as HTMLInputElement;
                this.debouncedHandleAddressInput(target.value.trim());

                if (this.elements.clearInputBtn && this.elements.currentLocationBtn) {
                    if (target.value.trim()) {
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
                    const target = e.target as HTMLElement;
                    // closest(): the row now wraps an icon and a text span, so the click
                    // target is usually a child rather than .suggestion-item itself.
                    const item = target.closest('.suggestion-item') as HTMLElement | null;
                    if (item) this.handleSuggestionSelect(item.dataset.value, item.dataset.lat, item.dataset.lon);
                });
            }

            this.elements.originInput.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') this.handleSuggestionNavigation(e);
                else if (e.key === 'Enter') this.handleSuggestionEnter(e);
            });
            if (this.elements.currentLocationBtn) this.elements.currentLocationBtn.addEventListener('click', () => this.handleCurrentLocation());

            if (this.elements.clearInputBtn) this.elements.clearInputBtn.addEventListener('click', () => {
                if (!this.elements.originInput) return;
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

        if (this.elements.useFlexToggle) {
            this.elements.useFlexToggle.addEventListener('change', (e) => {
                this.state.useFlex = (e.target as HTMLInputElement).checked;
                // A different set of connections is a different journey, so any share link
                // we already minted no longer describes what the user would share.
                this._shareUrlCache = null;
            });
        }

        // Delegated: the banner's inner HTML is rebuilt on every results render.
        if (this.elements.shareInfoBanner) {
            this.elements.shareInfoBanner.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                if (target.closest('[data-action="change-share-origin"]')) {
                    this._showShareOriginDialog();
                }
            });
        }

        this._setupShareOriginDialogListeners();

        if (this.elements.backBtn) this.elements.backBtn.addEventListener('click', () => this.navigateToForm());
        if (this.elements.contentPageBackBtn) this.elements.contentPageBackBtn.addEventListener('click', () => this.closeMenuOrContentPage());

        this.elements.collapsibleToActivity?.addEventListener('click', () => this.toggleCollapsible('to'));
        this.elements.collapsibleFromActivity?.addEventListener('click', () => this.toggleCollapsible('from'));
        this._setupCollapsibleAccessibility('to');
        this._setupCollapsibleAccessibility('from');

        if (this.elements.responseBox) {
            this.elements.responseBox.addEventListener('click', (e) => {
                this.handleBuyTicketClick(e);
                this.handleLegInfoClick(e);
            });
        }
        if (this.elements.responseBoxBottom) {
            this.elements.responseBoxBottom.addEventListener('click', (e) => {
                this.handleBuyTicketClick(e);
                this.handleLegInfoClick(e);
            });
        }


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
                    const target = e.target as HTMLElement;
                    const menuItem = target.closest('.menu-dropdown-item') as HTMLElement | null;
                    if (menuItem) {
                        if (menuItem.classList.contains('disabled')) {
                            e.preventDefault();
                            return; // Do nothing if disabled
                        }
                        if (menuItem.dataset.action === 'share') {
                            e.preventDefault();
                            this.handleShare();
                        } else if (menuItem.dataset.contentKey) {
                            e.preventDefault();
                            this.navigateToContentPage(menuItem.dataset.contentKey);
                        }
                        // For external links (like imprint), don't prevent default - let them navigate normally
                        // Close all dropdowns
                        menuDropdowns.forEach(d => {
                            if (d) d.style.display = 'none';
                        });
                    }
                });
            }
        });

        document.addEventListener("click", (e) => {
            const target = e.target as Node;
            if (this.elements.suggestionsContainer?.style.display === 'block' && !this.elements.suggestionsContainer.contains(target) && this.elements.originInput && !this.elements.originInput.contains(target)) {
                this.state.suggestions = [];
                this.renderSuggestions();
            }
            // Close menu dropdowns if click is outside
            const clickedInsideMenu = menuButtons.some(b => b && b.contains(target)) || menuDropdowns.some(d => d && d.style.display === 'block' && d.contains(target));
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
    /**
     * Makes a journey summary header operable as a disclosure button for keyboard and
     * screen-reader users. The container's classes are changed from many places, so the
     * ARIA state is kept in sync by observing them instead of updating every call site.
     */
    _setupCollapsibleAccessibility(type: 'to' | 'from'): void {
        const container = type === 'to' ? this.elements.collapsibleToActivity : this.elements.collapsibleFromActivity;
        const header = container?.querySelector('.collapsible-header') as HTMLElement | null;
        const content = type === 'to' ? this.elements.responseBox : this.elements.responseBoxBottom;
        if (!container || !header) return;

        header.setAttribute('role', 'button');
        if (content?.id) header.setAttribute('aria-controls', content.id);

        const sync = () => {
            const enabled = container.classList.contains('has-summary');
            header.tabIndex = enabled ? 0 : -1;
            header.setAttribute('aria-disabled', String(!enabled));
            header.setAttribute('aria-expanded', String(enabled && container.classList.contains('expanded')));
        };
        sync();
        new MutationObserver(sync).observe(container, {attributes: true, attributeFilter: ['class']});

        header.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.toggleCollapsible(type);
            }
        });
    }

    toggleCollapsible(type: string): void {
        const container = type === 'to'
            ? this.elements.collapsibleToActivity
            : this.elements.collapsibleFromActivity;

        if (container && container.classList.contains('has-summary')) {
            container.classList.toggle('expanded');
        }
    }

    _handleSessionExpired(): void {
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

        this.shadowRoot?.querySelectorAll(".date-input-container").forEach(el => {
            const htmlEl = el as HTMLElement;
            if (htmlEl) {
                htmlEl.style.pointerEvents = 'none';
                htmlEl.classList.add('disabled-by-session-expiry');
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
            reloadButton.onclick = () => window.location.reload();
            messageContainer.appendChild(reloadButton);

            this.elements.formErrorContainer.innerHTML = ''; // Clear previous errors
            this.elements.formErrorContainer.appendChild(messageContainer);
            this.elements.formErrorContainer.style.display = 'block';
            this.elements.formErrorContainer.setAttribute('role', 'alert');
        }
    }

    /**
     * Makes an authenticated API request using the ApiService
     * @param url - URL to fetch
     * @param options - Fetch options
     * @param isRetry - Whether this is a retry (used internally by ApiService)
     * @returns Promise resolving to the Response
     * @throws ApiError on failure
     */
    async _fetchApi(url: string, options: FetchOptions = {}, isRetry: boolean = false): Promise<Response> {
        if (!this.apiService) {
            throw new Error('ApiService not initialized');
        }
        return this.apiService.fetch(url, options, isRetry);
    }


    async handleCurrentLocation(): Promise<void> {
        this.clearMessages();
        if (!navigator.geolocation) {
            this.showError(this.t('errors.geolocationNotSupported'), 'form');
            return;
        }
        const locationBtn = this._isShareOriginDialogOpen()
            ? this.elements.shareOriginLocationBtn
            : this.elements.currentLocationBtn;
        if (locationBtn) {
            locationBtn.style.pointerEvents = 'none';
            locationBtn.style.opacity = '0.5';
        }
        const activeInput = this._originSearchTarget().input;
        if (activeInput) activeInput.disabled = true;

        this.showInfo(this.t('infos.fetchingLocation'));
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true, timeout: 10000, maximumAge: 0
                });
            });
            const {latitude, longitude} = position.coords;
            await this.fetchReverseGeocode(latitude, longitude);
        } catch (error) {
            let errorMsg = this.t('errors.geolocationError');
            const geoError = error as GeolocationPositionError;
            if (geoError.code) {
                switch (geoError.code) {
                    case geoError.PERMISSION_DENIED:
                        errorMsg = this.t('errors.geolocationPermissionDenied');
                        break;
                    case geoError.POSITION_UNAVAILABLE:
                        errorMsg = this.t('errors.geolocationPositionUnavailable');
                        break;
                    case geoError.TIMEOUT:
                        errorMsg = this.t('errors.geolocationTimeout');
                        break;
                }
            }
            this.showError(errorMsg, 'form');
        } finally {
            if (locationBtn) {
                locationBtn.style.pointerEvents = 'auto';
                locationBtn.style.opacity = '1';
            }
            if (activeInput) activeInput.disabled = false;
            if (this.state.info === this.t('infos.fetchingLocation')) this.showInfo(null);
        }
    }

    async fetchReverseGeocode(latitude: number, longitude: number): Promise<void> {
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
                const fromDialog = this._isShareOriginDialogOpen();

                this.state.suggestions = [];
                this.renderSuggestions();

                this._setOriginInputValue(displayName, latitude, longitude);
                this.clearMessages();
                this._setCachedStartLocation(displayName, latitude, longitude);
                this._shareUrlCache = null;

                if (fromDialog) this._hideShareOriginDialog();

                void this._handleOriginChangedInShareMode();
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
        if (!this.elements.originInput) return;

        // #originInput stays the canonical origin even when the pick came from the dialog,
        // because _buildActivityParams and _buildSharePayload both read it.
        const fromDialog = this._isShareOriginDialogOpen();

        this.state.suggestions = [];
        this.renderSuggestions();

        this._setOriginInputValue(value, lat, lon);
        this.clearMessages();
        this._setCachedStartLocation(value, lat, lon);
        this._shareUrlCache = null;

        if (fromDialog) {
            this._hideShareOriginDialog();
        } else {
            this.elements.originInput.focus();
        }

        // In share mode a new origin re-plans the journey from here, under the same share id.
        void this._handleOriginChangedInShareMode();
    }

    handleSuggestionNavigation(e) {
        const {input, suggestions} = this._originSearchTarget();
        if (!suggestions || this.state.suggestions.length === 0) return;
        e.preventDefault(); // Prevent cursor movement in input

        const items = Array.from(suggestions.querySelectorAll('.suggestion-item'));
        if (items.length === 0) return;

        let currentIndex = items.findIndex(item => item.classList.contains('active-suggestion'));

        items.forEach(item => item.classList.remove('active-suggestion'));

        if (e.key === 'ArrowDown') {
            currentIndex = (currentIndex + 1) % items.length;
        } else if (e.key === 'ArrowUp') {
            currentIndex = (currentIndex - 1 + items.length) % items.length;
        }

        if (currentIndex >= 0 && currentIndex < items.length) {
            const item = items[currentIndex] as HTMLElement;
            item.classList.add('active-suggestion');
            item.focus(); // Make it focusable for screen readers and further interaction
            // Scroll into view if necessary
            item.scrollIntoView({block: 'nearest', inline: 'nearest'});
            input?.setAttribute('aria-activedescendant', item.id || `suggestion-item-${currentIndex}`); // Assuming items have IDs
        }
    }

    handleSuggestionEnter(e: KeyboardEvent): void {
        const {input, suggestions} = this._originSearchTarget();
        if (!suggestions || this.state.suggestions.length === 0) return;

        const activeItem = suggestions.querySelector('.suggestion-item.active-suggestion') as HTMLElement | null;
        if (activeItem) {
            e.preventDefault(); // Prevent form submission if input is in a form
            this.handleSuggestionSelect(activeItem.dataset.value ?? '', activeItem.dataset.lat ?? '', activeItem.dataset.lon ?? '');
        } else if (this.state.suggestions.length > 0 && (input?.value.trim().length ?? 0) >= 2) {
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

    async handleSearch(): Promise<void> {
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
                this.showInfo(this.t('infos.dateRequired'));
                return;
            }
            if (this.config.multiday && !this.config.overrideActivityEndDate && (!activityDateEndInput || !activityDateEndInput.value) && !this.config.activityDurationDaysFixed) {
                this.showInfo(this.t('infos.endDateRequired'));
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
                } catch (_parseError) {
                    errorMessage = this.t('errors.api.unknown');
                }
            } else if (error.message) {
                // Use the error message directly if it's not one of the known API error patterns
                errorMessage = error.message || this.t('errors.api.unknown');
            }
            // preserveContent: a failed re-plan in share mode must not wipe the journey
            // that is still on screen - _handleOriginChangedInShareMode() restores it.
            this.showError(errorMessage, this._activeMessagePage(), true, errorResponse);
        } finally {
            this.setLoadingState(false);
        }
    }

    async fetchSuggestions(query) {
        try {
            const fetchLang = navigator.language.split("-")[0];
            const response = await this._fetchApi(
                `${this.config.apiBaseUrl}/address-autocomplete?q=${encodeURIComponent(query)}&lang=${fetchLang}`
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

    _buildActivityParams(): Record<string, string | number | undefined> {
        const activityStartDate = this.state.selectedDate;
        if (!activityStartDate) throw new Error("Activity start date is not available.");

        const referenceDateForEndTimes = this.config.multiday && this.state.selectedEndDate
            ? this.state.selectedEndDate
            : activityStartDate;

        const utcEarliestStart = convertLocalTimeToUTC(this.config.activityEarliestStartTime ?? '00:00', activityStartDate, this.config.timezone);
        const utcLatestStart = convertLocalTimeToUTC(this.config.activityLatestStartTime ?? '23:59', activityStartDate, this.config.timezone);
        const utcEarliestEnd = convertLocalTimeToUTC(this.config.activityEarliestEndTime ?? '00:00', referenceDateForEndTimes, this.config.timezone);
        const utcLatestEnd = convertLocalTimeToUTC(this.config.activityLatestEndTime ?? '23:59', referenceDateForEndTimes, this.config.timezone);

        const params: Record<string, string | number | undefined> = {
            date: formatDatetime(activityStartDate, this.config.timezone),
            activity_start_location: this.config.activityStartLocation,
            activity_start_location_type: this.config.activityStartLocationType,
            activity_end_location: this.config.activityEndLocation,
            activity_end_location_type: this.config.activityEndLocationType,
            activity_earliest_start_time: utcEarliestStart,
            activity_latest_start_time: utcLatestStart,
            activity_earliest_end_time: utcEarliestEnd,
            activity_latest_end_time: utcLatestEnd,
            activity_duration_minutes: this.config.activityDurationMinutes,
            // Alerts and booking information are returned in this language when the feed has it.
            lang: this.config.language?.toLowerCase()
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

        params["timezone"] = this.config.timezone;

        if (this.elements.originInput?.attributes["data-lat"] && this.elements.originInput?.attributes["data-lon"]) {
            params["user_start_location"] = `${(this.elements.originInput.attributes as NamedNodeMap).getNamedItem('data-lat')?.value},${(this.elements.originInput.attributes as NamedNodeMap).getNamedItem('data-lon')?.value}`;
            params["user_start_location_type"] = "coordinates";
            params["user_start_location_display_name"] = this.elements.originInput.value;
        } else if (this.elements.originInput) {
            params["user_start_location"] = this.elements.originInput.value;
            params["user_start_location_type"] = "address";
        }

        // Omitted rather than sent empty: params go through URLSearchParams, which would turn
        // a missing name into the literal string "undefined".
        const activityName = resolveActivityName(this.config);
        if (activityName) params.activity_name = activityName;

        if (this.config.activityStartLocationDisplayName) params.activity_start_location_display_name = this.config.activityStartLocationDisplayName;
        if (this.config.activityEndLocationDisplayName) params.activity_end_location_display_name = this.config.activityEndLocationDisplayName;
        if (this.config.activityStartTimeLabel) params.activity_start_time_label = this.config.activityStartTimeLabel;
        if (this.config.activityEndTimeLabel) params.activity_end_time_label = this.config.activityEndTimeLabel;

        // Bundled mode: when viewing a shared journey, every /connections request carries the
        // share id. The backend derives its parameters from the stored share, and any param we
        // send alongside overrides the stored value — which is exactly how the recipient's own
        // `user_start_location` (read from the DOM above) takes effect while the backend still
        // uses the *stored* arrival time as the consumer-mode arrive-by target.
        // Only shares that carry an activity object are replayable; without one the backend
        // rejects the request with code 5004, so those fall back to a plain search.
        const isBundledShare = !!(this.state.shareContext?.shareId && this.state.shareContext.activity);
        if (isBundledShare) {
            params.share_id = this.state.shareContext!.shareId;
            if (this.config.shareMode) params.share_mode = this.config.shareMode;
        }

        // In bundled mode the backend falls back to the `use_flex` stored on the share, so
        // the param has to be sent in both directions — otherwise switching the toggle off
        // on a share created with `use_flex: true` would silently keep the stored `true`.
        if (this.state.useFlex) {
            params.use_flex = 'true';
        } else if (isBundledShare) {
            params.use_flex = 'false';
        }

        // For today, ask the backend to keep connections that have already left, so the
        // whole day can be browsed with "load earlier". They are greyed out in the slider.
        if (shouldIncludePastConnections(this.config.showPastConnections, params.date as string, this.config.timezone)) {
            params.include_past = 'true';
        }

        return params;
    }

    _markConnectionElements(connections: Connection[]): void {
        connections.forEach((conn) => {
            if (conn.connection_elements && conn.connection_elements.length > 0) {
                conn.connection_elements[0].isOriginalFirst = true;
                conn.connection_elements[conn.connection_elements.length - 1].isOriginalLast = true;
            }
        });
    }

    async fetchActivityData(): Promise<void> {
        const params = this._buildActivityParams();

        // Type assertion needed as URLSearchParams expects Record<string, string> but params has mixed types
        const queryString = new URLSearchParams(params as Record<string, string>);
        const response = await this._fetchApi(
            `${this.config.apiBaseUrl}/connections?${queryString}`
        );

        const result = await response.json();
        if (!result?.connections?.from_activity || !result?.connections?.to_activity) {
            console.error("API response missing expected connection data:", result);
            const apiError: ApiError = new Error(this.t('errors.api.invalidDataReceived'));
            apiError.response = {
                json: async () => ({error: "Invalid connection data", code: "APP_INVALID_DATA"}),
                status: 500
            } as unknown as Response;
            throw apiError;
        }
        this.state.toConnections = result.connections.to_activity;
        this.state.fromConnections = result.connections.from_activity;

        this.state.activity = result.activity ?? null;

        this._markConnectionElements(this.state.toConnections);
        this._markConnectionElements(this.state.fromConnections);

        const toIndex = result.connections.recommended_to_activity_connection;
        const fromIndex = result.connections.recommended_from_activity_connection;
        this.state.recommendedToIndex = (typeof toIndex === 'number') ? toIndex : 0;
        this.state.recommendedFromIndex = (typeof fromIndex === 'number') ? fromIndex : 0;

        this.state.hasMoreBeforeToActivity = result.connections.has_more_before_to_activity ?? null;
        this.state.hasMoreAfterToActivity = result.connections.has_more_after_to_activity ?? null;
        this.state.hasMoreBeforeFromActivity = result.connections.has_more_before_from_activity ?? null;
        this.state.hasMoreAfterFromActivity = result.connections.has_more_after_from_activity ?? null;

        if (this.state.toConnections.length === 0 && this.state.fromConnections.length === 0) console.warn("No connections received.");
        else if (this.state.toConnections.length === 0) console.warn("No 'to_activity' connections received.");
        else if (this.state.fromConnections.length === 0) console.warn("No 'from_activity' connections received.");

        this.renderConnectionResults();
    }

    updateScrollButtons(): void {
        const show = (btn: HTMLButtonElement | null, visible: boolean) => {
            if (!btn) return;
            btn.hidden = !visible;
        };
        show(this.elements.topEarlierBtn as HTMLButtonElement, this.state.hasMoreBeforeToActivity === true);
        show(this.elements.topLaterBtn as HTMLButtonElement, this.state.hasMoreAfterToActivity === true);
        show(this.elements.bottomEarlierBtn as HTMLButtonElement, this.state.hasMoreBeforeFromActivity === true);
        show(this.elements.bottomLaterBtn as HTMLButtonElement, this.state.hasMoreAfterFromActivity === true);
    }

    async fetchScrollConnections(direction: 'to' | 'from', scrollType: 'before' | 'after'): Promise<void> {
        const currentConnections = direction === 'to' ? this.state.toConnections : this.state.fromConnections;
        if (!currentConnections.length) return;

        const scrollBtn = direction === 'to'
            ? (scrollType === 'before' ? this.elements.topEarlierBtn : this.elements.topLaterBtn)
            : (scrollType === 'before' ? this.elements.bottomEarlierBtn : this.elements.bottomLaterBtn);

        if (scrollBtn) {
            (scrollBtn as HTMLButtonElement).disabled = true;
            scrollBtn.classList.add('loading');
        }

        try {
            // `use_flex` follows the form-page toggle, so an earlier/later batch is drawn
            // from the same pool of services as the results the user is already looking at.
            const params = this._buildActivityParams();

            const anchor = scrollType === 'before'
                ? currentConnections[0].connection_start_timestamp
                : currentConnections[currentConnections.length - 1].connection_start_timestamp;

            if (direction === 'to') {
                params[scrollType === 'before' ? 'to_connections_before' : 'to_connections_after'] = anchor;
            } else {
                params[scrollType === 'before' ? 'from_connections_before' : 'from_connections_after'] = anchor;
            }

            const queryString = new URLSearchParams(params as Record<string, string>);
            const response = await this._fetchApi(`${this.config.apiBaseUrl}/connections?${queryString}`);
            const result = await response.json();

            if (!result?.connections) return;

            if (direction === 'to' && Array.isArray(result.connections.to_activity)) {
                const newConns: Connection[] = result.connections.to_activity;

                if (newConns.length === 0) {
                    if (scrollType === 'before') this.state.hasMoreBeforeToActivity = false;
                    else this.state.hasMoreAfterToActivity = false;
                    this.updateScrollButtons();
                    return;
                }

                this._markConnectionElements(newConns);

                if (scrollType === 'before') {
                    const prependCount = newConns.length;
                    this.state.toConnections = [...newConns, ...this.state.toConnections];
                    this.state.recommendedToIndex += prependCount;
                } else {
                    this.state.toConnections = [...this.state.toConnections, ...newConns];
                }

                if (result.connections.has_more_before_to_activity !== null) {
                    this.state.hasMoreBeforeToActivity = result.connections.has_more_before_to_activity;
                }
                if (result.connections.has_more_after_to_activity !== null) {
                    this.state.hasMoreAfterToActivity = result.connections.has_more_after_to_activity;
                }

                this.calculateAnytimeConnections(this.state.toConnections, 'to');
                this.renderTimeSlots('topSlider', this.state.toConnections, 'to');
                this.addSwipeBehavior('topSlider');

                // Re-apply the active selection styling after re-render
                const selectedConn = this.state.selectedToConnection;
                if (selectedConn) {
                    const newIdx = this.state.toConnections.indexOf(selectedConn);
                    if (newIdx !== -1) {
                        this.elements.topSlider?.querySelectorAll('button').forEach(btn => btn.classList.remove('active-time'));
                        this.elements.topSlider?.querySelector(`button[data-index="${newIdx}"]`)?.classList.add('active-time');
                        this.state.recommendedToIndex = newIdx;
                    }
                }

                // Re-apply disabled state driven by the selected from-connection
                this._updateOppositeSlider('from');
            } else if (direction === 'from' && Array.isArray(result.connections.from_activity)) {
                const newConns: Connection[] = result.connections.from_activity;

                if (newConns.length === 0) {
                    if (scrollType === 'before') this.state.hasMoreBeforeFromActivity = false;
                    else this.state.hasMoreAfterFromActivity = false;
                    this.updateScrollButtons();
                    return;
                }

                this._markConnectionElements(newConns);

                if (scrollType === 'before') {
                    const prependCount = newConns.length;
                    this.state.fromConnections = [...newConns, ...this.state.fromConnections];
                    this.state.recommendedFromIndex += prependCount;
                } else {
                    this.state.fromConnections = [...this.state.fromConnections, ...newConns];
                }

                if (result.connections.has_more_before_from_activity !== null) {
                    this.state.hasMoreBeforeFromActivity = result.connections.has_more_before_from_activity;
                }
                if (result.connections.has_more_after_from_activity !== null) {
                    this.state.hasMoreAfterFromActivity = result.connections.has_more_after_from_activity;
                }

                this.calculateAnytimeConnections(this.state.fromConnections, 'from');
                this.renderTimeSlots('bottomSlider', this.state.fromConnections, 'from');
                this.addSwipeBehavior('bottomSlider');

                // Re-apply the active selection styling after re-render
                const selectedConn = this.state.selectedFromConnection;
                if (selectedConn) {
                    const newIdx = this.state.fromConnections.indexOf(selectedConn);
                    if (newIdx !== -1) {
                        this.elements.bottomSlider?.querySelectorAll('button').forEach(btn => btn.classList.remove('active-time'));
                        this.elements.bottomSlider?.querySelector(`button[data-index="${newIdx}"]`)?.classList.add('active-time');
                        this.state.recommendedFromIndex = newIdx;
                    }
                }

                // Re-apply disabled state driven by the selected to-connection
                this._updateOppositeSlider('to');
            }

            this.updateScrollButtons();
        } catch (error) {
            console.error("Scroll fetch error:", error);
            // Hide the clicked button on error to avoid repeated failed fetches
            if (direction === 'to') {
                if (scrollType === 'before') this.state.hasMoreBeforeToActivity = false;
                else this.state.hasMoreAfterToActivity = false;
            } else {
                if (scrollType === 'before') this.state.hasMoreBeforeFromActivity = false;
                else this.state.hasMoreAfterFromActivity = false;
            }
            this.updateScrollButtons();
        } finally {
            if (scrollBtn) {
                (scrollBtn as HTMLButtonElement).disabled = false;
                scrollBtn.classList.remove('loading');
            }
        }
    }

    /**
     * The input/suggestion pair the autocomplete currently drives. The change-departure-point
     * dialog reuses the whole autocomplete flow, so while it is open it owns these surfaces.
     */
    _originSearchTarget(): { input: HTMLInputElement | null; suggestions: HTMLElement | null } {
        if (this._isShareOriginDialogOpen()) {
            return {input: this.elements.shareOriginInput, suggestions: this.elements.shareOriginSuggestions};
        }
        return {input: this.elements.originInput, suggestions: this.elements.suggestionsContainer};
    }

    renderSuggestions(): void {
        const {input, suggestions} = this._originSearchTarget();
        if (!suggestions || !input) return;
        suggestions.innerHTML = this.state.suggestions
            .map(feature => {
                const props = feature.diana_properties;
                const displayName = this._escapeHtml(props.display_name ?? '');
                return `
        <div class="suggestion-item" role="option" tabindex="0"
             data-value="${displayName}"
             data-location_type="${this._escapeHtml(props.location_type ?? '')}"
             data-lat="${feature.geometry.coordinates[1]}" data-lon="${feature.geometry.coordinates[0]}">
          <span class="suggestion-icon" aria-hidden="true">${getLocationTypeIconHTML(props.location_type)}</span>
          <span class="suggestion-text">${displayName}</span>
        </div>`;
            }).join('');
        suggestions.style.display = this.state.suggestions.length > 0 ? 'block' : 'none';
        input.setAttribute('aria-expanded', this.state.suggestions.length > 0 ? 'true' : 'false');
    }

    /**
     * Resets a collapsible summary element to its placeholder state
     */
    _resetCollapsibleSummary(collapsible: HTMLElement | null | undefined): void {
        if (!collapsible) return;
        const wrapper = collapsible.querySelector('.summary-content-wrapper');
        if (wrapper) {
            wrapper.innerHTML = `<span class="summary-placeholder">${this.t('selectTimeSlotForSummary')}</span>`;
        }
        collapsible.classList.remove('has-summary', 'expanded');
    }

    renderConnectionResults(): void {
        this.showError(null, 'results');
        if (this.elements.topSlider) this.elements.topSlider.innerHTML = '';
        if (this.elements.bottomSlider) this.elements.bottomSlider.innerHTML = '';

        this._resetCollapsibleSummary(this.elements.collapsibleToActivity);
        this._resetCollapsibleSummary(this.elements.collapsibleFromActivity);

        if (this.elements.activityTimeBox) this.elements.activityTimeBox.innerHTML = '';


        if (this.state.toConnections.length === 0 && this.state.fromConnections.length === 0) {
            if (this.state.shareContext) {
                // Navigating away would drop the recipient on a form they were never meant
                // to see and clear the shared journey outright. Report it here instead and
                // let _handleOriginChangedInShareMode() put the previous journey back.
                this.showError(this.t('errors.api.noConnectionsFound'), 'results', true);
                return;
            }
            this.showError(this.t('errors.api.noConnectionsFound'), 'results');
            this.navigateToForm();
            this.showError(this.t('errors.api.noConnectionsFound'), 'form');
            return;
        }
        // Resolve recommended connection IDs to array indices before rendering slots
        if (this.state.toConnections.length > 0) {
            const toIdx = this.state.toConnections.findIndex(c => c.connection_id === this.state.recommendedToIndex);
            this.state.recommendedToIndex = toIdx !== -1 ? toIdx : 0;
        } else {
            this.state.recommendedToIndex = 0;
        }
        if (this.state.fromConnections.length > 0) {
            const fromIdx = this.state.fromConnections.findIndex(c => c.connection_id === this.state.recommendedFromIndex);
            this.state.recommendedFromIndex = fromIdx !== -1 ? fromIdx : 0;
        } else {
            this.state.recommendedFromIndex = 0;
        }

        // In share mode the creator's connections outrank whatever the API recommended:
        // the recipient opened this link to reach that meeting point at that time.
        // Applied here, before the sliders are drawn, so the highlighted badge, the
        // selection and the activity times all end up describing the same connection.
        this._applySharedRecommendation();

        if (this.state.toConnections.length === 0) {
            if (this.elements.responseBox) this.elements.responseBox.innerHTML = this.t('errors.api.noToConnectionsFound');
            const toSummary = this.elements.collapsibleToActivity?.querySelector('.summary-content-wrapper');
            if (toSummary) toSummary.innerHTML = `<span class="summary-placeholder">${this.t('errors.api.noToConnectionsFound')}</span>`;
        } else {
            this.calculateAnytimeConnections(this.state.toConnections, "to");
            this.renderTimeSlots('topSlider', this.state.toConnections, 'to');
        }
        if (this.state.fromConnections.length === 0) {
            if (this.elements.responseBoxBottom) this.elements.responseBoxBottom.innerHTML = this.t('errors.api.noFromConnectionsFound');
            const fromSummary = this.elements.collapsibleFromActivity?.querySelector('.summary-content-wrapper');
            if (fromSummary) fromSummary.innerHTML = `<span class="summary-placeholder">${this.t('errors.api.noFromConnectionsFound')}</span>`;
        } else {
            this.calculateAnytimeConnections(this.state.fromConnections, "from");
            this.renderTimeSlots('bottomSlider', this.state.fromConnections, 'from');
        }

        if (this.state.toConnections.length > 0) {
            this.selectConnectionByIndex('to', this.state.recommendedToIndex);
        }
        if (this.state.fromConnections.length > 0) {
            this.selectConnectionByIndex('from', this.state.recommendedFromIndex);
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

        // Refresh here too: the banner's wording depends on whether the recipient has
        // changed the origin, which can happen between renders.
        this._renderShareInfoBanner();
        this.slideToRecommendedConnections();
        this.updateScrollButtons();
    }

    /**
     * Points the recommendation at the connections the share actually names.
     *
     * The API's own `recommended_*_activity_connection` ranks by score, which is the right
     * answer for a normal search and the wrong one for a share: the recipient came here to
     * be at the creator's meeting point at the creator's meeting time, even when a
     * higher-scoring connection gets them there an hour early.
     *
     * Runs on every search rather than once on load. The case that needs it most is the
     * recipient changing their departure point — that re-searches from a different origin,
     * where the creator's own connection no longer exists and the score ranking is at its
     * least useful.
     *
     * Leaves the API's recommendation alone when nothing matches, which is the honest
     * fallback: no connection reaches the meeting point near the shared time.
     */
    _applySharedRecommendation(): void {
        const ctx = this.state.shareContext;
        if (!ctx) return;

        if (this.state.toConnections.length > 0) {
            const toIdx = findSharedConnectionIndex(
                this.state.toConnections, 'to', ctx.toConnectionStartTime, ctx.toConnectionEndTime
            );
            if (toIdx !== -1) this.state.recommendedToIndex = toIdx;
        }

        if (this.state.fromConnections.length > 0) {
            const fromIdx = findSharedConnectionIndex(
                this.state.fromConnections, 'from', ctx.fromConnectionStartTime, ctx.fromConnectionEndTime
            );
            if (fromIdx !== -1) this.state.recommendedFromIndex = fromIdx;
        }
    }

    renderTimeSlots(sliderId, connections, type) {
        const slider = this.elements[sliderId];
        if (!slider) return;
        slider.innerHTML = '';

        // Create "load earlier" button as the first item in the slider
        const earlierBtn = document.createElement('button');
        earlierBtn.id = sliderId === 'topSlider' ? 'topEarlierBtn' : 'bottomEarlierBtn';
        earlierBtn.className = 'slider-load-more-btn';
        earlierBtn.setAttribute('hidden', '');
        earlierBtn.setAttribute('aria-label', this.t('ariaLabels.loadEarlier'));
        earlierBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        earlierBtn.addEventListener('click', () => this.fetchScrollConnections(type, 'before'));
        slider.appendChild(earlierBtn);
        if (sliderId === 'topSlider') {
            this.elements.topEarlierBtn = earlierBtn;
        } else {
            this.elements.bottomEarlierBtn = earlierBtn;
        }

        let lastDate: string | null = null; // To track the date of the last processed connection

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
            // Only present when searching today with showPastConnections (the backend drops them otherwise)
            const departed = isConnectionDeparted(conn);
            const btn = document.createElement('button');
            btn.dataset.index = index; // Add index for easy targeting
            if (departed) {
                btn.classList.add('departed');
                btn.title = `${this.t('departed')} · ${duration}`;
            }

            const transfersHtml = anytime ? this.getTransportIcon("WALK") : `
                <div class="transfers-group">
                  <span>${conn.connection_transfers}</span>
                  ${this.getTransportIcon("TRSF")}
                </div>
            `;

            btn.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
                  <div style="font-size: 14px; margin-bottom: 4px; font-weight: bold;">${startTimeLocal} - ${endTimeLocal}</div>
                  <div class="slider-button-details">
                    <span>${duration}</span>
                    ${transfersHtml}
                  </div>
                </div>`;

            btn.addEventListener('click', () => this.selectConnectionByIndex(type, index));
            const isRecommended = (type === 'to' && index === this.state.recommendedToIndex) || (type === 'from' && index === this.state.recommendedFromIndex);
            if (isRecommended) btn.classList.add('active-time');
            slider.appendChild(btn);
        });

        // Create "load later" button as the last item in the slider
        const laterBtn = document.createElement('button');
        laterBtn.id = sliderId === 'topSlider' ? 'topLaterBtn' : 'bottomLaterBtn';
        laterBtn.className = 'slider-load-more-btn';
        laterBtn.setAttribute('hidden', '');
        laterBtn.setAttribute('aria-label', this.t('ariaLabels.loadLater'));
        laterBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 3L11 8L6 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        laterBtn.addEventListener('click', () => this.fetchScrollConnections(type, 'after'));
        slider.appendChild(laterBtn);
        if (sliderId === 'topSlider') {
            this.elements.topLaterBtn = laterBtn;
        } else {
            this.elements.bottomLaterBtn = laterBtn;
        }
    }


    calculateAnytimeConnections(connections, type) {
        const activityDateForCalc = this.config.multiday && type === "from" && this.state.selectedEndDate
            ? this.state.selectedEndDate
            : this.state.selectedDate;

        if (!activityDateForCalc) return;

        connections.forEach(conn => {
            if (conn.connection_anytime && conn.connection_elements && conn.connection_elements.length > 0) {
                const connectionDuration = conn.connection_elements[0].duration;
                if (type === "to") {
                    conn.connection_end_timestamp = convertLocalTimeToUTCDatetime(this.config.activityLatestStartTime ?? '23:59', activityDateForCalc, this.config.timezone);
                    conn.connection_start_timestamp = addMinutesToDate(conn.connection_end_timestamp, -connectionDuration);
                } else {
                    conn.connection_start_timestamp = convertLocalTimeToUTCDatetime(this.config.activityEarliestEndTime ?? '00:00', activityDateForCalc, this.config.timezone);
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
    _renderConnectionSummary(connection: Connection, type: string): string {
        if (!this.connectionRenderer) {
            return '';
        }
        return this.connectionRenderer.renderConnectionSummary(
            connection,
            type,
            { originInput: this.elements.originInput }
        );
    }

    _updateOppositeSlider(sourceType) {
        const { selectedToConnection, selectedFromConnection, toConnections, fromConnections } = this.state;
        const { topSlider, bottomSlider, collapsibleToActivity, collapsibleFromActivity } = this.elements;

        if (sourceType === 'to') {
            // Update 'from' slider based on 'to' selection
            const fromButtons = bottomSlider?.querySelectorAll('button') ?? [];
            if (!selectedToConnection) {
                fromButtons.forEach(btn => btn.classList.remove('disabled'));
                return;
            }
            const arrivalTime = DateTime.fromISO(selectedToConnection.connection_end_timestamp, { zone: 'utc' });

            // Disable invalid buttons
            fromConnections.forEach((fromConn, index) => {
                const departureTime = DateTime.fromISO(fromConn.connection_start_timestamp, { zone: 'utc' });
                const button = bottomSlider?.querySelector(`button[data-index="${index}"]`);
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
                        collapsibleFromActivity?.classList.remove('has-summary', 'expanded');
                    }
                    if (this.elements.responseBoxBottom) this.elements.responseBoxBottom.innerHTML = '';
                    bottomSlider?.querySelectorAll('button.active-time').forEach(btn => btn.classList.remove('active-time'));

                    // Re-render activity box with partial data
                    if (this.elements.activityTimeBox) this.elements.activityTimeBox.innerHTML = this.getActivityTimeBoxHTML();
                }
            }

        } else if (sourceType === 'from') {
            // Update 'to' slider based on 'from' selection
            const toButtons = topSlider?.querySelectorAll('button') ?? [];
            if (!selectedFromConnection) {
                toButtons.forEach(btn => btn.classList.remove('disabled'));
                return;
            }
            const departureTime = DateTime.fromISO(selectedFromConnection.connection_start_timestamp, { zone: 'utc' });

            // Disable invalid buttons
            toConnections.forEach((toConn, index) => {
                const arrivalTime = DateTime.fromISO(toConn.connection_end_timestamp, { zone: 'utc' });
                const button = topSlider?.querySelector(`button[data-index="${index}"]`);
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
                        collapsibleToActivity?.classList.remove('has-summary', 'expanded');
                    }
                    if (this.elements.responseBox) this.elements.responseBox.innerHTML = '';
                    topSlider?.querySelectorAll('button.active-time').forEach(btn => btn.classList.remove('active-time'));

                    // Re-render activity box with partial data
                    if (this.elements.activityTimeBox) this.elements.activityTimeBox.innerHTML = this.getActivityTimeBoxHTML();
                }
            }
        }
    }

    selectConnectionByIndex(type: 'to' | 'from', index: number): void {
        const connections = type === 'from' ? this.state.fromConnections : this.state.toConnections;
        const sliderId = type === 'from' ? 'bottomSlider' : 'topSlider';
        const targetBox = type === 'from' ? this.elements.responseBoxBottom : this.elements.responseBox;
        const container = type === 'to' ? this.elements.collapsibleToActivity : this.elements.collapsibleFromActivity;
        const summaryWrapper = container?.querySelector('.summary-content-wrapper');
        const slider = this.elements[sliderId];

        if (index < 0 || index >= connections.length || !slider) return;

        // A different connection means a different journey, so any share link we already
        // minted for the previous selection no longer describes what is on screen.
        this._shareUrlCache = null;

        const selectedConnection = connections[index];

        slider.querySelectorAll('button').forEach(btn => btn.classList.remove('active-time'));
        slider.querySelector(`button[data-index="${index}"]`)?.classList.add('active-time');

        this.updateActivityTimeBox(selectedConnection, type);
        if (targetBox) targetBox.innerHTML = this.renderConnectionDetails([selectedConnection], type);

        if (summaryWrapper && container) {
            summaryWrapper.innerHTML = this._renderConnectionSummary(selectedConnection, type);
            container.classList.add('has-summary');
        }

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
    }

    filterConnectionsByTime(type: 'to' | 'from', startTimeLocal: string, endTimeLocal: string): void {
        const connections = type === 'from' ? this.state.fromConnections : this.state.toConnections;
        const matchedIdx = connections.findIndex(conn =>
            convertUTCToLocalTime(conn.connection_start_timestamp, this.config.timezone) === startTimeLocal &&
            convertUTCToLocalTime(conn.connection_end_timestamp, this.config.timezone) === endTimeLocal
        );

        if (matchedIdx !== -1) {
            this.selectConnectionByIndex(type, matchedIdx);
        } else {
            const targetBox = type === 'from' ? this.elements.responseBoxBottom : this.elements.responseBox;
            const container = type === 'to' ? this.elements.collapsibleToActivity : this.elements.collapsibleFromActivity;
            const summaryWrapper = container?.querySelector('.summary-content-wrapper');
            if (targetBox) targetBox.innerHTML = `<div>${this.t('noConnectionDetails')}</div>`;
            if (summaryWrapper && container) {
                summaryWrapper.innerHTML = `<span class="summary-placeholder">${this.t('noConnectionDetails')}</span>`;
                container.classList.remove('has-summary', 'expanded');
            }
        }
    }


    /**
     * The activity boundary a share pins down, in the activity's timezone, or `null` outside
     * share mode (or when the share carries no such timestamp).
     *
     * A share stores the creator's own journey: they arrive at the meeting point at
     * `to_connection_end_time` and leave it at `from_connection_start_time`. Those two
     * instants *are* the tour's start and end for everyone holding the link — the activity's
     * generic earliest-start / latest-end window is what the creator picked within, not what
     * the recipient should be shown.
     *
     * @param {'start'|'end'} boundary - Which end of the activity to resolve.
     * @returns {DateTime|null} The instant in `config.timezone`, or null when not applicable.
     */
    _sharedActivityBoundaryDateTime(boundary: 'start' | 'end'): DateTime | null {
        const ctx = this.state.shareContext;
        if (!ctx) return null;

        const timestamp = boundary === 'start' ? ctx.toConnectionEndTime : ctx.fromConnectionStartTime;
        if (!timestamp) return null;

        const dt = DateTime.fromISO(timestamp, {zone: 'utc'}).setZone(this.config.timezone);
        return dt.isValid ? dt : null;
    }

    /** The same boundary as a local `HH:mm`, for the string-based activity time bookkeeping. */
    _sharedActivityBoundaryLocal(boundary: 'start' | 'end'): string | null {
        return this._sharedActivityBoundaryDateTime(boundary)?.toFormat('HH:mm') ?? null;
    }

    updateActivityTimeBox(connection, type) {
        if (!connection) return;
        try {
            const activityStartDate = this.state.selectedDate;
            const activityEndDate = this.config.multiday && this.state.selectedEndDate ? this.state.selectedEndDate : activityStartDate;
            if (!activityStartDate || !activityEndDate) return;

            // The connection timestamps are pre-adjusted by _processAndFilterConnections, so we use them directly.
            const connectionStartTimeLocal = convertUTCToLocalTime(connection.connection_start_timestamp, this.config.timezone);
            const connectionEndTimeLocal = convertUTCToLocalTime(connection.connection_end_timestamp, this.config.timezone);

            // In share mode the tour has a fixed meeting time and a fixed end: the creator's
            // arrival and departure. Those replace the config's earliest-start / latest-end
            // window, so a recipient travelling from elsewhere sees the *shared* start and end
            // — and any gap between their own connection and it shows up as a waiting block.
            if (type === 'to') {
                const earliestStartLocal = this._sharedActivityBoundaryLocal('start')
                    ?? convertConfigTimeToLocalTime(this.config.activityEarliestStartTime ?? '00:00', activityStartDate, this.config.timezone);
                this.state.activityTimes.start = getLaterTime(connectionEndTimeLocal, earliestStartLocal, this.config.timezone);
            } else { // type === 'from'
                const latestEndLocal = this._sharedActivityBoundaryLocal('end')
                    ?? convertConfigTimeToLocalTime(this.config.activityLatestEndTime ?? '23:59', activityEndDate, this.config.timezone);
                this.state.activityTimes.end = getEarlierTime(connectionStartTimeLocal, latestEndLocal, this.config.timezone);
            }

            if (this.elements.activityTimeBox) this.elements.activityTimeBox.innerHTML = this.getActivityTimeBoxHTML();

        } catch (error) {
            console.error("Error updating activity time box:", error);
            if (this.elements.activityTimeBox) {
                this.elements.activityTimeBox.innerHTML = `<div class="error-message">${this.t('errors.activityTimeError')}</div>`;
            }
        }
    }

    getActivityTimeBoxHTML(): string {
        try {
            const activityStartDate = this.state.selectedDate;
            const activityEndDate = this.config.multiday && this.state.selectedEndDate ? this.state.selectedEndDate : activityStartDate;
            if (!activityStartDate) return `<div class="activity-time-placeholder"></div>`;
            const recommendedDurationMinutes = parseInt(String(this.config.activityDurationMinutes), 10);

            // "Geplante Dauer: 4:00h" / "Verfügbare Zeit: 4:51h" - one labelled line each,
            // so the two are directly comparable without an icon or a tooltip to decode.
            const labelledLine = (labelKey: string, value: string) => `
                        <div class="activity-duration-line">
                            <span class="activity-duration-label">${this.t(labelKey)}:</span>
                            <span class="activity-duration-value">${value}</span>
                        </div>`;
            const plannedLine = Number.isFinite(recommendedDurationMinutes) && recommendedDurationMinutes > 0
                ? labelledLine('plannedDuration', getTimeFormatFromMinutes(recommendedDurationMinutes, (k) => this.t(k)))
                : '';

            let durationDisplayHtml;

            const isMultiDayDisplay = this.config.multiday && activityStartDate && activityEndDate &&
                DateTime.fromJSDate(activityEndDate).startOf('day') > DateTime.fromJSDate(activityStartDate).startOf('day');

            if (isMultiDayDisplay && activityEndDate) {
                const numDays = Math.round(DateTime.fromJSDate(activityEndDate).diff(DateTime.fromJSDate(activityStartDate), 'days').days) + 1;
                const numNights = numDays - 1;
                const daysText = numDays === 1 ? this.t('daySg') : this.t('dayPl');

                const spanText = numNights > 0
                    ? `${numDays} ${daysText} / ${numNights} ${numNights === 1 ? this.t('nightSg') : this.t('nightPl')}`
                    : `${numDays} ${daysText}`;
                durationDisplayHtml = `<div class="activity-duration-line"><span>${spanText}</span></div>`;
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

                    let availableText = '--';
                    if (endDateForDuration >= startDateForDuration) {
                        const durationResult = calculateDurationLocalWithDates(startDateForDuration, endDateForDuration, (key) => this.t(key));
                        this.state.activityTimes.duration = durationResult.text;
                        availableText = durationResult.text;
                    }
                    durationDisplayHtml = plannedLine + labelledLine('availableTime', availableText);
                } else {
                    // The planned duration comes from the config, so it stands before the
                    // recipient has picked anything - only the available time is unknown.
                    durationDisplayHtml = plannedLine + labelledLine('availableTime', '--');
                }
            }

            const locale = this.config.language.split('-')[0];
            const startLocationDisplay = this.config.activityStartLocationDisplayName || this.config.activityStartLocation;
            const endLocationDisplay = this.config.activityEndLocationDisplayName || this.config.activityEndLocation;

            const endDateForDisplay = activityEndDate ?? activityStartDate;
            const startDateTimeText = this.state.activityTimes.start ? `${formatLegDateForDisplay(activityStartDate.toISOString(), this.config.timezone, locale)} ${this.state.activityTimes.start}` : '--';
            const endDateTimeText = this.state.activityTimes.end ? `${formatLegDateForDisplay(endDateForDisplay.toISOString(), this.config.timezone, locale)} ${this.state.activityTimes.end}` : '--';

            // An activity with no configured name renders no title row at all, rather than an
            // empty one that would leave a gap above the duration lines.
            const activityName = resolveActivityName(this.config);
            const titleHtml = activityName ? `<div class="activity-title">${activityName}</div>` : '';

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
                        ${titleHtml}
                        ${durationDisplayHtml}
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
        // A ticket link the API already supplied is a plain link the browser opens itself.
        if (button.tagName === 'A') return;
        this.clearMessages();

        const connType = button.dataset.connType;
        const segmentIndex = button.dataset.segmentIndex;
        const connection = connType === 'to' ? this.state.selectedToConnection : this.state.selectedFromConnection;

        if (!connection) {
            console.error("No selected connection found to generate ticket link.");
            return;
        }

        // The spinner overlays the label, so the button keeps its size while loading.
        const spinner = document.createElement('span');
        spinner.className = 'loading-spinner-small';
        button.appendChild(spinner);
        button.classList.add('is-loading');
        button.setAttribute('aria-busy', 'true');
        button.disabled = true;

        try {
            const response = await this._fetchApi(`${this.config.apiBaseUrl}/generate-ticketshop-link`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    connection_elements: connection.connection_elements,
                    // Set for a ticket that covers only part of the trip (multi-segment connections)
                    ...(segmentIndex !== undefined ? {segment_index: Number(segmentIndex)} : {})
                })
            });

            const result = await response.json();
            if (result.ticketshop_url) {
                window.open(result.ticketshop_url, '_blank');
            } else {
                throw new Error('No ticketshop URL returned from the server.');
            }

        } catch (error) {
            const apiError = error as ApiError;
            if (apiError.isSessionExpired) return;
            console.error('Error fetching ticketshop link:', error);
            this.showError(apiError.message || this.t('errors.api.internalError'), 'results', true);
        } finally {
            spinner.remove();
            button.classList.remove('is-loading');
            button.removeAttribute('aria-busy');
            button.disabled = false;
        }
    }

    /**
     * Handles clicks inside leg notices, booking cards and the details header actions.
     * Toggles clamped notice texts and keeps clicks on these elements (including links)
     * from bubbling up to the collapsible container, which would otherwise close.
     * @param {Event} event - The click event.
     */
    handleLegInfoClick(event) {
        const target = event.target as HTMLElement | null;
        if (!target?.closest) return;

        const toggle = target.closest('.leg-notice__toggle') as HTMLButtonElement | null;
        if (toggle) {
            event.stopPropagation();
            const textId = toggle.getAttribute('aria-controls');
            const text = textId ? toggle.closest('.leg-notice')?.querySelector(`#${CSS.escape(textId)}`) : null;
            const expanded = toggle.getAttribute('aria-expanded') !== 'true';
            toggle.setAttribute('aria-expanded', String(expanded));
            text?.classList.toggle('is-clamped', !expanded);
            const label = toggle.querySelector('.leg-notice__toggle-label');
            if (label) label.textContent = (expanded ? toggle.dataset.labelLess : toggle.dataset.labelMore) ?? '';
            return;
        }

        if (target.closest('.leg-notice, .leg-booking, .leg-flex')) {
            event.stopPropagation();
        }
    }

    renderConnectionDetails(connections: Connection[], type: string): string {
        if (!this.connectionRenderer) {
            return `<div>${this.t('noConnectionDetails')}</div>`;
        }
        return this.connectionRenderer.renderConnectionDetails(
            connections,
            type,
            this.state,
            { originInput: this.elements.originInput }
        );
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

    getTransportIcon(type) {
        return getTransportIcon(type);
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

    slideToRecommendedConnections(): void {
        requestAnimationFrame(() => {
            if (this.elements.activityTimeBox) {
                this.elements.activityTimeBox.scrollIntoView({behavior: 'smooth', block: 'center'});
            }

            const topSlider = this.elements["topSlider"];
            if (topSlider && topSlider.querySelector('.active-time')) {
                const topActiveBtn = topSlider.querySelector('.active-time') as HTMLElement;
                const scrollPos = topActiveBtn.offsetLeft - (topSlider.offsetWidth / 2) + (topActiveBtn.offsetWidth / 2);
                topSlider.scrollTo({left: scrollPos, behavior: 'smooth'});
            }

            const bottomSlider = this.elements["bottomSlider"];
            if (bottomSlider && bottomSlider.querySelector('.active-time')) {
                const bottomActiveBtn = bottomSlider.querySelector('.active-time') as HTMLElement;
                const scrollPos = bottomActiveBtn.offsetLeft - (bottomSlider.offsetWidth / 2) + (bottomActiveBtn.offsetWidth / 2);
                bottomSlider.scrollTo({left: scrollPos, behavior: 'smooth'});
            }
        });
    }

    navigateToForm(): void {
        this.clearMessages();
        if (this.pageManager) {
            this.pageManager.navigateToForm();
        }
        this.state.toConnections = [];
        this.state.fromConnections = [];
        this.state.activityTimes = {start: '', end: '', duration: ''};

        // Reset collapsible states when going back to form
        if (this.elements.collapsibleToActivity) this.elements.collapsibleToActivity.classList.remove('expanded');
        if (this.elements.collapsibleFromActivity) this.elements.collapsibleFromActivity.classList.remove('expanded');
    }

    /**
     * Builds the `POST /share/` request body from the current selection.
     * `activity` must be present: bundled mode rejects a share without one (code 5004).
     */
    _buildSharePayload(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
        if (!this.elements.originInput) throw new Error("Origin input not available");
        if (!this.state.selectedDate) throw new Error("Selected date not available");

        const lat = this.elements.originInput.dataset.lat;
        const lon = this.elements.originInput.dataset.lon;
        const originValue = this.elements.originInput.value;

        return {
            origin: originValue,
            // Always send the human-readable value. Sending null here (the old behaviour for
            // address-typed origins) is what made restored origins come back as raw text.
            origin_display_name: originValue,
            origin_lat: lat ? parseFloat(lat) : null,
            origin_lon: lon ? parseFloat(lon) : null,
            date: formatDatetime(this.state.selectedDate, this.config.timezone), // yyyy-MM-dd
            dateEnd: this.config.multiday && this.state.selectedEndDate ? formatDatetime(this.state.selectedEndDate, this.config.timezone) : null,
            to_connection_start_time: this.state.selectedToConnection?.connection_start_timestamp ?? null,
            to_connection_end_time: this.state.selectedToConnection?.connection_end_timestamp ?? null,
            from_connection_start_time: this.state.selectedFromConnection?.connection_start_timestamp ?? null,
            from_connection_end_time: this.state.selectedFromConnection?.connection_end_timestamp ?? null,
            activity: this.state.activity ?? null,
            payload: this.state.shareContext?.payload ?? null,
            // The toggle position travels with the share, so a recipient searches the same
            // pool of services the creator did. `state.useFlex` is seeded from an inbound
            // share in _loadFromShareID(), so it is the single source of truth here.
            use_flex: this.state.useFlex,
            shareURLPrefix: this.config.shareURLPrefix,
            ...overrides,
        };
    }

    /** Identity of the current share-able selection; a change invalidates the cached share link. */
    _shareSelectionKey(): string {
        return [
            this.state.selectedToConnection?.connection_id ?? '-',
            this.state.selectedFromConnection?.connection_id ?? '-',
            this.elements.originInput?.value ?? '',
            this.state.selectedDate ? formatDatetime(this.state.selectedDate, this.config.timezone) : '',
            String(this.state.useFlex),
        ].join('|');
    }

    async handleShare() {
        this.clearMessages();

        try {
            if (!this.elements.originInput) throw new Error("Origin input not available");
            if (!this.state.selectedDate) throw new Error("Selected date not available");

            // A share without an activity object cannot be replayed via ?share_id= (5004).
            // `state.activity` is set by every successful fetchActivityData(), and the share
            // menu item is only enabled on the results page, so this is defensive.
            if (!this.state.activity) {
                this.showError(this.t('errors.shareNoActivityData'), 'results', true);
                return;
            }

            const selectionKey = this._shareSelectionKey();
            let shareId: string | undefined;

            // While a shared journey is open, its id is *the* link — passing it on must hand
            // over the very same share, even after the recipient re-planned from their own
            // departure point. A new id is only ever minted on a page that was never opened
            // from a share link.
            if (this.state.shareContext?.shareId) {
                shareId = this.state.shareContext.shareId;
            } else if (this._shareUrlCache?.key === selectionKey) {
                shareId = this._shareUrlCache.shareId;
            } else {
                const result = await this.apiService!.createShare(this._buildSharePayload());
                shareId = result?.shareId;
                if (!shareId) throw new Error(this.t('errors.shareLinkCreateFailed'));
                this._shareUrlCache = { key: selectionKey, shareId };
            }

            if (!this.config.shareURLPrefix) throw new Error("Share URL prefix not configured");
            const url = new URL(buildShareUrl(this.config.shareURLPrefix, shareId), window.location.href);

            if (navigator.share) {
                await navigator.share({
                    // Falls back to where the activity is: a share sheet with no label at
                    // all tells the recipient nothing about what they are being sent.
                    title: resolveActivityName(this.config)
                        ?? firstNonBlank(this.config.activityStartLocationDisplayName, this.config.activityStartLocation)
                        ?? undefined,
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

    /** Removes ?diana-share= from the address bar without reloading. */
    _stripShareParamFromUrl(): void {
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.has('diana-share')) {
            currentUrl.searchParams.delete('diana-share');
            window.history.replaceState(null, '', currentUrl.toString());
        }
    }

    /**
     * Abandons share mode and boots the widget normally with the host page's own config.
     * Used whenever a share cannot be honoured (invalid id, expired, past date, bad activity).
     */
    async _abandonShareAndInitNormally(infoKey?: string): Promise<void> {
        this.state.shareContext = null;
        this.config.shareId = undefined;
        this.config.readOnly = false;
        this._stripShareParamFromUrl();
        await this.initDOM();
        if (infoKey) this.showInfo(this.t(infoKey));
    }

    /** Builds the in-memory share context from a `GET /share/<id>/` response. */
    _buildShareContext(shareId: string, data: ShareDataResponse): ShareContext {
        const lat = data.origin_lat != null ? parseFloat(String(data.origin_lat)) : null;
        const lon = data.origin_lon != null ? parseFloat(String(data.origin_lon)) : null;
        return {
            shareId,
            origin: data.origin_display_name || data.origin,
            originDisplayName: data.origin_display_name ?? null,
            originLat: lat != null && !isNaN(lat) ? lat : null,
            originLon: lon != null && !isNaN(lon) ? lon : null,
            date: data.date,
            dateEnd: data.dateEnd ?? null,
            toConnectionStartTime: data.to_connection_start_time ?? null,
            toConnectionEndTime: data.to_connection_end_time ?? null,
            fromConnectionStartTime: data.from_connection_start_time ?? null,
            fromConnectionEndTime: data.from_connection_end_time ?? null,
            activity: data.activity ?? null,
            payload: data.payload ?? null,
            useFlex: data.use_flex ?? false,
        };
    }

    /**
     * Reads back what `_setOriginInputValue()` wrote. `#originInput` is the canonical
     * departure point - both `_buildActivityParams()` and the share banner read it - so
     * this is the whole state that has to be restored when a re-plan fails.
     */
    _readOriginInputValue(): OriginValue | null {
        const input = this.elements.originInput;
        if (!input) return null;
        return {
            value: input.value,
            lat: input.getAttribute('data-lat'),
            lon: input.getAttribute('data-lon'),
        };
    }

    /** Captures the connections currently on screen so a failed re-plan can put them back. */
    _snapshotConnectionState(): ConnectionSnapshot {
        return {
            toConnections: [...this.state.toConnections],
            fromConnections: [...this.state.fromConnections],
            recommendedToIndex: this.state.recommendedToIndex,
            recommendedFromIndex: this.state.recommendedFromIndex,
            activity: this.state.activity,
            hasMoreBeforeToActivity: this.state.hasMoreBeforeToActivity,
            hasMoreAfterToActivity: this.state.hasMoreAfterToActivity,
            hasMoreBeforeFromActivity: this.state.hasMoreBeforeFromActivity,
            hasMoreAfterFromActivity: this.state.hasMoreAfterFromActivity,
        };
    }

    /** Counterpart of `_snapshotConnectionState()`. The caller re-renders afterwards. */
    _restoreConnectionState(snapshot: ConnectionSnapshot): void {
        this.state.toConnections = snapshot.toConnections;
        this.state.fromConnections = snapshot.fromConnections;
        this.state.recommendedToIndex = snapshot.recommendedToIndex;
        this.state.recommendedFromIndex = snapshot.recommendedFromIndex;
        this.state.activity = snapshot.activity;
        this.state.hasMoreBeforeToActivity = snapshot.hasMoreBeforeToActivity;
        this.state.hasMoreAfterToActivity = snapshot.hasMoreAfterToActivity;
        this.state.hasMoreBeforeFromActivity = snapshot.hasMoreBeforeFromActivity;
        this.state.hasMoreAfterFromActivity = snapshot.hasMoreAfterFromActivity;
    }

    /**
     * Writes a value (and its optional coordinates) into the origin input and syncs the
     * clear / current-location icons. Passing an empty value clears the field.
     */
    _setOriginInputValue(value: string, lat: number | string | null, lon: number | string | null): void {
        const input = this.elements.originInput;
        if (!input) return;

        input.value = value;
        if (value && lat != null && lat !== '' && lon != null && lon !== '') {
            input.setAttribute('data-lat', String(lat));
            input.setAttribute('data-lon', String(lon));
        } else {
            input.removeAttribute('data-lat');
            input.removeAttribute('data-lon');
        }

        if (this.elements.clearInputBtn && this.elements.currentLocationBtn) {
            this.elements.clearInputBtn.style.display = value ? 'block' : 'none';
            this.elements.currentLocationBtn.style.display = value ? 'none' : 'block';
        }
    }

    /**
     * Loads a shared journey.
     *
     * The share is fetched *before* initDOM() so the shared activity data can be written
     * over the local config: the templates stringify the config exactly once, so an
     * override applied after DOM init would have no effect. This is what makes a share
     * link reproduce the creator's tour on any host page, regardless of how that page
     * configured the widget.
     */
    async _loadFromShareID(shareId: string): Promise<void> {
        if (!isValidShareId(shareId)) {
            await this._abandonShareAndInitNormally();
            return;
        }

        let data: ShareDataResponse;
        try {
            data = await this.apiService!.fetchShare(shareId);
        } catch (error) {
            if (error.isSessionExpired) return;
            // 5001 (unknown/expired) and any other retrieval failure: fall back to a
            // normally-configured widget rather than leaving a dead one behind.
            console.warn("Could not load shared journey, falling back to normal mode:", error);
            await this._abandonShareAndInitNormally('errors.shareLinkInvalidExpired');
            return;
        }

        const ctx = this._buildShareContext(shareId, data);

        // Snapshot the config so a share carrying unusable activity data can be rolled back.
        const configSnapshot = { ...this.config };

        if (ctx.activity) {
            applySharedActivityToConfig(ctx.activity, data, this.config);

            const validation = validateConfig(this.config);
            if (validation.errors.length > 0) {
                console.warn("Shared activity data failed validation, using local config instead:", validation.errors);
                this.config = configSnapshot;
                ctx.activity = null;
            } else {
                this.config = validation.config;
            }
        }

        // Dates always come from the share, even for legacy shares with no activity object.
        const sharedDate = DateTime.fromISO(data.date, {zone: 'utc'}).startOf('day');
        const sharedDateEnd = data.dateEnd ? DateTime.fromISO(data.dateEnd, {zone: 'utc'}).startOf('day') : null;
        // "Today" in the activity's own timezone, expressed as UTC midnight so it is
        // directly comparable to the calendar dates above.
        const todayIso = DateTime.now().setZone(this.config.timezone).toISODate() as string;
        const today = DateTime.fromISO(todayIso, {zone: 'utc'}).startOf('day');

        if (!sharedDate.isValid || sharedDate < today) {
            this.config = configSnapshot;
            await this._abandonShareAndInitNormally('infos.sharedDateInPast');
            return;
        }
        if (sharedDateEnd && (!sharedDateEnd.isValid || sharedDateEnd < sharedDate)) {
            this.config = configSnapshot;
            await this._abandonShareAndInitNormally('infos.sharedDateInPast');
            return;
        }

        this.state.selectedDate = sharedDate.toJSDate();
        this.state.selectedEndDate = this.config.multiday && sharedDateEnd ? sharedDateEnd.toJSDate() : null;

        this.state.shareContext = ctx;
        this.state.activity = ctx.activity;

        // A host-page origin override must not survive into share mode: it would overwrite
        // the origin chosen below and (when the field is disabled) stop the recipient
        // changing where they travel from. The recipient's *own* saved start location is a
        // different matter - it is their own last choice and it beats the share's origin
        // (see resolveShareOrigin below), so caching stays on: reading it seeds the first
        // search, and writing it keeps a later pick from the "change departure point"
        // dialog for next time.
        this.config.overrideUserStartLocation = null;
        this.config.overrideUserStartLocationType = null;
        this.config.disableUserStartLocationField = false;

        // Must be set before initDOM(): the form template stringifies the toggle's checked
        // state once, so the recipient sees the same on-demand setting the creator shared.
        this.state.useFlex = ctx.useFlex;

        await this.initDOM();

        // A share recipient opened a link to one specific journey - the search form is
        // never theirs to see. Go to the results page immediately and let the skeleton
        // stand in for the connections until they arrive.
        this.navigateToResults();
        this._setResultsSkeletonVisible(true);

        // Read the cache explicitly rather than inspecting what initDOM() left in the field:
        // the form template also seeds #originInput from config.userStartLocationDefault,
        // which is not the recipient's saved location and must not beat the share's origin.
        const shareOrigin = resolveShareOrigin(this._getCachedStartLocation(), ctx);
        this._setOriginInputValue(shareOrigin.value, shareOrigin.lat, shareOrigin.lon);

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
            this._updateSingleDayDateButtonStates();
        }

        this._renderShareInfoBanner();

        // The baseline a failed "change departure point" rolls back to. Seeded before the
        // first search, with the origin actually being searched, so it exists even if that
        // search fails.
        this._lastSearchedOrigin = this._readOriginInputValue();

        // Search straight away: the recipient was sent a journey and must be able to see it
        // before deciding anything. Changing the departure point is offered afterwards, from
        // the share info banner (see _showShareOriginDialog).
        try {
            const searched = await this._runSharedSearch();

            // The saved start location is keyed per container, not per activity, so a stale
            // entry can belong to a different city entirely. When it finds nothing, fall
            // back once to the origin the share was created with rather than handing the
            // recipient an error page for a perfectly good link.
            const foundNothing = this.state.toConnections.length === 0 && this.state.fromConnections.length === 0;
            if (searched && shareOrigin.fromCache && foundNothing && ctx.origin) {
                this._setOriginInputValue(ctx.origin, ctx.originLat, ctx.originLon);
                this._renderShareInfoBanner();
                this._lastSearchedOrigin = this._readOriginInputValue();
                await this._runSharedSearch();
            }
        } finally {
            this._setResultsSkeletonVisible(false);
        }
    }

    /**
     * Paints a styled skeleton before any of the real DOM exists.
     *
     * Opening a share link starts with `GET /share/<id>/`, which happens before initDOM()
     * because the shared activity data has to be written over the config first. Without
     * this the host page shows an empty box for that whole roundtrip. initDOM(),
     * _showFatalError() and _abandonShareAndInitNormally() all clear the shadow root
     * before rendering, so this is replaced cleanly whichever way the load ends.
     */
    _showBootSkeleton(): void {
        if (!this.shadowRoot) return;

        const styleTag = document.createElement('style');
        styleTag.textContent = styles;
        this.shadowRoot.appendChild(styleTag);

        const bootContainer = document.createElement('div');
        bootContainer.className = 'diana-container';
        // The activity name is not known yet (it arrives with the share), so the header is
        // a placeholder bar rather than the real one initDOM() will render.
        bootContainer.innerHTML = `
          <div class="modal visible">
            <div class="modal-content">
              <div id="resultsPage" class="modal-page active is-loading">
                <div class="modal-body-result">
                  <div class="slider-wrapper etc">
                    <div class="skeleton-boot-header">
                      <span class="skeleton-block skeleton-line skeleton-line-sm"></span>
                    </div>
                  </div>
                  ${getResultsSkeletonHTML({t: (key) => this.t(key)})}
                </div>
              </div>
            </div>
          </div>
        `;
        this.shadowRoot.appendChild(bootContainer);
        this.dianaWidgetRootContainer = bootContainer;
        this._applyExternalStyles();
    }

    /**
     * Runs the search for a shared journey, reporting failures as a share-load error.
     *
     * @returns false when the request itself failed. Empty connection lists are *not* a
     *          failure - callers that retry from a different origin need to tell the two
     *          apart, since a transport error says nothing about the departure point.
     */
    async _runSharedSearch(): Promise<boolean> {
        try {
            await this.handleSearch();
            return true;
        } catch (error) {
            if (error.isSessionExpired) return false;
            console.error("Failed to load connections for shared journey:", error);
            this._showFatalError(this.t('errors.shareLinkErrorTitle'), error.message, "info", true);
            return false;
        }
    }

    _isShareOriginDialogOpen(): boolean {
        return this.elements.shareOriginOverlay?.classList.contains('visible') === true;
    }

    /**
     * Opens the "change departure point" dialog over the results, so the shared journey
     * stays visible behind it. Never opened automatically — only from the banner button.
     */
    _showShareOriginDialog(): void {
        const overlay = this.elements.shareOriginOverlay;
        const ctx = this.state.shareContext;
        if (!overlay || !ctx) return;

        if (this.elements.shareOriginText) {
            this.elements.shareOriginText.textContent = this.t('shareOriginDialog.hint', {origin: ctx.origin});
        }
        this._setShareOriginStatus(null);

        // Start from what is currently in effect, pre-selected so typing replaces it.
        if (this.elements.shareOriginInput) {
            this.elements.shareOriginInput.value = this.elements.originInput?.value ?? '';
        }
        this.state.suggestions = [];

        overlay.style.display = 'flex';
        overlay.classList.add('visible');
        // renderSuggestions() targets the dialog only once it is marked visible.
        this.renderSuggestions();

        this.elements.shareOriginInput?.focus();
        this.elements.shareOriginInput?.select();
    }

    _hideShareOriginDialog(): void {
        const overlay = this.elements.shareOriginOverlay;
        if (!overlay) return;
        this.state.suggestions = [];
        this.renderSuggestions();
        overlay.classList.remove('visible');
        overlay.style.display = 'none';
        this._setShareOriginStatus(null);
    }

    /**
     * The dialog covers the pages, so it needs its own message line: showInfo/showError
     * write into containers that live on the form and results pages behind it.
     */
    _setShareOriginStatus(message: string | null, isError = false): void {
        const el = this.elements.shareOriginStatus;
        if (!el) return;
        el.textContent = message ?? '';
        el.classList.toggle('is-error', !!message && isError);
        el.style.display = message ? 'block' : 'none';
    }

    /** Binds the change-departure-point dialog. The share id and the tour never change here. */
    _setupShareOriginDialogListeners(): void {
        const overlay = this.elements.shareOriginOverlay;
        if (!overlay) return;

        const close = () => this._hideShareOriginDialog();

        this.elements.shareOriginCloseBtn?.addEventListener('click', close);
        this.elements.shareOriginCancelBtn?.addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
        overlay.addEventListener('keydown', (e) => {
            if ((e as KeyboardEvent).key === 'Escape') close();
        });

        if (this.elements.shareOriginInput) {
            this.elements.shareOriginInput.addEventListener('input', (e) => {
                this._setShareOriginStatus(null);
                this.debouncedHandleAddressInput((e.target as HTMLInputElement).value.trim());
            });
            this.elements.shareOriginInput.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') this.handleSuggestionNavigation(e);
                else if (e.key === 'Enter') this.handleSuggestionEnter(e);
            });
        }

        this.elements.shareOriginSuggestions?.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const item = target.closest('.suggestion-item') as HTMLElement | null;
            if (item) {
                this.handleSuggestionSelect(item.dataset.value, item.dataset.lat, item.dataset.lon);
            }
        });

        this.elements.shareOriginLocationBtn?.addEventListener('click', () => {
            void this.handleCurrentLocation();
        });
    }

    /**
     * Called when the user picks a new origin while viewing a shared journey.
     *
     * The share id deliberately stays the same — it is the link the recipient was given and
     * the one they pass on. `GET /connections?share_id=…` treats the recipient's own
     * `user_start_location` as an override while the backend keeps using the *stored*
     * arrival time as the consumer-mode arrive-by target, so re-planning from somewhere
     * else still lands on the creator's meeting time.
     */
    async _handleOriginChangedInShareMode(): Promise<void> {
        if (!this.state.shareContext) return;

        // The creator's meeting time still governs: renderConnectionResults() re-applies
        // the shared selection against whatever the new origin returns.
        this._renderShareInfoBanner();

        // Two quick origin changes fire two overlapping /connections requests. Only the
        // newest may paint - and, crucially, only the newest may roll anything back.
        const token = ++this._originSearchToken;
        const previousOrigin = this._lastSearchedOrigin;
        const previousResults = this._snapshotConnectionState();

        this._setResultsSkeletonVisible(true);

        let failure: string | null = null;
        try {
            // handleSearch() reports its own transport/API errors through
            // _activeMessagePage(), i.e. onto the results page the recipient is looking at.
            await this.handleSearch();
            if (this.state.toConnections.length === 0 && this.state.fromConnections.length === 0) {
                failure = this.t('errors.shareOriginNoConnections');
            }
        } catch (error) {
            if (error?.isSessionExpired) return;
            console.error("Search after origin change failed:", error);
            failure = this.t('errors.shareOriginSearchFailed');
        } finally {
            if (token === this._originSearchToken) this._setResultsSkeletonVisible(false);
        }

        if (token !== this._originSearchToken) return;

        if (failure) {
            // Put the recipient back where they were: same departure point, same journey.
            // renderConnectionResults() has already cleared the sliders by this point, so
            // the previous connections have to be re-rendered, not merely left alone.
            if (previousOrigin) {
                this._setOriginInputValue(previousOrigin.value, previousOrigin.lat, previousOrigin.lon);
            }
            this._restoreConnectionState(previousResults);
            this._renderShareInfoBanner();
            if (previousResults.toConnections.length > 0 || previousResults.fromConnections.length > 0) {
                this.renderConnectionResults();
            }
            this.showError(failure, 'results', true);
            return;
        }

        this._lastSearchedOrigin = this._readOriginInputValue();
    }

    /** Escapes API- and user-supplied text before it goes into an innerHTML string. */
    _escapeHtml(value: string): string {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Renders the share info banner (results page only): which meeting point and time the
     * creator planned, the departure point currently in effect, and a button to change it.
     * Also drives the visibility of the "leave share mode" button.
     */
    _renderShareInfoBanner(): void {
        const ctx = this.state.shareContext;
        const banner = this.elements.shareInfoBanner;
        if (!banner) return;

        if (!ctx) {
            banner.style.display = 'none';
            banner.innerHTML = '';
            return;
        }

        const locale = {EN: 'en-GB', DE: 'de-DE', FR: 'fr-FR', IT: 'it-IT', TH: 'th-TH', ES: 'es-ES'}[this.config.language] || 'en-GB';
        const parts: string[] = [];

        if (ctx.toConnectionEndTime) {
            const meetingLocation = firstNonBlank(this.config.activityStartLocationDisplayName, this.config.activityName, this.config.activityStartLocation);
            const meetingTime = convertUTCToLocalTime(ctx.toConnectionEndTime, this.config.timezone);
            const meetingDate = formatLegDateForDisplay(ctx.toConnectionEndTime, this.config.timezone, this.config.language, 'dd.MM.yyyy');
            const originChanged = !!this.elements.originInput
                && this.elements.originInput.value !== ctx.origin;

            parts.push(this.t(
                originChanged ? 'shareInfo.meetingPointChangedOrigin' : 'shareInfo.meetingPoint',
                {
                    location: this._escapeHtml(meetingLocation ?? ''),
                    date: this._escapeHtml(meetingDate || DateTime.fromISO(ctx.date).setLocale(locale).toFormat('dd.MM.yyyy')),
                    time: this._escapeHtml(meetingTime),
                    origin: this._escapeHtml(this.elements.originInput?.value ?? ''),
                }
            ));
        }

        if (ctx.fromConnectionStartTime) {
            parts.push(this.t('shareInfo.tourEnd', {
                location: this._escapeHtml(firstNonBlank(this.config.activityEndLocationDisplayName, this.config.activityName, this.config.activityEndLocation) ?? ''),
                date: this._escapeHtml(formatLegDateForDisplay(ctx.fromConnectionStartTime, this.config.timezone, this.config.language, 'dd.MM.yyyy')),
                time: this._escapeHtml(convertUTCToLocalTime(ctx.fromConnectionStartTime, this.config.timezone)),
            }));
        }

        // The departure point currently in effect, with the affordance to change it. This is
        // the only place a share recipient can re-plan from somewhere else, so it sits right
        // under the journey it applies to rather than behind a blocking dialog on load.
        const currentOrigin = this.elements.originInput?.value ?? '';
        const originRow = `
            <div class="share-origin-row">
                <div class="share-origin-current">
                    <span class="share-origin-current-label">${this._escapeHtml(this.t('origin'))}</span>
                    <span class="share-origin-current-value">${this._escapeHtml(currentOrigin)}</span>
                </div>
                <button type="button" class="share-origin-change-btn" data-action="change-share-origin">${this._escapeHtml(this.t('shareOriginDialog.change'))}</button>
            </div>`;

        banner.innerHTML = parts.map(p => `<p>${p}</p>`).join('') + originRow;
        banner.style.display = 'block';
    }


    showMenuModal() {
        if (this.elements.menuModalOverlay) {
            this.elements.menuModalOverlay.style.display = 'flex';
            // Use requestAnimationFrame to ensure the display property has been applied before adding the class for transition
            requestAnimationFrame(() => {
                this.elements.menuModalOverlay?.classList.add('visible');
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
        const language = this.config.language && helpContent[this.config.language]
            ? this.config.language
            : 'EN';

        switch (this.state.currentContentKey) {
            case 'help':
                title = this.t('menu.helpAndSupport');
                contentHTML = helpContent[language];
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


    setLoadingState(isLoading: boolean, isFullScreen: boolean = false): void {
        if (isFullScreen) {
            let loader = this.dianaWidgetRootContainer?.querySelector('.full-screen-loader') as HTMLElement | null;
            if (isLoading) {
                if (!loader) {
                    loader = document.createElement('div');
                    loader.className = 'full-screen-loader';
                    loader.innerHTML = `
                        <div class="loading-spinner"></div>
                        <span>${this.t("loadingStateSearching")}</span>
                    `;
                    this.dianaWidgetRootContainer?.appendChild(loader);
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

    /**
     * The page whose message containers are actually on screen. Errors and info raised
     * during a shared-journey re-plan must land on the results page, because the form
     * page the widget normally reports to is never shown to a share recipient.
     */
    _activeMessagePage(): 'form' | 'results' {
        return this.elements.resultsPage?.classList.contains('active') ? 'results' : 'form';
    }

    /**
     * Shows or hides the results-page loading skeleton. `is-loading` hides the real
     * sliders and content area, so the skeleton takes their place while the widget
     * header above it stays visible.
     */
    _setResultsSkeletonVisible(visible: boolean): void {
        this.elements.resultsPage?.classList.toggle('is-loading', visible);
    }

    showError(message: string | null, page = 'form', preserveContent = false, rawError: Response | null = null) {
        this.state.error = message;
        // The change-origin dialog overlays the pages, so it owns the message surface.
        if (this._isShareOriginDialogOpen()) this._setShareOriginStatus(message, true);
        const errorContainer = page === 'form' ? this.elements.formErrorContainer : this.elements.resultsErrorContainer;
        const debugContainer = page === 'form' ? this.elements.formDebugContainer : this.elements.resultsDebugContainer;

        if (errorContainer) {
            errorContainer.textContent = message ?? '';
            errorContainer.style.display = message ? "block" : "none";
            if (message) {
                errorContainer.setAttribute('role', 'alert');
            } else {
                errorContainer.removeAttribute('role');
            }
        }

        if (debugContainer) {
            if (this.config.dev && rawError && typeof rawError.clone === 'function') {
                debugContainer.style.display = 'block';
                // Use async IIFE for cleaner async handling
                (async () => {
                    const clonedError = rawError.clone();
                    let content: string;
                    try {
                        const json = await clonedError.json();
                        content = JSON.stringify(json, null, 2);
                    } catch {
                        content = await clonedError.text();
                    }
                    this.renderDebugContent(debugContainer, content);
                })();
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

    /**
     * Renders debug content with toggle functionality
     * @param container - The container element for debug content
     * @param content - The content to display
     */
    private renderDebugContent(container: HTMLElement, content: string): void {
        container.innerHTML = `
            <div class="debug-toggle">${this.t('debug.showDetails')}</div>
            <div class="debug-content" style="display:none;">
                <pre>${content}</pre>
            </div>`;
        container.querySelector('.debug-toggle')?.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const contentEl = target.nextElementSibling as HTMLElement;
            const isVisible = contentEl.style.display === 'block';
            contentEl.style.display = isVisible ? 'none' : 'block';
            target.textContent = isVisible ? this.t('debug.showDetails') : this.t('debug.hideDetails');
        });
    }

    showInfo(message) {
        this.state.info = message;
        // The change-origin dialog overlays the pages, so it owns the message surface.
        if (this._isShareOriginDialogOpen()) this._setShareOriginStatus(message);

        // Written to whichever page is on screen: a share recipient re-planning their
        // journey never sees the form page, so its #infoContainer would be a dead end.
        const containers = [this.elements.infoContainer, this.elements.resultsInfoContainer];
        const target = this._activeMessagePage() === 'results'
            ? this.elements.resultsInfoContainer
            : this.elements.infoContainer;

        containers.forEach(container => {
            if (!container) return;
            const text = container === target ? (message ?? '') : '';
            container.textContent = text;
            container.style.display = text ? "block" : "none";
            if (text) {
                container.setAttribute('role', 'status');
            } else {
                container.removeAttribute('role');
            }
        });

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
                        if (this.state.selectedEndDate && this.state.selectedDate && DateTime.fromJSDate(this.state.selectedEndDate).startOf('day') < DateTime.fromJSDate(this.state.selectedDate).startOf('day')) this.showInfo(this.t('infos.endDateAfterStartDate'));
                    },
                    this.config.overrideActivityStartDate ?? null, this.config.overrideActivityEndDate ?? null, this.config.activityDurationDaysFixed ?? null
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
                this.rangeCalendarModal?.show(this.state.selectedDate, this.state.selectedEndDate);
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
                    const target = e.target as HTMLInputElement;
                    const [y, m, d] = target.value.split('-').map(Number);
                    const nSD = new Date(Date.UTC(y, m - 1, d));
                    this.state.selectedDate = nSD;
                    this.updateDateDisplay(nSD, 'dateDisplayStart');
                    if (this.config.activityDurationDaysFixed) {
                        this.state.selectedEndDate = DateTime.fromJSDate(nSD).plus({days: this.config.activityDurationDaysFixed - 1}).toJSDate();
                        if (this.elements.activityDateEnd && this.state.selectedEndDate) this.elements.activityDateEnd.value = formatDatetime(this.state.selectedEndDate);
                        if (this.state.selectedEndDate) this.updateDateDisplay(this.state.selectedEndDate, 'dateDisplayEnd');
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
                    const target = e.target as HTMLInputElement;
                    const [y, m, d] = target.value.split('-').map(Number);
                    const nED = new Date(Date.UTC(y, m - 1, d));
                    this.state.selectedEndDate = nED;
                    this.updateDateDisplay(nED, 'dateDisplayEnd');
                    if (this.state.selectedDate && nED < this.state.selectedDate) { // If new end date is before start date
                        this.state.selectedDate = new Date(nED.valueOf()); // Adjust start date to be same as end date
                        if (this.elements.activityDateStart) this.elements.activityDateStart.value = formatDatetime(this.state.selectedDate);
                        this.updateDateDisplay(this.state.selectedDate, 'dateDisplayStart');
                    }
                    this.clearMessages();
                    if (this.state.selectedEndDate && this.state.selectedDate && DateTime.fromJSDate(this.state.selectedEndDate).startOf('day') < DateTime.fromJSDate(this.state.selectedDate).startOf('day')) this.showInfo(this.t('infos.endDateAfterStartDate'));
                });
            }


            if (this.config.overrideActivityStartDate && this.elements.dateDisplayStart && this.state.selectedDate) this.updateDateDisplay(this.state.selectedDate, 'dateDisplayStart');
            if (this.config.overrideActivityEndDate && this.elements.dateDisplayEnd && this.state.selectedEndDate) this.updateDateDisplay(this.state.selectedEndDate, 'dateDisplayEnd');

            if (datesFullyDetermined) {
                if (this.elements.dateDisplayStart && this.state.selectedDate) this.updateDateDisplay(this.state.selectedDate, 'dateDisplayStart');
                if (this.elements.dateDisplayEnd && this.state.selectedEndDate) this.updateDateDisplay(this.state.selectedEndDate, 'dateDisplayEnd');
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
                    const today = new Date(today_object.year ?? new Date().getFullYear(), (today_object.month ?? 1) - 1, today_object.day ?? 1);
                    this.onDateSelectedByButton(today);
                });

                this.elements.dateBtnTomorrow?.addEventListener('click', () => {
                    const tomorrow_object = DateTime.now().setZone(this.config.timezone).plus({days: 1}).startOf('day').toObject();
                    const tomorrow = new Date(tomorrow_object.year ?? new Date().getFullYear(), (tomorrow_object.month ?? 1) - 1, tomorrow_object.day ?? 1);
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
                        const target = e.target as HTMLInputElement;
                        if (target.value) {
                            const [year, month, day] = target.value.split('-').map(Number);
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
                if (isoDate) {
                    this.config.onDateChange(isoDate);
                }
            } catch (e) {
                console.error("Error executing onDateChange callback:", e);
            }
        }
    }

    _updateSingleDayDateButtonStates() {
        if (this.config.multiday || !this.elements.dateBtnToday || !this.elements.dateBtnTomorrow || !this.elements.dateBtnOther || !this.elements.otherDateText) {
            return; // Not applicable for multiday or if elements are missing
        }

        const currentYear = new Date().getFullYear();
        const today_object = DateTime.now().setZone(this.config.timezone).startOf('day').toObject();
        const today = new Date(today_object.year ?? currentYear, (today_object.month ?? 1) - 1, today_object.day ?? 1);
        const tomorrow_object = DateTime.now().setZone(this.config.timezone).plus({days: 1}).startOf('day').toObject();
        const tomorrow = new Date(tomorrow_object.year ?? currentYear, (tomorrow_object.month ?? 1) - 1, tomorrow_object.day ?? 1);
        const selected_object = this.state.selectedDate ? DateTime.fromJSDate(this.state.selectedDate).setZone(this.config.timezone).startOf('day').toObject() : null;
        const selected = selected_object ? new Date(selected_object.year ?? currentYear, (selected_object.month ?? 1) - 1, selected_object.day ?? 1) : null;

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
