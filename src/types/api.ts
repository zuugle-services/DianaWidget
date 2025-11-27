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
    
    /** Origin location name */
    readonly from_location?: string;
    
    /** Destination location name */
    readonly to_location?: string;
    
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
    
    /** Data provider (e.g., 'live') */
    readonly provider?: string;
    
    /** Alerts/warnings for this element */
    readonly alerts?: readonly TransportAlert[];
    
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

/**
 * Transport alert/warning
 */
export interface TransportAlert {
    /** Alert title */
    readonly title?: string;
    
    /** Alert description */
    readonly description?: string;
    
    /** Alert severity */
    readonly severity?: 'info' | 'warning' | 'error';
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
    
    /** Whether this connection has realtime data */
    readonly has_realtime?: boolean;
    
    /** Whether this is an "anytime" connection (flexible timing) */
    readonly connection_anytime?: boolean;
    
    /** Ticketshop provider name if available */
    readonly connection_ticketshop_provider?: string;
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
    
    /** Error code if any */
    readonly error_code?: string | number;
    
    /** Error message if any */
    readonly error_message?: string;
}

/**
 * API response for address autocomplete
 */
export interface AutocompleteResponse {
    /** List of suggestions */
    readonly results?: readonly Suggestion[];
    
    /** Error code if any */
    readonly error_code?: string | number;
    
    /** Error message if any */
    readonly error_message?: string;
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
}

/**
 * API response for creating a share link
 */
export interface CreateShareResponse {
    /** Created share ID */
    readonly shareId: string;
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
