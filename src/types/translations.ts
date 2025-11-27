/**
 * Translation types for DianaWidget
 */

import type { Language } from './config';

/**
 * Menu translations
 */
export interface MenuTranslations {
    helpAndSupport: string;
    helpAndSupportSubtitle: string;
    imprint: string;
}

/**
 * Warning translations
 */
export interface WarningTranslations {
    earlyStart: string;
    lateEnd: string;
    duration: string;
    durationShort: string;
    durationShorter: string;
    durationLonger: string;
}

/**
 * Info message translations
 */
export interface InfoTranslations {
    originRequired: string;
    dateRequired: string;
    endDateRequired: string;
    fetchingLocation: string;
    fetchingAddress: string;
    endDateAfterStartDate: string;
    sharedDateInPast: string;
    sharedDateDurationMismatch: string;
    shareLinkInvalid: string;
}

/**
 * API error translations
 */
export interface ApiErrorTranslations {
    internalError: string;
    queryParamMissing: string;
    invalidLimitParam: string;
    networkError: string;
    apiUnreachable: string;
    invalidUserStartCoordinates: string;
    geocodeUserStartFailed: string;
    unsupportedUserStartType: string;
    invalidActivityStartCoordinates: string;
    geocodeActivityStartFailed: string;
    unsupportedActivityStartType: string;
    invalidActivityEndCoordinates: string;
    geocodeActivityEndFailed: string;
    unsupportedActivityEndType: string;
    noToConnectionsFound: string;
    noFromConnectionsFound: string;
    noFromConnectionsFoundFallback: string;
    noFromConnectionsFoundFallbackNotToday: string;
    toConnectionsNoScore: string;
    fromConnectionsNoScore: string;
    noToConnectionsMergingMightFail: string;
    noFromConnectionsMergingMightFail: string;
    noToConnectionsMergingFailed: string;
    noFromConnectionsMergingFailed: string;
    noToConnectionsTimeWindow: string;
    noFromConnectionsTimeWindow: string;
    noToConnectionsAfterCurrentTime: string;
    noToConnectionsFilteredByDuration: string;
    noFromConnectionsFilteredByDuration: string;
    noReturnConnectionMatchingIncoming: string;
    reverseGeocodeParameterMissing: string;
    sharedLinkInvalid: string;
    monthlyQuotaExceeded: string;
    noConnectionsFound: string;
    invalidDataReceived: string;
    unknown: string;
}

/**
 * Error translations
 */
export interface ErrorTranslations {
    sessionExpired: string;
    connectionError: string;
    suggestionError: string;
    activityTimeError: string;
    geolocationError: string;
    geolocationNotSupported: string;
    geolocationPermissionDenied: string;
    geolocationPositionUnavailable: string;
    geolocationTimeout: string;
    reverseGeocodeNoResults: string;
    shareLinkInvalidExpired: string;
    shareLinkCreateFailed: string;
    shareLinkErrorTitle: string;
    widgetLoadErrorTitle: string;
    api: ApiErrorTranslations;
}

/**
 * Debug translations
 */
export interface DebugTranslations {
    showDetails: string;
    hideDetails: string;
}

/**
 * ARIA label translations
 */
export interface AriaLabelTranslations {
    topSlider: string;
    bottomSlider: string;
    searchButton: string;
    backButton: string;
    previousMonthButton: string;
    nextMonthButton: string;
    menuButton: string;
    menuHeading: string;
    closeButton: string;
    shareButton: string;
}

/**
 * Waiting translations
 */
export interface WaitingTranslations {
    beforeActivity: string;
    afterActivity: string;
    title: string;
}

/**
 * Vehicle type translations
 */
export interface VehicleTranslations {
    '1': string;
    '2': string;
    '3': string;
    '4': string;
    '5': string;
    '6': string;
    '7': string;
    '8': string;
    '9': string;
    '10': string;
    '20': string;
    '30': string;
    '31': string;
    '32': string;
    '33': string;
    'WALK': string;
    'TRSF': string;
}

/**
 * Alert translations
 */
export interface AlertTranslations {
    label: string;
}

/**
 * Complete translation object for a single language
 */
export interface LanguageTranslations {
    origin: string;
    enterOrigin: string;
    destination: string;
    activityDate: string;
    activityStartDateLabel: string;
    activityEndDateLabel: string;
    search: string;
    selectDate: string;
    datePickerTitle: string;
    apply: string;
    cancel: string;
    back: string;
    reloadPage: string;
    journeyToActivity: string;
    journeyFromActivity: string;
    selectTimeSlotForSummary: string;
    loadingConnectionsI: string;
    loadingConnectionsO: string;
    loadingStateSearching: string;
    loadingStateToActivity: string;
    loadingStateFromActivity: string;
    noConnections: string;
    anytime: string;
    anytimeLeaveBy: string;
    anytimeWalkTo: string;
    transfers: string;
    stopSg: string;
    stopPl: string;
    daySg: string;
    dayPl: string;
    nightSg: string;
    nightPl: string;
    durationHoursShort: string;
    durationHoursLong: string;
    durationMinutesShort: string;
    durationMinutesLong: string;
    durationTransferTime: string;
    activityStart: string;
    activityEnd: string;
    activityDuration: string;
    dateRangeLabel: string;
    noConnectionDetails: string;
    noConnectionElements: string;
    selectTimeSlot: string;
    useCurrentLocation: string;
    clearInput: string;
    selectDateRange: string;
    today: string;
    tomorrow: string;
    otherDate: string;
    share: string;
    shareUrlCopied: string;
    shareUrlCopyFailed: string;
    live: string;
    liveConnection: string;
    platform: string;
    direction: string;
    buyTicket: string;
    menu: MenuTranslations;
    warnings: WarningTranslations;
    infos: InfoTranslations;
    errors: ErrorTranslations;
    debug: DebugTranslations;
    months: string[];
    shortDays: string[];
    ariaLabels: AriaLabelTranslations;
    waiting: WaitingTranslations;
    vehicles: VehicleTranslations;
    alert: AlertTranslations;
}

/**
 * Full translations object with all languages
 */
export type Translations = Record<Language, LanguageTranslations>;

/**
 * Translation function type
 */
export type TranslationFunction = (keyPath: string, replacements?: Record<string, string>) => string | string[];
