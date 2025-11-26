/**
 * Default configuration values and constants for DianaWidget
 */

import type { WidgetConfig, WidgetState } from '../types';

/**
 * Default API base URL
 */
export const DEFAULT_API_BASE_URL = 'https://api.zuugle-services.net';

/**
 * Default timezone
 */
export const DEFAULT_TIMEZONE = 'Europe/Vienna';

/**
 * Default language
 */
export const DEFAULT_LANGUAGE = 'EN';

/**
 * Default cache TTL for user start location (in minutes)
 */
export const DEFAULT_CACHE_TTL_MINUTES = 15;

/**
 * Debounce delay for address input (in milliseconds)
 */
export const ADDRESS_INPUT_DEBOUNCE_MS = 700;

/**
 * Minimum query length for address autocomplete
 */
export const MIN_AUTOCOMPLETE_QUERY_LENGTH = 2;

/**
 * Cache key prefix for user start location
 */
export const CACHE_KEY_PREFIX = 'diana_user_start_location_';

/**
 * Valid location types
 */
export const VALID_LOCATION_TYPES = ['coordinates', 'coord', 'coords', 'address', 'station'] as const;

/**
 * Type for valid location types
 */
export type ValidLocationType = typeof VALID_LOCATION_TYPES[number];

/**
 * Coordinate-based location types
 */
export const COORDINATE_LOCATION_TYPES = ['coordinates', 'coord', 'coords'] as const;

/**
 * Type for coordinate location types
 */
export type CoordinateLocationType = typeof COORDINATE_LOCATION_TYPES[number];

/**
 * Type guard for checking if a value is a valid location type
 */
export function isValidLocationType(value: unknown): value is ValidLocationType {
    return typeof value === 'string' && (VALID_LOCATION_TYPES as readonly string[]).includes(value);
}

/**
 * Type guard for checking if a value is a coordinate location type
 */
export function isCoordinateLocationType(value: unknown): value is CoordinateLocationType {
    return typeof value === 'string' && (COORDINATE_LOCATION_TYPES as readonly string[]).includes(value);
}

/**
 * Required configuration fields
 */
export const REQUIRED_CONFIG_FIELDS = [
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
] as const;

/**
 * Time fields that require validation
 */
export const TIME_CONFIG_FIELDS = [
    'activityEarliestStartTime',
    'activityLatestStartTime',
    'activityEarliestEndTime',
    'activityLatestEndTime'
] as const;

/**
 * Default widget configuration
 */
export const DEFAULT_CONFIG: WidgetConfig = {
    activityName: '[Activity Name]',
    // REQUIRED_CONFIG_FIELDS is readonly to prevent mutation; cast needed for WidgetConfig.requiredFields type
    requiredFields: REQUIRED_CONFIG_FIELDS as unknown as string[],
    activityStartLocationDisplayName: null,
    activityEndLocationDisplayName: null,
    timezone: DEFAULT_TIMEZONE,
    activityStartTimeLabel: null,
    activityEndTimeLabel: null,
    apiBaseUrl: DEFAULT_API_BASE_URL,
    language: DEFAULT_LANGUAGE,
    dev: false,
    cacheUserStartLocation: true,
    userStartLocationCacheTTLMinutes: DEFAULT_CACHE_TTL_MINUTES,
    overrideUserStartLocation: null,
    overrideUserStartLocationType: null,
    disableUserStartLocationField: false,
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

/**
 * Default widget state
 */
export const DEFAULT_STATE: WidgetState = {
    fromConnections: [],
    toConnections: [],
    selectedToConnection: null,
    selectedFromConnection: null,
    selectedDate: null,
    selectedEndDate: null,
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
