/**
 * Configuration types for DianaWidget
 */

/** Valid location types for activity and user start locations */
export type LocationType = 'coordinates' | 'coord' | 'coords' | 'address' | 'station';

/**
 * What the widget plans:
 * - 'activity' (default): the outbound and return trip to an activity, within its time windows.
 * - 'journey': a plain A-to-B connection search from a first point to a last point.
 */
export type WidgetMode = 'activity' | 'journey';

/** Supported language codes */
export type Language = 'EN' | 'DE' | 'FR' | 'IT' | 'TH' | 'ES';

/**
 * One date in `dateList` with its own time window. Every field except `date` is optional and
 * falls back to the global `activity*` options. `opens`/`closes` is a shorthand for opening
 * hours: the four times are derived from it and the duration (explicit times still win).
 * Times are local to `timezone`, HH:MM or HH:MM:SS.
 */
export interface DateListEntry {
    /** The date, YYYY-MM-DD */
    date: string;
    /** Earliest activity start on this date */
    earliestStartTime?: string;
    /** Latest activity start on this date */
    latestStartTime?: string;
    /** Earliest activity end on this date */
    earliestEndTime?: string;
    /** Latest activity end on this date */
    latestEndTime?: string;
    /** Activity duration on this date, in minutes */
    durationMinutes?: number | string;
    /** Opening time (shorthand, requires `closes`) */
    opens?: string;
    /** Closing time (shorthand, requires `opens`) */
    closes?: string;
}

/** A `dateList` item: a plain date (global time window) or a date with its own window. */
export type DateListItem = string | DateListEntry;

/**
 * A schema.org `OpeningHoursSpecification`, as found in JSON-LD (`openingHoursSpecification`).
 * Unknown properties such as `@type` are ignored.
 */
export interface OpeningHoursSpecification {
    '@type'?: string;
    /** Day name(s): "Monday" or "https://schema.org/Monday" (also http:// and "schema:Monday") */
    dayOfWeek?: string | string[];
    /** First day the entry applies to (YYYY-MM-DD, a date-time is cut to its date) */
    validFrom?: string;
    /** Last day the entry applies to (inclusive) */
    validThrough?: string;
    /** Opening time, HH:MM or HH:MM:SS (a UTC offset suffix is ignored) */
    opens?: string;
    /** Closing time, HH:MM or HH:MM:SS (a UTC offset suffix is ignored) */
    closes?: string;
    [key: string]: unknown;
}

/** Why the widget decided not to render (passed to `onUnavailable`). */
export type UnavailableReason = 'noFutureDates' | 'outsideDisplayRange';

/**
 * Configuration interface for DianaWidget
 */
export interface WidgetConfig {
    /** What the widget plans; defaults to 'activity'. See WidgetMode. */
    mode: WidgetMode;

    /** Name of the activity. Optional: with no value the widget renders no title anywhere. */
    activityName?: string | null;
    
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
    
    /**
     * Text shown in the origin field for overrideUserStartLocation, e.g. a station's full name
     * or a place name for coordinates. The search still uses the override value and type.
     */
    overrideUserStartLocationDisplayName?: string | null;

    /** Whether to disable user start location field */
    disableUserStartLocationField: boolean;

    /** Journey mode: prefilled destination (last point). */
    overrideUserDestinationLocation?: string | null;

    /** Journey mode: location type of overrideUserDestinationLocation. */
    overrideUserDestinationLocationType?: LocationType | null;

    /** Journey mode: text shown in the destination field for overrideUserDestinationLocation. */
    overrideUserDestinationLocationDisplayName?: string | null;

    /** Journey mode: lock the destination to overrideUserDestinationLocation (not editable). */
    disableUserDestinationLocationField: boolean;

    /** Journey mode: remember the destination the user picked (off by default). */
    cacheUserDestinationLocation: boolean | (() => boolean);

    /** Journey mode: TTL for the remembered destination in minutes. */
    userDestinationLocationCacheTTLMinutes: number;

    /** Journey mode: title in the header. Unset: a localised default; '' renders no title. */
    journeyTitle?: string | null;

    /** Journey mode: preset travel date (YYYY-MM-DD, widget timezone). Default: today. */
    journeyDate?: string | null;

    /** Journey mode: preset time (HH:MM, widget timezone). Default: the current time. */
    journeyTime?: string | null;

    /** Journey mode: preset the time as the latest arrival instead of the departure. */
    journeyArriveBy: boolean;
    
    /** Start date for widget display period (YYYY-MM-DD) */
    displayStartDate?: string | null;
    
    /** End date for widget display period (YYYY-MM-DD) */
    displayEndDate?: string | null;
    
    /** Name for destination input field */
    destinationInputName?: string | null;

    /**
     * Font for the widget (CSS font-family value, e.g. '"Inter", sans-serif'). By default the
     * widget uses the font of the page it is embedded in; the host can also set --font-family.
     */
    fontFamily?: string | null;

    /**
     * Maximum width of the widget (default 470px). A CSS length such as "100%", "640px" or
     * "none"; a number means pixels. Sets --diana-max-width on the container.
     */
    maxWidth?: string | number | null;

    /**
     * Maximum height of the container (default 790px). A CSS length such as "600px" or "none";
     * a number means pixels. Sets --diana-max-height on the container.
     */
    maxHeight?: string | number | null;

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
    
    /** When searching for today, also list connections that have already departed (shown greyed out) so the whole day can be browsed */
    showPastConnections: boolean;
    
    /** Show the ticketshop ("Buy Ticket") buttons on connections. Set to false to render none. */
    showTicketShopButtons: boolean;
    
    /**
     * Available dates for date selection: 'YYYY-MM-DD' strings and/or DateListEntry objects
     * with their own time window. Replaces the date picker by a dropdown.
     */
    dateList?: DateListItem[] | null;

    /**
     * schema.org openingHoursSpecification array. Expanded into dates with time windows that
     * drive the same dropdown as dateList. Ignored when dateList is set.
     */
    openingHours?: OpeningHoursSpecification[] | null;

    /** How many days ahead recurring (dayOfWeek) openingHours entries are expanded */
    openingHoursHorizonDays: number;

    /**
     * Render nothing when dateList/openingHours leaves no date today or later (instead of
     * falling back to the free date picker).
     */
    hideWhenNoFutureDates: boolean;

    /** Called whenever the widget decides not to render (no future date, outside display range) */
    onUnavailable?: ((reason: UnavailableReason) => void) | null;
    
    /** Callback when date is changed */
    onDateChange?: ((date: string) => void) | null;
    
    /** Callback when API token expires */
    onApiTokenExpired?: (() => void) | null;
    
    /** Share ID from URL (set internally) */
    shareId?: string;
    
    /** Whether widget is in read-only mode (set internally) */
    readOnly?: boolean;
    
    /** Share mode override: 'consumer' (default backend behavior), 'legacy', or null (don't send) */
    shareMode?: 'consumer' | 'legacy' | null;
}

/**
 * Partial config that can be passed to the constructor
 */
export type PartialWidgetConfig = Partial<WidgetConfig>;
