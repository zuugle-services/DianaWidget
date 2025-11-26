/**
 * Barrel export for constants
 */

export {
    DEFAULT_API_BASE_URL,
    DEFAULT_TIMEZONE,
    DEFAULT_LANGUAGE,
    DEFAULT_CACHE_TTL_MINUTES,
    ADDRESS_INPUT_DEBOUNCE_MS,
    MIN_AUTOCOMPLETE_QUERY_LENGTH,
    CACHE_KEY_PREFIX,
    VALID_LOCATION_TYPES,
    COORDINATE_LOCATION_TYPES,
    REQUIRED_CONFIG_FIELDS,
    TIME_CONFIG_FIELDS,
    DEFAULT_CONFIG,
    DEFAULT_STATE,
    isValidLocationType,
    isCoordinateLocationType
} from './defaults';

export type {
    ValidLocationType,
    CoordinateLocationType
} from './defaults';
