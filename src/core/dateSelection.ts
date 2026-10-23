import {DateTime} from 'luxon';

/**
 * Pure date rules shared by the day strip and the calendar. Days are ISO strings
 * ('YYYY-MM-DD') in the activity's timezone, so they compare correctly as strings.
 */

/** Constraints coming from the config (overrides and fixed trip length). */
export interface RangeRules {
    /** Start day fixed by overrideActivityStartDate. */
    fixedStart: string | null;
    /** End day fixed by overrideActivityEndDate. */
    fixedEnd: string | null;
    /** activityDurationDaysFixed: picking a start also sets the end. */
    durationDays: number | null;
}

export interface RangeValue {
    start: string | null;
    end: string | null;
    /** True after the first tap of a free range, until the last day is picked. */
    awaitingEnd: boolean;
}

export function addDaysIso(iso: string, days: number): string {
    return DateTime.fromISO(iso, {zone: 'utc'}).plus({days}).toISODate() as string;
}

/** Number of days from start to end, both included. */
export function countDays(start: string, end: string): number {
    return Math.round(DateTime.fromISO(end, {zone: 'utc'}).diff(DateTime.fromISO(start, {zone: 'utc'}), 'days').days) + 1;
}

export function todayIso(timezone: string): string {
    return DateTime.now().setZone(timezone).toISODate() as string;
}

/** The ISO day a widget state Date stands for. State dates are UTC midnight (see isoToDate). */
export function dateToIso(date: Date | null | undefined): string | null {
    if (!date || isNaN(date.getTime())) return null;
    return DateTime.fromJSDate(date, {zone: 'utc'}).toISODate();
}

/** The widget state Date for an ISO day (UTC midnight, the convention used across the widget). */
export function isoToDate(iso: string): Date {
    return DateTime.fromISO(iso, {zone: 'utc'}).toJSDate();
}

/** True when the range is decided by the config and the user cannot change it. */
export function isRangeLocked(rules: RangeRules): boolean {
    if (rules.fixedStart && rules.fixedEnd) return true;
    return !!rules.durationDays && !!(rules.fixedStart || rules.fixedEnd);
}

/** First day the strip shows: today, or the fixed start if that is later. */
export function firstSelectableDay(today: string, rules: RangeRules | null): string {
    if (rules?.fixedStart && rules.fixedStart > today) return rules.fixedStart;
    return today;
}

/** Whether a day can be tapped (past days never; fixed bounds limit the free end). */
export function isDayDisabled(iso: string, today: string, rules: RangeRules | null): boolean {
    if (iso < today) return true;
    if (!rules) return false;
    if (rules.fixedStart && iso === rules.fixedStart) return true;
    if (rules.fixedEnd && iso === rules.fixedEnd) return true;
    if (rules.fixedStart && !rules.durationDays && iso < rules.fixedStart) return true;
    if (rules.fixedEnd && !rules.durationDays && iso > rules.fixedEnd) return true;
    return false;
}

/**
 * Applies one tap to a multi-day range. Free ranges take two taps (first day, last day);
 * a fixed trip length sets both ends at once; a fixed start or end only moves the other end.
 */
export function pickRangeDay(value: RangeValue, iso: string, rules: RangeRules): RangeValue {
    if (rules.fixedStart && rules.fixedEnd) return value;

    if (rules.durationDays) {
        if (rules.fixedStart || rules.fixedEnd) return value;
        return {start: iso, end: addDaysIso(iso, rules.durationDays - 1), awaitingEnd: false};
    }
    if (rules.fixedStart) {
        return iso >= rules.fixedStart ? {start: rules.fixedStart, end: iso, awaitingEnd: false} : value;
    }
    if (rules.fixedEnd) {
        return iso <= rules.fixedEnd ? {start: iso, end: rules.fixedEnd, awaitingEnd: false} : value;
    }

    if (!value.awaitingEnd || !value.start || iso < value.start) {
        return {start: iso, end: iso, awaitingEnd: true};
    }
    return {start: value.start, end: iso, awaitingEnd: false};
}

/** The config fields that decide how the date field behaves. */
export interface DateFieldConfig {
    multiday?: boolean;
    overrideActivityStartDate?: string | null;
    overrideActivityEndDate?: string | null;
    activityDurationDaysFixed?: number | string | null;
    hideOverriddenActivityStartDate?: boolean;
}

export interface DateFieldMode {
    /** Range constraints (multi-day only). */
    rules: RangeRules | null;
    /** The config decides the date(s): show them, offer no choice. */
    locked: boolean;
    /** Locked and the host asked not to show it at all. */
    hidden: boolean;
}

function toIsoDay(value: string | null | undefined): string | null {
    if (!value) return null;
    const dt = DateTime.fromISO(value, {zone: 'utc'});
    return dt.isValid ? dt.toISODate() : null;
}

export function getDateFieldMode(config: DateFieldConfig): DateFieldMode {
    if (!config.multiday) {
        const locked = !!config.overrideActivityStartDate;
        return {rules: null, locked, hidden: locked && !!config.hideOverriddenActivityStartDate};
    }
    const duration = config.activityDurationDaysFixed ? parseInt(String(config.activityDurationDaysFixed), 10) : null;
    const rules: RangeRules = {
        fixedStart: toIsoDay(config.overrideActivityStartDate),
        fixedEnd: toIsoDay(config.overrideActivityEndDate),
        durationDays: duration && duration > 0 ? duration : null,
    };
    const locked = isRangeLocked(rules);
    return {rules, locked, hidden: locked && !!config.hideOverriddenActivityStartDate};
}
