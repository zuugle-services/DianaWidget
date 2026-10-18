/**
 * API response types for DianaWidget
 */

/**
 * Connection element types
 * - 'WALK': Walking segment
 * - 'TRSF': Transfer between stations
 * - 'JNY': Journey on a vehicle (train, bus, etc.)
 */
export type ConnectionElementType = 'WALK' | 'TRSF' | 'JNY';

/**
 * Connection element representing a single leg/segment of a journey.
 * The 'type' field indicates the kind of element:
 * - 'WALK': Walking segment
 * - 'TRSF': Transfer between stations  
 * - 'JNY': Journey on a vehicle (train, bus, etc.)
 * 
 * Note: The 'type' property uses `string` instead of `ConnectionElementType` to allow
 * for unknown element types that may be returned by the API in the future.
 * Use the type guard functions (isJourneyElement, isWalkElement, isTransferElement)
 * for type-safe access to specific element properties.
 */
export interface ConnectionElement {
    /** Element type (e.g., 'WALK', 'TRSF', 'JNY') - uses string for API compatibility */
    readonly type: string;
    
    /** Departure time (ISO 8601) */
    readonly departure_time: string;
    
    /** Arrival time (ISO 8601) */
    readonly arrival_time: string;
    
    /** Duration in minutes */
    readonly duration?: number;
    
    /** Origin location name (always human-readable) */
    readonly from_location?: string;

    /** Coordinates of the departure location */
    readonly from_location_coordinates?: { readonly lat: number; readonly lon: number };

    /** Destination location name (always human-readable) */
    readonly to_location?: string;

    /** Coordinates of the arrival location */
    readonly to_location_coordinates?: { readonly lat: number; readonly lon: number };

    /** External ID of the origin stop as returned by the provider */
    readonly ext_id_orig?: string;

    /** External ID of the destination stop as returned by the provider */
    readonly ext_id_dest?: string;

    /** Vehicle type for journey legs */
    readonly vehicle_type?: string;
    
    /** Vehicle name/line name */
    readonly vehicle_name?: string;
    
    /** Direction/destination of the vehicle */
    readonly direction?: string;
    
    /** Platform at origin */
    readonly platform_orig?: string;
    
    /** Platform at destination */
    readonly platform_dest?: string;
    
    /** Number of intermediate stops */
    readonly n_intermediate_stops?: number;
    
    /**
     * True when the routing provider has live data for this leg (transit legs only).
     * departure_time / arrival_time are always the actual times.
     */
    readonly realtime?: boolean;

    /** Timetable departure (ISO, UTC); only present on realtime legs */
    readonly departure_time_scheduled?: string;

    /** Timetable arrival (ISO, UTC); only present on realtime legs */
    readonly arrival_time_scheduled?: string;

    /** Departure delay in minutes (negative = early); only present on realtime legs */
    readonly departure_delay?: number;

    /** Arrival delay in minutes (negative = early); only present on realtime legs */
    readonly arrival_delay?: number;

    /** Timetable departure platform; only present when the live platform differs */
    readonly platform_orig_scheduled?: string;

    /** Timetable arrival platform; only present when the live platform differs */
    readonly platform_dest_scheduled?: string;

    /** True when the trip is cancelled */
    readonly cancelled?: boolean;

    /** True for an extra trip that is not in the timetable */
    readonly additional_service?: boolean;
    
    /** Alerts/warnings for this element */
    readonly alerts?: readonly TransportAlert[];

    /** On-demand (GTFS-Flex) service details; only present on FLEX legs */
    readonly flex?: FlexInfo;

    /** Booking requirements; only present when the routing provider supplies booking rules */
    readonly booking?: LegBooking;
    
    /** 
     * Whether this is the first element in the original connection.
     * This is an internal mutable flag set by the widget during processing.
     */
    isOriginalFirst?: boolean;
    
    /** 
     * Whether this is the last element in the original connection.
     * This is an internal mutable flag set by the widget during processing.
     */
    isOriginalLast?: boolean;
}

/**
 * Type guard to check if an element is a Journey element (JNY).
 * Use this to access journey-specific properties like vehicle_name, direction, etc.
 * 
 * @param element - The connection element to check
 * @returns True if the element is a Journey element
 * 
 * @example
 * ```typescript
 * if (isJourneyElement(element)) {
 *   console.log(element.vehicle_name);
 *   console.log(element.direction);
 * }
 * ```
 */
export function isJourneyElement(element: ConnectionElement): element is ConnectionElement & { readonly type: 'JNY' } {
    return element.type === 'JNY';
}

/**
 * Type guard to check if an element is a Walk element.
 * 
 * @param element - The connection element to check
 * @returns True if the element is a Walk element
 */
export function isWalkElement(element: ConnectionElement): element is ConnectionElement & { readonly type: 'WALK' } {
    return element.type === 'WALK';
}

/**
 * Type guard to check if an element is a Transfer element.
 * 
 * @param element - The connection element to check
 * @returns True if the element is a Transfer element
 */
export function isTransferElement(element: ConnectionElement): element is ConnectionElement & { readonly type: 'TRSF' } {
    return element.type === 'TRSF';
}

/**
 * Transport leg in a connection (legacy interface)
 * @deprecated Use ConnectionElement instead
 */
export interface TransportLeg {
    /** Leg type (e.g., 'WALK', 'TRSF', or vehicle type number) */
    readonly type: string | number;
    
    /** Start timestamp (ISO 8601) */
    readonly start_timestamp: string;
    
    /** End timestamp (ISO 8601) */
    readonly end_timestamp: string;
    
    /** Start location name */
    readonly start_location?: string;
    
    /** End location name */
    readonly end_location?: string;
    
    /** Line/route name */
    readonly line_name?: string;
    
    /** Direction/destination */
    readonly direction?: string;
    
    /** Platform at start */
    readonly platform_start?: string;
    
    /** Platform at end */
    readonly platform_end?: string;
    
    /** Number of stops */
    readonly stops?: number;
    
    /** Duration in minutes */
    readonly duration_minutes?: number;
    
    /** Whether this is a realtime connection */
    readonly is_realtime?: boolean;
    
    /** Realtime start timestamp if different from scheduled */
    readonly realtime_start_timestamp?: string;
    
    /** Realtime end timestamp if different from scheduled */
    readonly realtime_end_timestamp?: string;
    
    /** Alerts/warnings for this leg */
    readonly alerts?: readonly TransportAlert[];
    
    /** Ticket purchase URL */
    readonly ticket_url?: string;
}

/** Display severity of an alert, derived by the backend from the feed */
export type AlertSeverity = 'info' | 'warning' | 'severe';

/** What an alert refers to */
export type AlertScope = 'trip' | 'departure_stop' | 'arrival_stop';

/** A time interval; a missing bound means open-ended */
export interface AlertTimeRange {
    readonly start?: string | null;
    readonly end?: string | null;
}

/**
 * Transport alert/warning (GTFS Realtime-based).
 * Texts are in the requested language when the feed provides a translation.
 */
export interface TransportAlert {
    readonly cause?: string | null;
    readonly effect?: string | null;
    readonly severity?: AlertSeverity;
    readonly scope?: AlertScope;
    /** Name of the affected stop for stop-scoped alerts */
    readonly stop_name?: string;
    readonly header_text?: string;
    readonly description_text?: string;
    /** URL with additional information */
    readonly url?: string;
    readonly cause_detail?: string;
    readonly effect_detail?: string;
    readonly code?: string;
    readonly impact_period?: readonly AlertTimeRange[];
    readonly communication_period?: readonly AlertTimeRange[];
    readonly image_url?: string;
    readonly image_media_type?: string;
    readonly image_alternative_text?: string;
}

/** On-demand (GTFS-Flex) service details of a leg */
export interface FlexInfo {
    /** Name of the on-demand service or service area */
    readonly name?: string;
    readonly id?: string;
    readonly pickup_window_start?: string;
    readonly pickup_window_end?: string;
    readonly drop_off_window_start?: string;
    readonly drop_off_window_end?: string;
}

/** GTFS-Flex booking type */
export type BookingType = 'real_time' | 'same_day' | 'prior_days';

/** Booking rule (GTFS-Flex booking_rules.txt) with backend-computed booking window */
export interface BookingRule {
    readonly booking_type?: BookingType;
    readonly message?: string;
    readonly pickup_message?: string;
    readonly drop_off_message?: string;
    readonly phone_number?: string;
    readonly info_url?: string;
    readonly booking_url?: string;
    readonly prior_notice_duration_min?: number;
    readonly prior_notice_duration_max?: number;
    readonly prior_notice_last_day?: number;
    readonly prior_notice_last_time?: string;
    readonly prior_notice_start_day?: number;
    readonly prior_notice_start_time?: string;
    /** Earliest time the leg can be booked (ISO 8601, UTC) */
    readonly earliest_booking_time?: string;
    /** Booking deadline (ISO 8601, UTC) */
    readonly latest_booking_time?: string;
}

/** Booking requirements of a leg */
export interface LegBooking {
    /** Rule for boarding the leg */
    readonly pickup?: BookingRule;
    /** Rule for alighting from the leg */
    readonly drop_off?: BookingRule;
}

/**
 * Ticketshop segment defining which provider covers a leg range
 */
export interface TicketshopSegment {
    /** Inclusive start index into connection_elements (0-based) */
    readonly leg_from: number;
    /** Inclusive end index into connection_elements (0-based) */
    readonly leg_to: number;
    /** Provider name (e.g. "OEBB", "TRAIVELLING"), or null if no coverage */
    readonly provider: string | null;
}

/**
 * Connection object representing a journey
 */
export interface Connection {
    /** Unique identifier */
    readonly id?: string;
    
    /** Connection ID from API */
    readonly connection_id?: string | number;
    
    /** Connection start timestamp (ISO 8601) */
    readonly connection_start_timestamp: string;
    
    /** Connection end timestamp (ISO 8601) */
    readonly connection_end_timestamp: string;
    
    /** Start location name */
    readonly start_location?: string;
    
    /** End location name */
    readonly end_location?: string;
    
    /** Total duration in minutes */
    readonly duration_minutes?: number;
    
    /** Number of transfers */
    readonly transfers?: number;
    
    /** Number of transfers (API field name) */
    readonly connection_transfers?: number;
    
    /** Individual elements/legs of the connection */
    connection_elements?: ConnectionElement[];
    
    /** Individual legs of the connection (legacy) */
    legs?: TransportLeg[];
    
    /** Score for ranking */
    readonly score?: number;
    
    /** Whether this is a recommended connection */
    readonly is_recommended?: boolean;
    
    /** Whether this is an "anytime" connection (flexible timing) */
    readonly connection_anytime?: boolean;

    /** Primary ticketshop provider name (first provider from segments), or null */
    readonly connection_ticketshop_provider?: string | null;

    /** Per-segment ticketshop coverage; present when a provider is available */
    readonly connection_ticketshop_segments?: readonly TicketshopSegment[];

    /** Suitability score (higher is better) */
    readonly connection_score?: number;
}

/**
 * Diana properties for a suggestion
 */
export interface SuggestionProperties {
    /** Display name */
    readonly display_name: string;
    
    /** Location type */
    readonly location_type?: string;
}

/**
 * Geometry for a suggestion (GeoJSON Point)
 */
export interface SuggestionGeometry {
    /** Geometry type */
    readonly type?: string;
    
    /** Coordinates [lon, lat] */
    readonly coordinates: [number, number];
}

/**
 * Address/location suggestion from autocomplete (GeoJSON Feature)
 */
export interface Suggestion {
    /** Feature type */
    readonly type?: string;
    
    /** Diana-specific properties */
    readonly diana_properties: SuggestionProperties;
    
    /** Geometry with coordinates */
    readonly geometry: SuggestionGeometry;
    
    /** Legacy: Display name */
    readonly name?: string;
    
    /** Legacy: Latitude */
    readonly lat?: string | number;
    
    /** Legacy: Longitude */
    readonly lon?: string | number;
}

/**
 * Activity object returned in /connections response.
 * All time fields are full UTC ISO 8601 datetimes (e.g. "2024-07-15T06:30:00Z").
 */
/**
 * Every field is declared `required=False, allow_null=True` by the backend's
 * ActivitySerializer, so all of them are optional *and* nullable.
 */
export interface ActivityObject {
    readonly name?: string | null;
    /** Resolved coordinates "lat,lon" once the backend has geocoded the location */
    readonly start_location?: string | null;
    readonly start_location_type?: string | null;
    readonly start_location_display_name?: string | null;
    readonly end_location?: string | null;
    readonly end_location_type?: string | null;
    readonly end_location_display_name?: string | null;
    readonly duration_minutes?: number | null;
    /** Number of days; null (not 1) for a single-day activity */
    readonly duration_days?: number | null;
    /** UTC ISO 8601 datetime */
    readonly earliest_start_time?: string | null;
    /** UTC ISO 8601 datetime */
    readonly latest_start_time?: string | null;
    /** UTC ISO 8601 datetime */
    readonly earliest_end_time?: string | null;
    /** UTC ISO 8601 datetime */
    readonly latest_end_time?: string | null;
    readonly start_time_label?: string | null;
    readonly end_time_label?: string | null;
    /** IANA timezone identifier, e.g. "Europe/Vienna" */
    readonly timezone?: string | null;
    /** Activity date YYYY-MM-DD */
    readonly date?: string | null;
    /** Last day of multi-day activity, null for single-day */
    readonly date_end?: string | null;
}

/**
 * API response for connection search
 */
export interface ConnectionSearchResponse {
    /** Connections to the activity */
    readonly to_connections?: readonly Connection[];

    /** Connections from the activity */
    readonly from_connections?: readonly Connection[];

    /** Recommended to-connection index */
    readonly recommended_to_index?: number;

    /** Recommended from-connection index */
    readonly recommended_from_index?: number;

    /** Canonical activity object */
    readonly activity?: ActivityObject;

    /** Whether a billable realtime routing provider (VAO) answered; accounting only, not displayed */
    readonly realtime_provider_used?: boolean;

    /** Error code if any */
    readonly error_code?: string | number;

    /** Error message if any */
    readonly error_message?: string;

    /** Shared journey block; present only in bundled mode (?share_id=...) */
    readonly shared_journey?: SharedJourneyBlock | null;
}

/**
 * API response for address autocomplete (GeoJSON FeatureCollection)
 */
export interface AutocompleteResponse {
    /** GeoJSON features array */
    readonly features?: readonly Suggestion[];
}

/**
 * API response for share data
 */
export interface ShareDataResponse {
    /** Origin location */
    readonly origin: string;

    /** Origin latitude */
    readonly origin_lat?: string | number;

    /** Origin longitude */
    readonly origin_lon?: string | number;

    /** Human-readable display name for the origin; null for old share records */
    readonly origin_display_name?: string | null;

    /** Selected date (YYYY-MM-DD) */
    readonly date: string;

    /** Selected end date for multiday (YYYY-MM-DD) */
    readonly dateEnd?: string | null;

    /** To connection start timestamp */
    readonly to_connection_start_time?: string | null;

    /** To connection end timestamp */
    readonly to_connection_end_time?: string | null;

    /** From connection start timestamp */
    readonly from_connection_start_time?: string | null;

    /** From connection end timestamp */
    readonly from_connection_end_time?: string | null;

    /** Full canonical activity object; null for shares created before this field was added */
    readonly activity?: ActivityObject | null;

    /** Client-defined payload object; null for shares created before this field was added */
    readonly payload?: unknown;

    /** Whether flex connections were used for this share */
    readonly use_flex?: boolean;

    /** Destination index stored with the share */
    readonly destinationIndex?: number | null;
}

/**
 * API response for creating a share link
 */
export interface CreateShareResponse {
    /** Created share ID */
    readonly shareId: string;
}

/**
 * Shared journey block returned in bundled-mode /connections responses.
 * Present only when share_id query parameter is supplied.
 */
export interface SharedJourneyBlock {
    /** Connection ID of the shared to-activity connection */
    readonly to_connection_id?: number | null;
    /** Whether the shared to-activity connection was found in the results */
    readonly to_connection_found?: boolean | null;
    /** Connection ID of the shared from-activity connection */
    readonly from_connection_id?: number | null;
    /** Whether the shared from-activity connection was found in the results */
    readonly from_connection_found?: boolean | null;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
    /** Error code */
    readonly error_code?: string | number;
    
    /** Error message */
    readonly error_message?: string;
    
    /** Detail message */
    readonly detail?: string;
}
