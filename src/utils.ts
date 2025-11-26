/**
 * Utility functions for DianaWidget
 */
import {DateTime} from 'luxon';
import type { TranslationFunction } from './types';

/**
 * Gets the localized month name.
 * @param monthIndex - The 0-based index of the month.
 * @param tFunction - The translation function.
 * @returns The localized month name.
 */
export function getMonthName(monthIndex: number, tFunction: TranslationFunction): string {
    // Ensure monthIndex is within a valid range if necessary, or trust tFunction to handle it.
    // Assuming tFunction can access an array like `months.0`, `months.1` etc., or a nested object
    // For example, if translations are structured as: { EN: { months: ["Jan", "Feb", ...] } }
    // and tFunction is bound to the correct language object, then tFunction(`months.${monthIndex}`) might work
    // if tFunction handles dot notation for array access or if months is an object {0: "Jan", 1: "Feb"}.
    // A safer bet if `months` is an array in the translation file:
    const monthsArray = tFunction('months'); // This should return the array ["Jan", "Feb", ...]
    if (Array.isArray(monthsArray) && monthIndex >= 0 && monthIndex < monthsArray.length) {
        return monthsArray[monthIndex];
    }
    return `months.${monthIndex}`; // Fallback or error indicator
}

/**
 * Gets the localized short day name.
 * @param dayIndex - The 0-based index of the day (e.g., 0 for Monday).
 * @param tFunction - The translation function.
 * @returns The localized short day name.
 */
export function getShortDayName(dayIndex: number, tFunction: TranslationFunction): string {
    // Similar to getMonthName, assuming tFunction('shortDays') returns the array ["M", "T", ...]
    const daysArray = tFunction('shortDays');
    if (Array.isArray(daysArray) && dayIndex >= 0 && dayIndex < daysArray.length) {
        return daysArray[dayIndex];
    }
    return `shortDays.${dayIndex}`; // Fallback
}


/**
 * Formats a Date object for display according to locale and timezone.
 * @param date - The date object to format.
 * @param locale - The locale string (e.g., 'en-GB', 'de-DE').
 * @param timeZone - The timezone for formatting.
 * @returns The formatted date string, or an empty string if date is invalid.
 */
export function formatDateForDisplay(date: Date, locale: string, timeZone: string = "UTC"): string {
    if (!date || isNaN(date.getTime())) return '';
    // Using Luxon for robust date formatting, consistent with the rest of the widget
    try {
        // Ensure the input JS Date is correctly interpreted (e.g., if it's UTC or local)
        // If `date` is a JS Date object from a picker, it might be local midnight.
        // If it's from internal state, it might be UTC midnight.
        // For display, we want to show it in the target `timeZone`.
        // Let's assume `date` represents a specific day, and we want to format that day in `timeZone`.
        return DateTime.fromJSDate(date, {zone: 'utc'}) // Assume JS Date is UTC midnight for consistency
            .setZone(timeZone) // Convert to target timezone for display day
            .setLocale(locale)
            .toFormat('dd. MMM yyyy');
    } catch (error) {
        console.error("Error formatting date for display:", error);
        // Fallback to native toLocaleDateString if Luxon fails
        const options: Intl.DateTimeFormatOptions = {day: "numeric", month: "short", year: "numeric", timeZone: timeZone};
        try {
            return date.toLocaleDateString(locale, options);
        } catch (nativeError) {
            console.error("Native toLocaleDateString also failed:", nativeError);
            return ''; // Ultimate fallback
        }
    }
}

/**
 * Throttles a function using requestAnimationFrame to synchronize with browser repaints.
 * Ensures the function is called at most once per frame during frequent events.
 * @param func The function to throttle.
 * @param _delay The delay in ms (not directly used by rAF, but common for throttle)
 * @returns The throttled function.
 */
export function throttle<T extends (...args: unknown[]) => void>(func: T, _delay?: number): (...args: Parameters<T>) => void {
    let isScheduled = false;
    let lastArgs: Parameters<T> | null = null;
    let lastContext: unknown = null;

    return function (this: unknown, ...args: Parameters<T>): void {
        lastArgs = args;
        lastContext = this;

        if (!isScheduled) {
            isScheduled = true;
            requestAnimationFrame(() => {
                func.apply(lastContext, lastArgs as Parameters<T>);
                isScheduled = false;
            });
        }
    };
}

/**
 * Debounces a function, delaying its execution until after a specified wait time
 * has elapsed since the last time it was invoked.
 * @param func - The function to debounce.
 * @param wait - The wait time in milliseconds.
 * @returns The debounced function.
 */
export function debounce<T extends (...args: unknown[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return function executedFunction(this: unknown, ...args: Parameters<T>): void {
        const context = this;
        const later = function (): void {
            timeout = null;
            func.apply(context, args);
        };
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(later, wait);
    };
}


/**
 * Error code map type
 */
type ErrorCodeMap = Record<string | number, string>;

/**
 * Maps API error codes to translation keys.
 * @param errorCode - The error code from the API.
 * @returns The translation key for the error message.
 */
export function getApiErrorTranslationKey(errorCode: string | number): string {
    const codeMap: ErrorCodeMap = {
        1001: 'errors.api.queryParamMissing',
        1002: 'errors.api.invalidLimitParam',
        1003: 'errors.api.internalError',
        2001: 'errors.api.invalidUserStartCoordinates',
        2002: 'errors.api.geocodeUserStartFailed',
        2003: 'errors.api.internalError',
        2004: 'errors.api.unsupportedUserStartType',
        2005: 'errors.api.invalidActivityStartCoordinates',
        2006: 'errors.api.geocodeActivityStartFailed',
        2007: 'errors.api.internalError',
        2008: 'errors.api.unsupportedActivityStartType',
        2009: 'errors.api.invalidActivityEndCoordinates',
        2010: 'errors.api.geocodeActivityEndFailed',
        2011: 'errors.api.internalError',
        2012: 'errors.api.unsupportedActivityEndType',
        '2017-1': 'errors.api.noToConnectionsFound',
        '2017-2': 'errors.api.noFromConnectionsFound',
        '2017-2F': 'errors.api.noFromConnectionsFoundFallback',
        '2017-2F-1': 'errors.api.noFromConnectionsFoundFallbackNotToday',
        '2018-1': 'errors.api.toConnectionsNoScore',
        '2018-2': 'errors.api.fromConnectionsNoScore',
        '2019-1': 'errors.api.noToConnectionsMergingMightFail',
        '2019-2': 'errors.api.noFromConnectionsMergingMightFail',
        '2020-1': 'errors.api.noToConnectionsMergingFailed',
        '2020-2': 'errors.api.noFromConnectionsMergingFailed',
        '2021-1': 'errors.api.noToConnectionsTimeWindow',
        '2021-2': 'errors.api.noFromConnectionsTimeWindow',
        '2022-1': 'errors.api.noToConnectionsAfterCurrentTime',
        '2023-1': 'errors.api.noToConnectionsFilteredByDuration',
        '2023-2': 'errors.api.noFromConnectionsFilteredByDuration',
        2024: 'errors.api.noReturnConnectionMatchingIncoming',
        '2025-1': 'errors.api.internalError',
        '2025-2': 'errors.api.internalError',
        '2026-1': 'errors.api.internalError',
        3001: 'errors.api.internalError',
        3002: 'errors.api.internalError',
        3003: 'errors.api.internalError',
        3004: 'errors.api.internalError',
        4001: 'errors.api.reverseGeocodeParameterMissing',
        4002: 'errors.api.internalError',
        5001: 'errors.api.sharedLinkInvalid',
        5002: 'errors.api.internalError',
        6001: 'errors.api.monthlyQuotaExceeded',
        'APP_INVALID_DATA': 'errors.api.invalidDataReceived'
    };
    return codeMap[errorCode] || 'errors.api.unknown';
}

