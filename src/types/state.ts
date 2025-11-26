/**
 * State types for DianaWidget
 */

import type { DateTime } from 'luxon';
import type { Connection, Suggestion } from './api';

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
    warning_duration: boolean;
}

/**
 * Preselect times for shared journeys
 */
export interface PreselectTimes {
    /** To connection start time */
    to_start: string | null;
    /** To connection end time */
    to_end: string | null;
    /** From connection start time */
    from_start: string | null;
    /** From connection end time */
    from_end: string | null;
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
    
    /** Preselect times for shared journeys */
    preselectTimes: PreselectTimes | null;
    
    /** Available dates from dateList (computed internally as Luxon DateTime) */
    availableDates?: DateTime[];
}
