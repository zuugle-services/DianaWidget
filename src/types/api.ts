/**
 * API response types for DianaWidget
 */

/**
 * Transport leg in a connection
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
    
    /** Individual legs of the connection */
    legs?: TransportLeg[];
    
    /** Score for ranking */
    score?: number;
    
    /** Whether this is a recommended connection */
    is_recommended?: boolean;
    
    /** Whether this connection has realtime data */
    has_realtime?: boolean;
}

/**
 * Address/location suggestion from autocomplete
 */
export interface Suggestion {
    /** Display name */
    name: string;
    
    /** Latitude */
    lat?: string | number;
    
    /** Longitude */
    lon?: string | number;
    
    /** Location type */
    type?: string;
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
