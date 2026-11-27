/**
 * Journey mode: a plain A-to-B connection search (`mode: 'journey'`).
 *
 * Everything here is free of DOM access so it can be unit tested: config validation,
 * the prefill / lock / cache rules for both ends of the route, building the `/journey`
 * request, and paging through earlier and later connections. The DOM side lives in
 * `JourneyController`.
 */

import { DateTime } from 'luxon';
import { isCoordinateLocationType, isValidLocationType } from '../constants';
import { firstNonBlank } from '../utils';
import type { Connection } from '../types/api';
import type { LocationType, WidgetConfig } from '../types/config';

export type JourneyEndpointRole = 'origin' | 'destination';

/**
 * One end of the route as the form holds it: the text in the field plus what the search
 * actually sends. `lat`/`lon` are set for places picked from the list or the current
 * location; `locationValue`/`locationType` for a value prefilled by the host page (a
 * station or address that may be shown under a friendlier display name).
 */
export interface JourneyEndpointState {
    text: string;
    lat: string | null;
    lon: string | null;
    locationValue: string | null;
    locationType: LocationType | null;
}

/** How a field starts out: its state, whether it can be edited, and where it came from. */
export interface JourneyEndpointPrefill extends JourneyEndpointState {
    locked: boolean;
    source: 'override' | 'cache' | 'none';
}

/** A remembered place, as the start-location cache stores it. */
export interface CachedLocation {
    value: string;
    lat: string | null;
    lon: string | null;
    timestamp: number;
}

/** Minimal storage interface (localStorage in the browser, a map in tests). */
export interface KeyValueStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

/** The activity-only options that have no meaning in journey mode. */
const ACTIVITY_ONLY_FIELDS = [
    'activityStartLocation', 'activityStartLocationType', 'activityStartLocationDisplayName',
    'activityEndLocation', 'activityEndLocationType', 'activityEndLocationDisplayName',
    'activityEarliestStartTime', 'activityLatestStartTime', 'activityEarliestEndTime', 'activityLatestEndTime',
    'activityDurationMinutes', 'activityStartTimeLabel', 'activityEndTimeLabel',
    'overrideActivityStartDate', 'overrideActivityEndDate', 'activityDurationDaysFixed', 'dateList', 'openingHours',
    'destinationInputName',
] as const;

/** The journey-only options that have no meaning in activity mode. */
const JOURNEY_ONLY_FIELDS = [
    'overrideUserDestinationLocation', 'overrideUserDestinationLocationType',
    'overrideUserDestinationLocationDisplayName', 'journeyTitle', 'journeyDate', 'journeyTime',
] as const;

const COORDS_REGEX = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;
const TIME_REGEX = /^(2[0-3]|[01]?[0-9]):([0-5][0-9])$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** How many connections one `/journey` answer holds at most (the backend caps it at 20). */
export const JOURNEY_PAGE_SIZE = 20;

/**
 * Arrive-by answers reach back up to a day (overnight trains included). Connections that
 * arrive more than this long before the requested time are dropped from the first answer;
 * "earlier" still pages back past it.
 */
export const ARRIVE_BY_WINDOW_HOURS = 12;

export function isJourneyMode(config: Pick<WidgetConfig, 'mode'> | null | undefined): boolean {
    return config?.mode === 'journey';
}

/**
 * Validates the journey-mode options and normalises what can be normalised.
 * Pushes hard errors (shown in dev mode, fallback UI otherwise) and warns about options
 * that are ignored.
 */
export function validateJourneyConfig(
    config: WidgetConfig,
    errors: string[],
    warn: (message: string) => void = (message) => console.warn(message),
): void {
    const record = config as unknown as Record<string, unknown>;

    if (!isJourneyMode(config)) {
        const set = JOURNEY_ONLY_FIELDS.filter(field => record[field] !== null && record[field] !== undefined && record[field] !== '');
        if (set.length > 0) warn(`Warning: ${set.join(', ')} only apply with mode: 'journey' and are ignored.`);
        return;
    }

    if (config.multiday) {
        errors.push("multiday is not supported with mode: 'journey'.");
    }

    const ignored = ACTIVITY_ONLY_FIELDS.filter(field => record[field] !== null && record[field] !== undefined && record[field] !== '');
    if (ignored.length > 0) {
        warn(`Warning: ${ignored.join(', ')} are ignored with mode: 'journey'.`);
    }
    // These would otherwise change how the date field behaves.
    config.overrideActivityStartDate = null;
    config.overrideActivityEndDate = null;
    config.activityDurationDaysFixed = null;
    config.dateList = null;
    config.openingHours = null;

    const destination = config.overrideUserDestinationLocation;
    if (destination !== null && destination !== undefined && typeof destination !== 'string') {
        errors.push(`Invalid overrideUserDestinationLocation '${destination}'. Must be a string or null.`);
    } else if (destination) {
        if (!isValidLocationType(config.overrideUserDestinationLocationType)) {
            errors.push(`Invalid or missing overrideUserDestinationLocationType '${config.overrideUserDestinationLocationType}'.`);
        } else if (isCoordinateLocationType(config.overrideUserDestinationLocationType) && !COORDS_REGEX.test(destination.trim())) {
            errors.push(`Invalid coordinate format for overrideUserDestinationLocation: '${destination}'. Expected "lat,lon".`);
        }
    }
    if (config.disableUserDestinationLocationField && !destination) {
        warn("Warning: 'disableUserDestinationLocationField' is set to true but 'overrideUserDestinationLocation' is not provided. The parameter will be ignored.");
        config.disableUserDestinationLocationField = false;
    }

    if (config.journeyTime && !TIME_REGEX.test(config.journeyTime)) {
        errors.push(`Invalid journeyTime '${config.journeyTime}'. Expected HH:MM.`);
    }
    if (config.journeyDate && (!DATE_REGEX.test(config.journeyDate) || !DateTime.fromISO(config.journeyDate).isValid)) {
        errors.push(`Invalid journeyDate '${config.journeyDate}'. Expected YYYY-MM-DD.`);
    }
    const ttl = config.userDestinationLocationCacheTTLMinutes;
    if (typeof ttl !== 'number' || !Number.isFinite(ttl) || ttl <= 0) {
        errors.push(`Invalid userDestinationLocationCacheTTLMinutes '${ttl}'. Must be a positive number.`);
    }

    // Both ends fixed to the same place leaves nothing to search.
    if (config.disableUserStartLocationField && config.disableUserDestinationLocationField
        && config.overrideUserStartLocation && destination
        && sameEndpoint(prefillFromOverride(config.overrideUserStartLocation, config.overrideUserStartLocationType, null),
            prefillFromOverride(destination, config.overrideUserDestinationLocationType, null))) {
        errors.push('overrideUserStartLocation and overrideUserDestinationLocation are both locked to the same place.');
    }
}

/** The field state a host override stands for. */
function prefillFromOverride(value: string, type: LocationType | null | undefined, displayName: string | null | undefined): JourneyEndpointState {
    const trimmed = value.trim();
    const text = firstNonBlank(displayName) ?? trimmed;
    if (isCoordinateLocationType(type)) {
        const [lat, lon] = trimmed.split(',').map(part => part.trim());
        return {text, lat: lat ?? null, lon: lon ?? null, locationValue: trimmed, locationType: 'coordinates'};
    }
    return {text, lat: null, lon: null, locationValue: trimmed, locationType: type ?? 'address'};
}

/**
 * How one end of the route starts out. The host's override wins (locked or as an editable
 * default), then the remembered place, then an empty field.
 */
export function resolveEndpointPrefill(
    config: WidgetConfig,
    role: JourneyEndpointRole,
    cached: CachedLocation | null,
): JourneyEndpointPrefill {
    const override = role === 'origin' ? config.overrideUserStartLocation : config.overrideUserDestinationLocation;
    if (override) {
        const type = role === 'origin' ? config.overrideUserStartLocationType : config.overrideUserDestinationLocationType;
        const displayName = role === 'origin' ? config.overrideUserStartLocationDisplayName : config.overrideUserDestinationLocationDisplayName;
        const locked = role === 'origin' ? !!config.disableUserStartLocationField : !!config.disableUserDestinationLocationField;
        return {...prefillFromOverride(override, type, displayName), locked, source: 'override'};
    }
    if (cached && cached.value) {
        return {text: cached.value, lat: cached.lat, lon: cached.lon, locationValue: null, locationType: null, locked: false, source: 'cache'};
    }
    return {text: '', lat: null, lon: null, locationValue: null, locationType: null, locked: false, source: 'none'};
}

/** Whether the field holds something the search can use without asking the user to pick from the list. */
export function isEndpointResolved(state: JourneyEndpointState): boolean {
    return !!(state.lat && state.lon) || !!state.locationValue;
}

/** What the `/journey` request sends for one end of the route. */
export function endpointRequestParams(state: JourneyEndpointState): { location: string; type: LocationType } {
    if (state.lat && state.lon) return {location: `${state.lat},${state.lon}`, type: 'coordinates'};
    if (state.locationValue) return {location: state.locationValue, type: state.locationType ?? 'address'};
    return {location: state.text.trim(), type: 'address'};
}

/** Whether two ends of the route are the same place (same coordinates or the same name). */
export function sameEndpoint(a: JourneyEndpointState, b: JourneyEndpointState): boolean {
    if (a.lat && a.lon && b.lat && b.lon) {
        return Math.abs(Number(a.lat) - Number(b.lat)) < 1e-4 && Math.abs(Number(a.lon) - Number(b.lon)) < 1e-4;
    }
    const normalise = (state: JourneyEndpointState) => (state.locationValue ?? state.text).trim().toLowerCase().replace(/\s+/g, ' ');
    const na = normalise(a);
    return !!na && (na === normalise(b) || a.text.trim().toLowerCase() === b.text.trim().toLowerCase());
}

/** Swaps the two ends of the route. */
export function swapEndpoints(origin: JourneyEndpointState, destination: JourneyEndpointState): [JourneyEndpointState, JourneyEndpointState] {
    return [{...destination}, {...origin}];
}

/** The date, time and direction the form starts with. */
export interface JourneyDateTime {
    /** YYYY-MM-DD in the widget timezone */
    date: string;
    /** HH:mm in the widget timezone */
    time: string;
    arriveBy: boolean;
}

/** Today and now unless the host preset them; a preset date in the past falls back to today. */
export function initialJourneyDateTime(
    config: Pick<WidgetConfig, 'timezone' | 'journeyDate' | 'journeyTime' | 'journeyArriveBy'>,
    now: DateTime = DateTime.now(),
): JourneyDateTime {
    const local = now.setZone(config.timezone);
    const today = local.toISODate() as string;
    const date = config.journeyDate && config.journeyDate >= today ? config.journeyDate : today;
    const time = config.journeyTime ? DateTime.fromFormat(config.journeyTime, 'H:mm').toFormat('HH:mm') : local.toFormat('HH:mm');
    return {date, time, arriveBy: !!config.journeyArriveBy};
}

/** The instant a local date and time stand for, in UTC. */
export function journeyInstantUtc(date: string, time: string, timezone: string): DateTime {
    return DateTime.fromISO(`${date}T${time}`, {zone: timezone}).toUTC();
}

/** Inputs for one `/journey` request. */
export interface JourneyRequest {
    origin: JourneyEndpointState;
    destination: JourneyEndpointState;
    /** The instant the search is anchored to (departure, or arrival when `isArrival`). */
    instant: DateTime;
    isArrival: boolean;
    useFlex: boolean;
    language?: string | null;
}

/**
 * Query parameters for `GET /journey`. The backend reads `date` + `time` as UTC, so the
 * local choice is converted here - which can move the date (00:30 in Vienna is 23:30 UTC
 * the day before).
 */
export function buildJourneyParams(request: JourneyRequest): Record<string, string> {
    const from = endpointRequestParams(request.origin);
    const to = endpointRequestParams(request.destination);
    const utc = request.instant.toUTC();
    const params: Record<string, string> = {
        from_location: from.location,
        from_location_type: from.type,
        to_location: to.location,
        to_location_type: to.type,
        date: utc.toISODate() as string,
        time: utc.toFormat('HH:mm'),
        is_arrival: request.isArrival ? 'true' : 'false',
    };
    if (request.useFlex) params.use_flex = 'true';
    if (request.language) params.lang = request.language.toLowerCase();
    return params;
}

/**
 * The backend has no paging for `/journey`, so earlier and later connections are fetched
 * by searching again from the edge of what is shown: later = depart after the last
 * departure, earlier = arrive before the first arrival.
 */
export function pageQuery(connections: readonly Connection[], direction: 'earlier' | 'later'): { instant: DateTime; isArrival: boolean } | null {
    const timed = connections.filter(conn => !conn.connection_anytime);
    if (timed.length === 0) return null;
    if (direction === 'later') {
        const lastStart = DateTime.max(...timed.map(conn => DateTime.fromISO(conn.connection_start_timestamp, {zone: 'utc'})));
        return lastStart ? {instant: lastStart.plus({minutes: 1}), isArrival: false} : null;
    }
    const firstEnd = DateTime.min(...timed.map(conn => DateTime.fromISO(conn.connection_end_timestamp, {zone: 'utc'})));
    return firstEnd ? {instant: firstEnd.minus({minutes: 1}), isArrival: true} : null;
}

/** Identity of a connection across separate answers (ids restart at 0 in every answer). */
export function connectionKey(conn: Connection): string {
    const vehicles = (conn.connection_elements ?? [])
        .map(el => `${el.type}:${el.vehicle_name ?? ''}:${el.departure_time ?? ''}`)
        .join('|');
    return `${conn.connection_start_timestamp}|${conn.connection_end_timestamp}|${vehicles}`;
}

/** Adds connections not shown yet, keeping the list ordered by departure. */
export function mergeConnections(existing: readonly Connection[], incoming: readonly Connection[]): { merged: Connection[]; added: number } {
    const seen = new Set(existing.map(connectionKey));
    const fresh = incoming.filter(conn => {
        const key = connectionKey(conn);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    const merged = [...existing, ...fresh].sort((a, b) =>
        a.connection_start_timestamp.localeCompare(b.connection_start_timestamp)
        || a.connection_end_timestamp.localeCompare(b.connection_end_timestamp));
    return {merged, added: fresh.length};
}

/**
 * For an arrive-by search, drops connections that arrive long before the requested time
 * (the backend returns up to a day of them). Keeps everything when that would leave nothing.
 */
export function filterArriveByWindow(connections: Connection[], target: DateTime, hours: number = ARRIVE_BY_WINDOW_HOURS): Connection[] {
    const earliest = target.minus({hours});
    const kept = connections.filter(conn => conn.connection_anytime
        || DateTime.fromISO(conn.connection_end_timestamp, {zone: 'utc'}) >= earliest);
    return kept.length > 0 ? kept : connections;
}

/** The header title: journeyTitle, else activityName, else the localised default; '' means none. */
export function resolveJourneyTitle(config: Pick<WidgetConfig, 'journeyTitle' | 'activityName'>, defaultTitle: string): string {
    if (config.journeyTitle === '') return '';
    return firstNonBlank(config.journeyTitle, config.activityName) ?? defaultTitle;
}

/** Reads a remembered place, dropping it once its TTL has passed. */
export function readCachedLocation(storage: KeyValueStorage, key: string, ttlMinutes: number, now: number = Date.now()): CachedLocation | null {
    try {
        const raw = storage.getItem(key);
        if (!raw) return null;
        const data = JSON.parse(raw) as CachedLocation;
        if (data && data.value && now < data.timestamp + ttlMinutes * 60_000) return data;
        storage.removeItem(key);
        return null;
    } catch {
        return null;
    }
}

/** Remembers a place, and keeps a short list of recently picked ones (those with coordinates). */
export function writeCachedLocation(
    storage: KeyValueStorage,
    key: string,
    value: string,
    lat: string | number | null,
    lon: string | number | null,
    maxRecent: number,
    now: number = Date.now(),
): void {
    try {
        const entry: CachedLocation = {value, lat: lat != null && lat !== '' ? String(lat) : null, lon: lon != null && lon !== '' ? String(lon) : null, timestamp: now};
        storage.setItem(key, JSON.stringify(entry));
        if (entry.lat && entry.lon) {
            const others = readRecentLocations(storage, key, Number.POSITIVE_INFINITY, now).filter(item => item.value !== value);
            storage.setItem(`${key}_recent`, JSON.stringify([entry, ...others].slice(0, maxRecent)));
        }
    } catch (error) {
        console.error('Error saving location to cache:', error);
    }
}

/** Recently picked places (newest first) within the TTL. */
export function readRecentLocations(storage: KeyValueStorage, key: string, ttlMinutes: number, now: number = Date.now()): CachedLocation[] {
    try {
        const entries = JSON.parse(storage.getItem(`${key}_recent`) || '[]');
        return Array.isArray(entries)
            ? entries.filter(entry => entry && entry.value && entry.lat && entry.lon && now < entry.timestamp + ttlMinutes * 60_000)
            : [];
    } catch {
        return [];
    }
}

/** Evaluates a cache switch that may be a callback. */
export function cacheEnabled(setting: boolean | (() => boolean) | undefined | null): boolean {
    if (typeof setting === 'function') {
        try {
            return !!setting();
        } catch (error) {
            console.error('Error executing cache callback:', error);
            return false;
        }
    }
    return !!setting;
}
