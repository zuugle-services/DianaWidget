import { DateTime } from 'luxon';
import { convertUTCToLocalTime } from '../datetimeUtils';
import { SHARED_CONNECTION_MATCH_TOLERANCE_MS } from '../constants/defaults';
import type { ActivityObject, Connection, ShareDataResponse } from '../types/api';
import type { WidgetConfig, LocationType } from '../types/config';

/** Epoch millis for a UTC ISO timestamp, or null when absent or unparseable. */
function toMillis(iso: string | null | undefined): number | null {
    if (!iso) return null;
    const dt = DateTime.fromISO(iso, {zone: 'utc'});
    return dt.isValid ? dt.toMillis() : null;
}

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

/**
 * Locates the connection a share names, among the ones fetched for *this* recipient.
 *
 * Matched on the end that touches the activity — the arrival at the meeting point for the
 * outbound leg, the departure from the activity for the return — because that is the only
 * end a recipient departing from somewhere else still has in common with the creator.
 * Requiring both ends to line up silently found nothing the moment the departure point
 * changed, which is the entire point of opening someone else's share.
 *
 * Mirrors `_find_match()` in the API's `shared_connection_recovery.py`: same anchor choice,
 * same tolerance for realtime drift between sharing and opening the link, and the same
 * tiebreak on the other end so an unchanged departure point still prefers the creator's
 * literal connection over another one arriving in the same minute.
 *
 * @param connections - Candidates for one direction, in slider order.
 * @param type - Which leg is being matched.
 * @param sharedStart - Departure stored in the share (UTC ISO), if any.
 * @param sharedEnd - Arrival stored in the share (UTC ISO), if any.
 * @returns Index into `connections`, or -1 when nothing matches.
 */
export function findSharedConnectionIndex(
    connections: Connection[],
    type: 'to' | 'from',
    sharedStart: string | null | undefined,
    sharedEnd: string | null | undefined
): number {
    let anchorTarget = toMillis(type === 'to' ? sharedEnd : sharedStart);
    let otherTarget = toMillis(type === 'to' ? sharedStart : sharedEnd);
    let anchorIsArrival = type === 'to';

    // A legacy share may carry only the other end; matching on it beats not matching.
    if (anchorTarget === null) {
        if (otherTarget === null) return -1;
        anchorTarget = otherTarget;
        otherTarget = null;
        anchorIsArrival = !anchorIsArrival;
    }

    let bestIndex = -1;
    let bestAnchorDelta = Number.POSITIVE_INFINITY;
    let bestOtherDelta = Number.POSITIVE_INFINITY;

    connections.forEach((connection, index) => {
        const anchor = toMillis(anchorIsArrival ? connection.connection_end_timestamp : connection.connection_start_timestamp);
        if (anchor === null) return;

        const anchorDelta = Math.abs(anchor - (anchorTarget as number));
        if (anchorDelta > SHARED_CONNECTION_MATCH_TOLERANCE_MS) return;

        const other = toMillis(anchorIsArrival ? connection.connection_start_timestamp : connection.connection_end_timestamp);
        const otherDelta = otherTarget !== null && other !== null ? Math.abs(other - otherTarget) : 0;

        if (anchorDelta < bestAnchorDelta || (anchorDelta === bestAnchorDelta && otherDelta < bestOtherDelta)) {
            bestIndex = index;
            bestAnchorDelta = anchorDelta;
            bestOtherDelta = otherDelta;
        }
    });

    return bestIndex;
}
