/**
 * API response types for DianaWidget
 */

/**
 * Connection element representing a single leg/segment of a journey
 * This is the structure used internally by the widget
 */
export interface ConnectionElement {
    /** Element type (e.g., 'WALK', 'TRSF', 'JNY') */
    type: string;
    
    /** Departure time (ISO 8601) */
    departure_time: string;
    
    /** Arrival time (ISO 8601) */
    arrival_time: string;
    
    /** Duration in minutes */
    duration?: number;
    
    /** Origin location name */
    from_location?: string;
    
    /** Destination location name */
    to_location?: string;
    
    /** Vehicle type for journey legs */
    vehicle_type?: string;
    
    /** Vehicle name/line name */
    vehicle_name?: string;
    
    /** Direction/destination of the vehicle */
    direction?: string;
    
    /** Platform at origin */
    platform_orig?: string;
    
    /** Platform at destination */
    platform_dest?: string;
    
    /** Number of intermediate stops */
    n_intermediate_stops?: number;
    
    /** Data provider (e.g., 'live') */
    provider?: string;
    
    /** Alerts/warnings for this element */
    alerts?: TransportAlert[];
    
    /** Whether this is the first element in the original connection (set internally) */
    isOriginalFirst?: boolean;
    
    /** Whether this is the last element in the original connection (set internally) */
    isOriginalLast?: boolean;
}

/**
 * Transport leg in a connection (legacy interface)
 * @deprecated Use ConnectionElement instead
 */
export interface TransportLeg {
    /** Leg type (e.g., 'WALK', 'TRSF', or vehicle type number) */
    type: string | number;
    
    /** Start timestamp (ISO 8601) */
    start_timestamp: string;
    
    /** End timestamp (ISO 8601) */
    end_timestamp: string;
    
    /** Start location name */
    start_location?: string;
    
    /** End location name */
    end_location?: string;
    
    /** Line/route name */
    line_name?: string;
    
    /** Direction/destination */
    direction?: string;
    
    /** Platform at start */
    platform_start?: string;
    
    /** Platform at end */
    platform_end?: string;
    
    /** Number of stops */
    stops?: number;
    
    /** Duration in minutes */
    duration_minutes?: number;
    
    /** Whether this is a realtime connection */
    is_realtime?: boolean;
    
    /** Realtime start timestamp if different from scheduled */
    realtime_start_timestamp?: string;
    
    /** Realtime end timestamp if different from scheduled */
    realtime_end_timestamp?: string;
    
    /** Alerts/warnings for this leg */
    alerts?: TransportAlert[];
    
    /** Ticket purchase URL */
    ticket_url?: string;
}

/**
 * Transport alert/warning
 */
export interface TransportAlert {
    /** Alert title */
    title?: string;
    
    /** Alert description */
    description?: string;
    
    /** Alert severity */
    severity?: 'info' | 'warning' | 'error';
}

/**
 * Connection object representing a journey
 */
export interface Connection {
    /** Unique identifier */
    id?: string;
    
    /** Connection ID from API */
    connection_id?: string | number;
    
    /** Connection start timestamp (ISO 8601) */
    connection_start_timestamp: string;
    
    /** Connection end timestamp (ISO 8601) */
    connection_end_timestamp: string;
    
    /** Start location name */
    start_location?: string;
    
    /** End location name */
    end_location?: string;
    
    /** Total duration in minutes */
    duration_minutes?: number;
    
    /** Number of transfers */
    transfers?: number;
    
    /** Number of transfers (API field name) */
    connection_transfers?: number;
    
    /** Individual elements/legs of the connection */
    connection_elements?: ConnectionElement[];
    
    /** Individual legs of the connection (legacy) */
    legs?: TransportLeg[];
    
    /** Score for ranking */
    score?: number;
    
    /** Whether this is a recommended connection */
    is_recommended?: boolean;
    
    /** Whether this connection has realtime data */
    has_realtime?: boolean;
    
    /** Whether this is an "anytime" connection (flexible timing) */
    connection_anytime?: boolean;
    
    /** Ticketshop provider name if available */
    connection_ticketshop_provider?: string;
}

/**
 * Diana properties for a suggestion
 */
export interface SuggestionProperties {
    /** Display name */
    display_name: string;
    
    /** Location type */
    location_type?: string;
}

/**
 * Geometry for a suggestion (GeoJSON Point)
 */
export interface SuggestionGeometry {
    /** Geometry type */
    type?: string;
    
    /** Coordinates [lon, lat] */
    coordinates: [number, number];
}

/**
 * Address/location suggestion from autocomplete (GeoJSON Feature)
 */
export interface Suggestion {
    /** Feature type */
    type?: string;
    
    /** Diana-specific properties */
    diana_properties: SuggestionProperties;
    
    /** Geometry with coordinates */
    geometry: SuggestionGeometry;
    
    /** Legacy: Display name */
    name?: string;
    
    /** Legacy: Latitude */
    lat?: string | number;
    
    /** Legacy: Longitude */
    lon?: string | number;
}

/**
 * API response for connection search
 */
export interface ConnectionSearchResponse {
    /** Connections to the activity */
    to_connections?: Connection[];
    
    /** Connections from the activity */
    from_connections?: Connection[];
    
    /** Recommended to-connection index */
    recommended_to_index?: number;
    
    /** Recommended from-connection index */
    recommended_from_index?: number;
    
    /** Error code if any */
    error_code?: string | number;
    
    /** Error message if any */
    error_message?: string;
}

/**
 * API response for address autocomplete
 */
export interface AutocompleteResponse {
    /** List of suggestions */
    results?: Suggestion[];
    
    /** Error code if any */
    error_code?: string | number;
    
    /** Error message if any */
    error_message?: string;
}

/**
 * API response for share data
 */
export interface ShareDataResponse {
    /** Origin location */
    origin: string;
    
    /** Origin latitude */
    origin_lat?: string | number;
    
    /** Origin longitude */
    origin_lon?: string | number;
    
    /** Selected date (YYYY-MM-DD) */
    date: string;
    
    /** Selected end date for multiday (YYYY-MM-DD) */
    dateEnd?: string | null;
    
    /** To connection start timestamp */
    to_connection_start_time?: string | null;
    
    /** To connection end timestamp */
    to_connection_end_time?: string | null;
    
    /** From connection start timestamp */
    from_connection_start_time?: string | null;
    
    /** From connection end timestamp */
    from_connection_end_time?: string | null;
}

/**
 * API response for creating a share link
 */
export interface CreateShareResponse {
    /** Created share ID */
    shareId: string;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
    /** Error code */
    error_code?: string | number;
    
    /** Error message */
    error_message?: string;
    
    /** Detail message */
    detail?: string;
}
