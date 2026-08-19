/**
 * State types for DianaWidget
 */

import type { DateTime } from 'luxon';
import type { ActivityObject, Connection, Suggestion } from './api';

/**
 * Activity times state
 */
export interface ActivityTimes {
    /** Start time string */
    start: string;
    /** End time string */
    end: string;
    /** Duration string */
    duration: string;
    /** Whether duration is below recommended */
    warningDuration: boolean;
}

/**
 * Context for an active share session.
 * Populated when the widget is opened via a ?diana-share= URL parameter.
 */
export interface ShareContext {
    /** The current share UUID */
    shareId: string;
    /** Origin location name */
    origin: string;
    /** Human-readable origin display name */
    originDisplayName: string | null;
    /** Origin latitude */
    originLat: number | null;
    /** Origin longitude */
    originLon: number | null;
    /** Activity date YYYY-MM-DD */
    date: string;
    /** End date for multiday YYYY-MM-DD */
    dateEnd: string | null;
    /** To connection start timestamp (UTC ISO) */
    toConnectionStartTime: string | null;
    /** To connection end timestamp (UTC ISO) */
    toConnectionEndTime: string | null;
    /** From connection start timestamp (UTC ISO) */
    fromConnectionStartTime: string | null;
    /** From connection end timestamp (UTC ISO) */
    fromConnectionEndTime: string | null;
    /** The full activity object from the share */
    activity: import('./api').ActivityObject | null;
    /** Client-defined payload passed through on re-share */
    payload: unknown;
    /** Whether flex connections were used */
    useFlex: boolean;
}

/**
 * Widget state interface
 */
export interface WidgetState {
    /** Connections from the activity */
    fromConnections: Connection[];
    
    /** Connections to the activity */
    toConnections: Connection[];
    
    /** Currently selected connection to activity */
    selectedToConnection: Connection | null;
    
    /** Currently selected connection from activity */
    selectedFromConnection: Connection | null;
    
    /** Selected start date */
    selectedDate: Date | null;
    
    /** Selected end date (for multiday) */
    selectedEndDate: Date | null;
    
    /** Loading state */
    loading: boolean;
    
    /** Current error message */
    error: string | null;
    
    /** Current info message */
    info: string | null;
    
    /** Address suggestions */
    suggestions: Suggestion[];
    
    /** Recommended to-connection index */
    recommendedToIndex: number;
    
    /** Recommended from-connection index */
    recommendedFromIndex: number;
    
    /** Activity times */
    activityTimes: ActivityTimes;
    
    /** Current content page key */
    currentContentKey: string | null;
    
    /** Activity object from last /connections response; null until first successful fetch */
    activity: ActivityObject | null;

    /** Share context when in share mode; null when not viewing a shared journey */
    shareContext: ShareContext | null;

    /**
     * Whether on-demand transit (Bedarfsverkehr) is included in the search.
     * Driven by the toggle on the form page, stored on and restored from shares.
     */
    useFlex: boolean;

    /** Available dates from dateList (computed internally as Luxon DateTime) */
    availableDates?: DateTime[];

    /** Whether earlier to-connections exist beyond the current batch */
    hasMoreBeforeToActivity: boolean | null;

    /** Whether later to-connections exist beyond the current batch */
    hasMoreAfterToActivity: boolean | null;

    /** Whether earlier from-connections exist beyond the current batch */
    hasMoreBeforeFromActivity: boolean | null;

    /** Whether later from-connections exist beyond the current batch */
    hasMoreAfterFromActivity: boolean | null;
}
