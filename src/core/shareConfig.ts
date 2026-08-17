import { DateTime } from 'luxon';
import { convertUTCToLocalTime } from '../datetimeUtils';
import type { ActivityObject, ShareDataResponse } from '../types/api';
import type { WidgetConfig, LocationType } from '../types/config';

/**
 * Returns true if id matches UUID format
 */
export function isValidShareId(id: string | null): boolean {
    if (!id) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}

/**
 * Reads ?diana-share= from window.location.search and validates it.
 */
export function readShareIdFromUrl(): string | null {
    if (typeof window === 'undefined' || !window.location || !window.location.search) {
        return null;
    }
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('diana-share');
    if (isValidShareId(shareId)) {
        return shareId;
    }
    return null;
}

/**
 * Maps the activity object fields onto the WidgetConfig.
 */
export function applySharedActivityToConfig(activity: ActivityObject, share: ShareDataResponse, config: WidgetConfig): void {
    // Critical: set timezone FIRST since time conversions depend on it.
    if (activity.timezone) {
        const isValidZone = DateTime.local().setZone(activity.timezone).isValid;
        if (isValidZone) {
            config.timezone = activity.timezone;
        }
    }

    if (activity.name !== undefined && activity.name !== null) {
        config.activityName = activity.name;
    }
    if (activity.start_location !== undefined && activity.start_location !== null) {
        config.activityStartLocation = activity.start_location;
    }
    if (activity.start_location_type !== undefined && activity.start_location_type !== null) {
        config.activityStartLocationType = activity.start_location_type as LocationType;
    }
    if (activity.start_location_display_name !== undefined && activity.start_location_display_name !== null) {
        config.activityStartLocationDisplayName = activity.start_location_display_name;
    }
    if (activity.end_location !== undefined && activity.end_location !== null) {
        config.activityEndLocation = activity.end_location;
    }
    if (activity.end_location_type !== undefined && activity.end_location_type !== null) {
        config.activityEndLocationType = activity.end_location_type as LocationType;
    }
    if (activity.end_location_display_name !== undefined && activity.end_location_display_name !== null) {
        config.activityEndLocationDisplayName = activity.end_location_display_name;
    }

    if (activity.earliest_start_time !== undefined && activity.earliest_start_time !== null) {
        const localTime = convertUTCToLocalTime(activity.earliest_start_time, config.timezone);
        if (localTime !== '--:--') {
            config.activityEarliestStartTime = localTime;
        }
    }
    if (activity.latest_start_time !== undefined && activity.latest_start_time !== null) {
        const localTime = convertUTCToLocalTime(activity.latest_start_time, config.timezone);
        if (localTime !== '--:--') {
            config.activityLatestStartTime = localTime;
        }
    }
    if (activity.earliest_end_time !== undefined && activity.earliest_end_time !== null) {
        const localTime = convertUTCToLocalTime(activity.earliest_end_time, config.timezone);
        if (localTime !== '--:--') {
            config.activityEarliestEndTime = localTime;
        }
    }
    if (activity.latest_end_time !== undefined && activity.latest_end_time !== null) {
        const localTime = convertUTCToLocalTime(activity.latest_end_time, config.timezone);
        if (localTime !== '--:--') {
            config.activityLatestEndTime = localTime;
        }
    }

    if (activity.duration_minutes !== undefined && activity.duration_minutes !== null) {
        config.activityDurationMinutes = activity.duration_minutes;
    }

    // The API omits duration_days entirely for single-day activities.
    const durationDays = activity.duration_days ?? 1;
    if (durationDays > 1) {
        config.multiday = true;
        config.activityDurationDaysFixed = durationDays;
    } else {
        config.multiday = false;
        // Must be cleared, otherwise a fixed duration left over from the host page's own
        // config (e.g. a 2-day tour) would still be applied to this single-day share.
        config.activityDurationDaysFixed = null;
    }

    if (activity.start_time_label !== undefined && activity.start_time_label !== null) {
        config.activityStartTimeLabel = activity.start_time_label;
    }
    if (activity.end_time_label !== undefined && activity.end_time_label !== null) {
        config.activityEndTimeLabel = activity.end_time_label;
    }

    // Set other overrides
    config.destinationInputName = null;
    config.overrideActivityStartDate = activity.date ?? share.date;
    config.overrideActivityEndDate = activity.date_end ?? share.dateEnd ?? null;
    config.hideOverriddenActivityStartDate = false;
}

/**
 * Creates a URL from the prefix, sets diana-share search param.
 */
export function buildShareUrl(prefix: string, shareId: string): string {
    try {
        // Try parsing as a full URL first (e.g. if prefix is absolute)
        const isAbsolute = /^https?:\/\//i.test(prefix);
        const url = new URL(prefix, isAbsolute ? undefined : 'http://localhost');
        url.searchParams.set('diana-share', shareId);
        
        if (isAbsolute) {
            return url.toString();
        } else {
            // Reconstruct relative URL
            return url.pathname + url.search + url.hash;
        }
    } catch {
        // Fallback for string manipulation if URL parsing fails
        const separator = prefix.includes('?') ? '&' : '?';
        return `${prefix}${separator}diana-share=${encodeURIComponent(shareId)}`;
    }
}
