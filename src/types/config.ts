/**
 * Configuration types for DianaWidget
 */

/** Valid location types for activity and user start locations */
export type LocationType = 'coordinates' | 'coord' | 'coords' | 'address' | 'station';

/** Supported language codes */
export type Language = 'EN' | 'DE' | 'FR' | 'IT' | 'TH' | 'ES';

/**
 * Configuration interface for DianaWidget
 */
export interface WidgetConfig {
    /** Name of the activity */
    activityName: string;
    
    /** List of required configuration fields */
    requiredFields: string[];
    
    /** Starting location of the activity */
    activityStartLocation?: string;
    
    /** Type of starting location */
    activityStartLocationType?: LocationType;
    
    /** Display name for activity start location */
    activityStartLocationDisplayName?: string | null;
    
    /** Ending location of the activity */
    activityEndLocation?: string;
    
    /** Type of ending location */
    activityEndLocationType?: LocationType;
    
    /** Display name for activity end location */
    activityEndLocationDisplayName?: string | null;
    
    /** Timezone for the widget (e.g., "Europe/Vienna") */
    timezone: string;
    
    /** Earliest start time for the activity (HH:MM or HH:MM:SS) */
    activityEarliestStartTime?: string;
    
    /** Latest start time for the activity (HH:MM or HH:MM:SS) */
    activityLatestStartTime?: string;
    
    /** Earliest end time for the activity (HH:MM or HH:MM:SS) */
    activityEarliestEndTime?: string;
    
    /** Latest end time for the activity (HH:MM or HH:MM:SS) */
    activityLatestEndTime?: string;
    
    /** Duration of the activity in minutes */
    activityDurationMinutes?: number | string;
    
    /** Label for activity start time */
    activityStartTimeLabel?: string | null;
    
    /** Label for activity end time */
    activityEndTimeLabel?: string | null;
    
    /** API token for authentication */
    apiToken?: string;
    
    /** Base URL for API calls */
    apiBaseUrl: string;
    
    /** Language code for translations */
    language: Language;
    
    /** Enable development mode */
    dev: boolean;
    
    /** Whether to cache user start location */
    cacheUserStartLocation: boolean | (() => boolean);
    
    /** TTL for user start location cache in minutes */
    userStartLocationCacheTTLMinutes: number;
    
    /** Override value for user start location */
    overrideUserStartLocation?: string | null;
    
    /** Location type for override user start location */
    overrideUserStartLocationType?: LocationType | null;
    
    /** Whether to disable user start location field */
    disableUserStartLocationField: boolean;
    
    /** Start date for widget display period (YYYY-MM-DD) */
    displayStartDate?: string | null;
    
    /** End date for widget display period (YYYY-MM-DD) */
    displayEndDate?: string | null;
    
    /** Name for destination input field */
    destinationInputName?: string | null;
    
    /** Enable multiday activity mode */
    multiday: boolean;
    
    /** Override start date for activity (YYYY-MM-DD) */
    overrideActivityStartDate?: string | null;
    
    /** Override end date for activity (YYYY-MM-DD) */
    overrideActivityEndDate?: string | null;
    
    /** Fixed duration for activity in days */
    activityDurationDaysFixed?: number | null;
    
    /** Enable sharing functionality */
    share: boolean;
    
    /** Allow viewing shared journeys */
    allowShareView: boolean;
    
    /** Prefix for share URLs */
    shareURLPrefix?: string | null;
    
    /** Whether to hide overridden activity start date */
    hideOverriddenActivityStartDate: boolean;
    
    /** List of available dates (YYYY-MM-DD) for date selection */
    dateList?: string[] | null;
    
    /** Callback when date is changed */
    onDateChange?: ((date: string) => void) | null;
    
    /** Callback when API token expires */
    onApiTokenExpired?: (() => void) | null;
    
    /** Share ID from URL (set internally) */
    shareId?: string;
    
    /** Whether widget is in read-only mode (set internally) */
    readOnly?: boolean;
}

/**
 * Partial config that can be passed to the constructor
 */
export type PartialWidgetConfig = Partial<WidgetConfig>;
