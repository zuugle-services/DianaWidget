/**
 * Per-date time windows: turns `dateList` (plain dates and/or entries with their own window)
 * and schema.org `openingHours` into the list of selectable date slots, each carrying the
 * activity time window that applies to it.
 *
 * Pure functions (no DOM, no "now" of their own), so they are easy to test.
 */

import { DateTime } from 'luxon';
import { DEFAULT_OPENING_HOURS_HORIZON_DAYS } from '../constants/defaults';
import type { ActivityWindow, DateListEntry, DateListItem, DateSlot, OpeningHoursSpecification, WidgetConfig } from '../types';

export type { ActivityWindow, DateSlot };

/** Safety cap for the number of days a single dated openingHours entry may expand to. */
const MAX_DAYS_PER_ENTRY = 366;

const TIME_REGEX = /^(2[0-3]|[01]?[0-9]):([0-5]?[0-9])(:([0-5]?[0-9]))?$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const WINDOW_TIME_FIELDS = ['earliestStartTime', 'latestStartTime', 'earliestEndTime', 'latestEndTime'] as const;
const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** The global window from the `activity*` options. */
export function globalActivityWindow(config: WidgetConfig): ActivityWindow {
    return {
        earliestStartTime: config.activityEarliestStartTime,
        latestStartTime: config.activityLatestStartTime,
        earliestEndTime: config.activityEarliestEndTime,
        latestEndTime: config.activityLatestEndTime,
        durationMinutes: config.activityDurationMinutes,
    };
}

/** Minutes since midnight for HH:MM(:SS), or null when malformed. */
export function timeToMinutes(time: unknown): number | null {
    if (typeof time !== 'string' || !TIME_REGEX.test(time.trim())) return null;
    const [h, m] = time.trim().split(':').map(Number);
    return h * 60 + m;
}

function minutesToTime(total: number): string {
    const clamped = Math.max(0, Math.min(total, 23 * 60 + 59));
    return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

/** "10:00", "10:00:00" or "10:00:00+01:00" -> "10:00"; null when unreadable. */
function normalizeSchemaTime(time: unknown): string | null {
    if (typeof time !== 'string') return null;
    const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h === 24 && m === 0) return '24:00';
    if (h > 23 || m > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toDurationMinutes(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const n = typeof value === 'number' ? value : parseInt(String(value), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
}

function isValidIsoDate(value: unknown): value is string {
    return typeof value === 'string' && DATE_REGEX.test(value) && DateTime.fromISO(value).isValid;
}

function hasOwn(entry: DateListEntry, field: keyof DateListEntry): boolean {
    const value = entry[field];
    return value !== undefined && value !== null && value !== '';
}

/** Whether an object entry carries any time information of its own. */
function hasOwnWindow(entry: DateListEntry): boolean {
    return WINDOW_TIME_FIELDS.some(f => hasOwn(entry, f)) || hasOwn(entry, 'opens') || hasOwn(entry, 'closes');
}

/**
 * Resolves one `dateList` item into a slot. Explicit times win over times derived from
 * `opens`/`closes`, which win over the global window.
 *
 * opens/closes derivation (d = duration): earliestStart = opens, latestStart = closes - d (not
 * before opens), earliestEnd = opens + d (not after closes), latestEnd = closes.
 */
export function resolveDateListItem(item: DateListItem, global: ActivityWindow): DateSlot {
    if (typeof item === 'string') {
        return {date: item, window: {...global}, rangeLabel: null};
    }
    const duration = hasOwn(item, 'durationMinutes') ? item.durationMinutes : global.durationMinutes;
    const window: ActivityWindow = {...global, durationMinutes: duration};

    const opens = timeToMinutes(item.opens);
    const closes = timeToMinutes(item.closes);
    if (opens !== null && closes !== null) {
        const d = toDurationMinutes(duration) ?? 0;
        window.earliestStartTime = minutesToTime(opens);
        window.latestStartTime = minutesToTime(Math.max(opens, closes - d));
        window.earliestEndTime = minutesToTime(Math.min(closes, opens + d));
        window.latestEndTime = minutesToTime(closes);
    }
    for (const field of WINDOW_TIME_FIELDS) {
        if (hasOwn(item, field)) window[field] = item[field];
    }

    let rangeLabel: string | null = null;
    if (hasOwnWindow(item)) {
        const from = opens !== null && closes !== null ? minutesToTime(opens) : window.earliestStartTime;
        const to = opens !== null && closes !== null ? minutesToTime(closes) : window.latestEndTime;
        const fromMin = timeToMinutes(from);
        const toMin = timeToMinutes(to);
        if (fromMin !== null && toMin !== null) rangeLabel = `${minutesToTime(fromMin)}–${minutesToTime(toMin)}`;
    }
    return {date: item.date, window, rangeLabel};
}

/** Day index 0 (Monday) .. 6 (Sunday) for "Monday", "https://schema.org/Monday", "schema:Monday". */
function parseDayOfWeek(value: unknown): number | null {
    if (typeof value !== 'string') return null;
    const name = value.trim().replace(/^(https?:\/\/schema\.org\/|schema:)/i, '').toLowerCase();
    const index = DAY_NAMES.indexOf(name);
    return index >= 0 ? index : null;
}

function datePart(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const date = value.trim().slice(0, 10);
    return isValidIsoDate(date) ? date : null;
}

/**
 * Expands a schema.org openingHoursSpecification array into `dateList` entries
 * ({date, opens, closes}), sorted by date and opening time.
 *
 * - Entries with `dayOfWeek` recur weekly, from max(today, validFrom) to
 *   min(validThrough, today + horizonDays - 1).
 * - Entries without `dayOfWeek` are dated: every day from validFrom to validThrough
 *   (validThrough defaults to validFrom), not limited by the horizon. Without validFrom they are skipped.
 * - A dated entry replaces all recurring entries on its days (special opening hours).
 * - opens == closes means closed: no block, but as a dated entry it still closes that day.
 * - closes before opens is an overnight block; it is cut at 23:59 (closes "00:00"/"24:00" = end of day).
 * - Days before today are dropped.
 */
export function expandOpeningHours(
    specs: OpeningHoursSpecification[],
    todayIso: string,
    horizonDays: number = DEFAULT_OPENING_HOURS_HORIZON_DAYS
): DateListEntry[] {
    const today = DateTime.fromISO(todayIso, {zone: 'utc'}).startOf('day');
    const horizonEnd = today.plus({days: Math.max(1, Math.floor(horizonDays)) - 1});
    type Block = {opens: string; closes: string};
    const dated = new Map<string, Block[]>();
    const recurring = new Map<string, Block[]>();

    const push = (map: Map<string, Block[]>, date: string, block: Block | null) => {
        if (!map.has(date)) map.set(date, []);
        if (block) map.get(date)!.push(block);
    };

    for (const spec of Array.isArray(specs) ? specs : []) {
        if (!spec || typeof spec !== 'object') continue;
        const opens = normalizeSchemaTime(spec.opens);
        let closes = normalizeSchemaTime(spec.closes);
        if (!opens || !closes || opens === '24:00') continue;
        const opensMin = timeToMinutes(opens)!;
        const closed = opens === closes;
        if (closes === '24:00' || (!closed && (timeToMinutes(closes) ?? 0) < opensMin)) closes = '23:59';
        const block: Block | null = closed ? null : {opens, closes};

        const rawDays = spec.dayOfWeek === undefined || spec.dayOfWeek === null
            ? [] : (Array.isArray(spec.dayOfWeek) ? spec.dayOfWeek : [spec.dayOfWeek]);
        const days = rawDays.map(parseDayOfWeek).filter((d): d is number => d !== null);
        const from = datePart(spec.validFrom);
        const through = datePart(spec.validThrough);

        if (rawDays.length > 0) {
            if (days.length === 0) continue;
            let cursor = from && DateTime.fromISO(from, {zone: 'utc'}) > today ? DateTime.fromISO(from, {zone: 'utc'}) : today;
            const end = through && DateTime.fromISO(through, {zone: 'utc'}) < horizonEnd ? DateTime.fromISO(through, {zone: 'utc'}) : horizonEnd;
            while (cursor <= end) {
                if (days.includes(cursor.weekday - 1)) push(recurring, cursor.toISODate()!, block);
                cursor = cursor.plus({days: 1});
            }
        } else {
            if (!from) continue;
            let cursor = DateTime.fromISO(from, {zone: 'utc'});
            const end = DateTime.fromISO(through ?? from, {zone: 'utc'});
            for (let i = 0; cursor <= end && i < MAX_DAYS_PER_ENTRY; i++) {
                if (cursor >= today) push(dated, cursor.toISODate()!, block);
                cursor = cursor.plus({days: 1});
            }
        }
    }

    const entries: DateListEntry[] = [];
    const allDates = new Set([...dated.keys(), ...recurring.keys()]);
    for (const date of allDates) {
        const blocks = dated.has(date) ? dated.get(date)! : recurring.get(date)!;
        const seen = new Set<string>();
        for (const b of blocks) {
            const key = `${b.opens}-${b.closes}`;
            if (seen.has(key)) continue;
            seen.add(key);
            entries.push({date, opens: b.opens, closes: b.closes});
        }
    }
    return entries.sort((a, b) => a.date.localeCompare(b.date) || (a.opens ?? '').localeCompare(b.opens ?? ''));
}

/** The date items the dropdown is built from: dateList wins over openingHours. */
export function getDateItems(config: WidgetConfig, todayIso: string): DateListItem[] | null {
    if (Array.isArray(config.dateList)) return config.dateList;
    if (Array.isArray(config.openingHours)) {
        return expandOpeningHours(config.openingHours, todayIso, config.openingHoursHorizonDays ?? DEFAULT_OPENING_HOURS_HORIZON_DAYS);
    }
    return null;
}

/** Whether the config asks for a date dropdown at all (it is not used for multiday or a fixed date). */
export function usesDateDropdown(config: WidgetConfig): boolean {
    return !config.multiday && !config.overrideActivityStartDate
        && (Array.isArray(config.dateList) || Array.isArray(config.openingHours));
}

/**
 * All selectable slots from today on, sorted by date and start time. Several entries on the
 * same date stay separate options (one per opening block). Exact duplicates are merged.
 * Returns null when neither dateList nor openingHours is configured.
 */
export function buildDateSlots(config: WidgetConfig, todayIso: string): DateSlot[] | null {
    const items = getDateItems(config, todayIso);
    if (!items) return null;
    const global = globalActivityWindow(config);
    const seen = new Set<string>();
    const slots: DateSlot[] = [];
    for (const item of items) {
        const date = typeof item === 'string' ? item : item?.date;
        if (!isValidIsoDate(date) || date < todayIso) continue;
        const slot = resolveDateListItem(item, global);
        const key = JSON.stringify([slot.date, slot.window, slot.rangeLabel]);
        if (seen.has(key)) continue;
        seen.add(key);
        slots.push(slot);
    }
    return slots.sort((a, b) => a.date.localeCompare(b.date)
        || (timeToMinutes(a.window.earliestStartTime) ?? 0) - (timeToMinutes(b.window.earliestStartTime) ?? 0));
}

/** Validation of dateList / openingHours. Errors make the config invalid; warnings are logged. */
export function validateDateWindowConfig(config: WidgetConfig): {errors: string[]; warnings: string[]} {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.dateList !== undefined && config.dateList !== null) {
        if (!Array.isArray(config.dateList)) {
            errors.push(`Invalid dateList: must be an array of 'YYYY-MM-DD' strings or {date, ...} objects.`);
        } else {
            config.dateList.forEach((item, i) => {
                // A malformed plain date was always skipped silently; keep it non-fatal.
                (typeof item === 'string' ? warnings : errors).push(...validateDateListItem(item, i, config));
            });
        }
    }

    if (config.openingHours !== undefined && config.openingHours !== null) {
        if (!Array.isArray(config.openingHours)) {
            errors.push(`Invalid openingHours: must be a schema.org openingHoursSpecification array.`);
        } else {
            config.openingHours.forEach((spec, i) => {
                const where = `openingHours[${i}]`;
                if (!spec || typeof spec !== 'object') {
                    errors.push(`Invalid ${where}: must be an object.`);
                    return;
                }
                if (!normalizeSchemaTime(spec.opens) || !normalizeSchemaTime(spec.closes)) {
                    errors.push(`Invalid ${where}: 'opens' and 'closes' must be times (HH:MM). Got opens='${spec.opens}', closes='${spec.closes}'.`);
                }
                const days = spec.dayOfWeek === undefined || spec.dayOfWeek === null ? [] : [].concat(spec.dayOfWeek as never);
                days.forEach(d => {
                    if (parseDayOfWeek(d) === null) errors.push(`Invalid ${where}.dayOfWeek '${d}': expected a day name like 'Monday' or 'https://schema.org/Monday'.`);
                });
                for (const key of ['validFrom', 'validThrough'] as const) {
                    if (spec[key] !== undefined && spec[key] !== null && !datePart(spec[key])) {
                        errors.push(`Invalid ${where}.${key} '${spec[key]}': expected YYYY-MM-DD.`);
                    }
                }
                if (days.length === 0 && !spec.validFrom) {
                    warnings.push(`${where} has neither dayOfWeek nor validFrom and is ignored.`);
                }
            });
            if (Array.isArray(config.dateList)) {
                warnings.push(`Both dateList and openingHours are set: openingHours is ignored, dateList is used.`);
            }
        }
    }

    const horizon = config.openingHoursHorizonDays;
    if (horizon !== undefined && horizon !== null && (!Number.isInteger(horizon) || horizon < 1)) {
        errors.push(`Invalid openingHoursHorizonDays '${horizon}'. Must be a positive integer.`);
    }
    return {errors, warnings};
}

function validateDateListItem(item: DateListItem, index: number, config: WidgetConfig): string[] {
    const where = `dateList[${index}]`;
    if (typeof item === 'string') {
        return isValidIsoDate(item) ? [] : [`Invalid ${where} '${item}': expected 'YYYY-MM-DD'. The date is ignored.`];
    }
    if (!item || typeof item !== 'object') {
        return [`Invalid ${where}: must be a 'YYYY-MM-DD' string or a {date, ...} object.`];
    }
    const errors: string[] = [];
    if (!isValidIsoDate(item.date)) errors.push(`Invalid ${where}.date '${item.date}': expected 'YYYY-MM-DD'.`);
    for (const field of [...WINDOW_TIME_FIELDS, 'opens', 'closes'] as const) {
        if (hasOwn(item, field) && timeToMinutes(item[field]) === null) {
            errors.push(`Invalid ${where}.${field} '${item[field]}': expected HH:MM or HH:MM:SS.`);
        }
    }
    if (hasOwn(item, 'durationMinutes') && toDurationMinutes(item.durationMinutes) === null) {
        errors.push(`Invalid ${where}.durationMinutes '${item.durationMinutes}': must be a positive integer.`);
    }
    if (hasOwn(item, 'opens') !== hasOwn(item, 'closes')) {
        errors.push(`Invalid ${where}: 'opens' and 'closes' must be given together.`);
    }
    if (errors.length > 0) return errors;

    if (hasOwn(item, 'opens') && timeToMinutes(item.closes)! <= timeToMinutes(item.opens)!) {
        errors.push(`Invalid ${where}: closes (${item.closes}) must be after opens (${item.opens}).`);
        return errors;
    }
    const {window} = resolveDateListItem(item, globalActivityWindow(config));
    const es = timeToMinutes(window.earliestStartTime);
    const ls = timeToMinutes(window.latestStartTime);
    const ee = timeToMinutes(window.earliestEndTime);
    const le = timeToMinutes(window.latestEndTime);
    if (es !== null && ls !== null && ls < es) {
        errors.push(`Invalid ${where}: latestStartTime (${window.latestStartTime}) cannot be before earliestStartTime (${window.earliestStartTime}).`);
    }
    if (ee !== null && le !== null && le < ee) {
        errors.push(`Invalid ${where}: latestEndTime (${window.latestEndTime}) cannot be before earliestEndTime (${window.earliestEndTime}).`);
    }
    return errors;
}

/**
 * Which global options every date already brings itself, so they need not be configured
 * globally: the four times when every item has its own times (opens/closes or all four),
 * the duration when every dateList item has durationMinutes. openingHours entries bring
 * their times but never a duration.
 */
export function selfSufficientGlobals(config: WidgetConfig): {times: boolean; duration: boolean} {
    const none = {times: false, duration: false};
    if (config.multiday || config.overrideActivityStartDate) return none;
    if (Array.isArray(config.dateList)) {
        const items = config.dateList;
        // No date at all needs no global window: the widget hides (hideWhenNoFutureDates) or
        // falls back to the date picker with the whole day. Still needs a duration.
        if (items.length === 0) return {times: true, duration: false};
        const objects = items.every(i => i && typeof i === 'object');
        if (!objects) return none;
        const entries = items as DateListEntry[];
        return {
            times: entries.every(e => (hasOwn(e, 'opens') && hasOwn(e, 'closes')) || WINDOW_TIME_FIELDS.every(f => hasOwn(e, f))),
            duration: entries.every(e => hasOwn(e, 'durationMinutes')),
        };
    }
    // Also an empty array: a page without opening hours must not turn into a config error.
    if (Array.isArray(config.openingHours)) {
        return {times: true, duration: false};
    }
    return none;
}
