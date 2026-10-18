/**
 * Browsing the whole day when searching for today.
 *
 * By default the backend drops connections that have already left. With the
 * `showPastConnections` option the widget asks it to keep them (`include_past`) for
 * today's searches, so "load earlier" can page back to the first connection of the
 * day. Departed connections are then greyed out in the time-slot slider.
 */

import { DateTime } from 'luxon';
import type { Connection } from '../types/api';

/**
 * Whether a /connections search should send `include_past`.
 *
 * @param date - The searched date (`yyyy-MM-dd`, in the widget timezone), as sent in `date`.
 * Only today has a past worth browsing; later dates have nothing departed yet.
 */
export function shouldIncludePastConnections(
    showPastConnections: boolean,
    date: string | undefined,
    timezone: string,
    now: DateTime = DateTime.now()
): boolean {
    return showPastConnections && !!date && date === now.setZone(timezone).toISODate();
}

/**
 * Whether a connection has already left. Anytime (walk-only) connections never do.
 */
export function isConnectionDeparted(
    connection: Pick<Connection, 'connection_anytime' | 'connection_start_timestamp'>,
    now: DateTime = DateTime.utc()
): boolean {
    if (connection.connection_anytime) return false;
    const start = DateTime.fromISO(connection.connection_start_timestamp, { zone: 'utc' });
    return start.isValid && start < now;
}
