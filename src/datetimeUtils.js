import {DateTime} from 'luxon';

/**
 * Calculates the initial start date for the activity.
 * If the current time plus a buffer (1 hour + activity duration) is past the activity's latest end time for today,
 * it defaults to tomorrow. Otherwise, it defaults to today.
 * @param {string} timezone - The timezone string (e.g., "Europe/Vienna").
 * @param {string} activityLatestEndTime - The latest end time for the activity (HH:MM or HH:MM:SS).
 * @param {string|number} activityDurationMinutes - The duration of the activity in minutes.
 * @returns {Date} The calculated initial start date as a JavaScript Date object.
 */
export function calculateInitialStartDate(timezone, activityLatestEndTime, activityDurationMinutes) {
    let initialDate;
    try {
        const now = DateTime.now().setZone(timezone);
        const [endHours, endMinutes, endSeconds] = ([...(activityLatestEndTime.split(':')), '0', '0']).slice(0, 3).map(Number);
        const latestEndTimeToday = now.set({
            hour: endHours, minute: endMinutes, second: endSeconds || 0, millisecond: 0
        });
        const durationMinutesNum = parseInt(activityDurationMinutes, 10);
        // Threshold is latest end time minus activity duration minus a 1-hour travel buffer
        const thresholdTime = latestEndTimeToday.minus({
            minutes: durationMinutesNum, hours: 1
        });

        if (now > thresholdTime) {
            initialDate = now.plus({days: 1}).startOf('day').toObject();
        } else {
            initialDate = now.startOf('day').toObject();
        }
        initialDate = new Date(initialDate["year"], initialDate["month"] - 1, initialDate["day"]);
    } catch (error) {
        console.error("Error calculating initial start date, defaulting to today:", error);
        initialDate = new Date(); // Fallback to current date
    }
    return initialDate;
}


/**
 * Converts a local time string (HH:MM or HH:MM:SS) from a given timezone
 * to a UTC time string (HH:MM:SS) for a specific JavaScript Date object.
 * @param {string} localTime - The local time string (e.g., "14:30").
 * @param {Date} date - The JavaScript Date object representing the date.
 * @param {string} timezone - The timezone string (e.g., "Europe/Vienna").
 * @returns {string} The UTC time string in HH:mm:ss format, or "00:00:00" on error.
 */
export function convertLocalTimeToUTC(localTime, date, timezone) {
    try {
        const [hours, minutes, seconds] = ([...(localTime.split(':')), '0', '0']).slice(0, 3).map(Number);
        const jsDate = new Date(date); // Ensure it's a JS Date

        const localDt = DateTime.fromObject({
                year: jsDate.getFullYear(), // Use getFullYear for JS Date
                month: jsDate.getMonth() + 1, // JS Date months are 0-indexed
                day: jsDate.getDate(),    // JS Date days are 1-indexed
                hour: hours,
                minute: minutes,
                second: seconds || 0
            },
            {
                zone: timezone
            }
        );

        if (!localDt.isValid) {
            throw new Error(`Invalid local time, date, or timezone: ${localTime}, ${date}, ${timezone}. Reason: ${localDt.invalidReason}`);
        }
        return localDt.toUTC().toFormat('HH:mm:ss');
    } catch (error) {
        console.error("Error converting local time to UTC:", error);
        return "00:00:00"; // Fallback
    }
}

/**
 * Converts a local time string (HH:MM or HH:MM:SS) for a specific JavaScript Date object
 * from a given timezone to a full UTC ISO 8601 datetime string.
 * @param {string} localTime - The local time string (e.g., "14:30").
 * @param {Date} date - The JavaScript Date object representing the date.
 * @param {string} timezone - The timezone string (e.g., "Europe/Vienna").
 * @returns {string} The UTC datetime string in ISO 8601 format, or a fallback on error.
 */
export function convertLocalTimeToUTCDatetime(localTime, date, timezone) {
    try {
        const [hours, minutes, seconds] = ([...(localTime.split(':')), '0', '0']).slice(0, 3).map(Number);
        const jsDate = new Date(date);

        const localDt = DateTime.fromObject({
                year: jsDate.getFullYear(),
                month: jsDate.getMonth() + 1,
                day: jsDate.getDate(),
                hour: hours,
                minute: minutes,
                second: seconds || 0
            },
            {
                zone: timezone
            }
        );

        if (!localDt.isValid) {
            throw new Error(`Invalid local time, date, or timezone for UTC datetime conversion: ${localTime}, ${date}, ${timezone}. Reason: ${localDt.invalidReason}`);
        }
        return localDt.toUTC().toISO();
    } catch (error) {
        console.error("Error converting local time to UTC datetime:", error);
        return "0000-00-00T00:00:00Z"; // Fallback ISO string
    }
}

/**
 * Converts a configuration time string (HH:MM or HH:MM:SS) for a specific JavaScript Date object
 * to the display timezone (which is also the configured timezone).
 * Returns time in HH:mm format.
 * @param {string} configTime - The configuration time string (e.g., "09:00").
 * @param {Date} date - The JavaScript Date object.
 * @param {string} timezone - The target display timezone.
 * @returns {string} The time string in HH:mm format in the local timezone, or "--:--" on error.
 */
export function convertConfigTimeToLocalTime(configTime, date, timezone) {
    try {
        const [hours, minutes, seconds] = ([...(configTime.split(':')), '0', '0']).slice(0, 3).map(Number);
        const jsDate = new Date(date);

        const localDt = DateTime.fromObject({
                year: jsDate.getFullYear(),
                month: jsDate.getMonth() + 1,
                day: jsDate.getDate(),
                hour: hours,
                minute: minutes,
                second: seconds || 0
            },
            {
                zone: timezone
            }
        );

        if (!localDt.isValid) {
            throw new Error(`Invalid config time or timezone for local time conversion: ${configTime}, ${timezone}. Reason: ${localDt.invalidReason}`);
        }
        return localDt.toFormat('HH:mm');
    } catch (error) {
        console.error("Error converting config time to local time:", error);
        return "--:--";
    }
}


/**
 * Converts a UTC ISO 8601 timestamp string to the specified local timezone.
 * Returns time in HH:mm format.
 * @param {string} isoString - The UTC ISO 8601 timestamp string.
 * @param {string} timezone - The target local timezone string (e.g., "Europe/Vienna").
 * @returns {string} The time string in HH:mm format in the local timezone, or "--:--" on error.
 */
export function convertUTCToLocalTime(isoString, timezone) {
    try {
        const utcDt = DateTime.fromISO(isoString, {zone: 'utc'});
        if (!utcDt.isValid) {
            throw new Error(`Invalid UTC timestamp for local time conversion: ${isoString}. Reason: ${utcDt.invalidReason}`);
        }
        return utcDt.setZone(timezone).toFormat('HH:mm');
    } catch (error) {
        console.error("Error converting UTC to local time:", error);
        return "--:--";
    }
}

/**
 * Calculates the difference between two ISO 8601 timestamps (assumed UTC).
 * Returns a human-readable duration string (e.g., "45 min", "1:30 h").
 * @param {string} startISO - The start ISO 8601 timestamp.
 * @param {string} endISO - The end ISO 8601 timestamp.
 * @param {function} tFunction - The translation function for "durationMinutesShort" and "durationHoursShort".
 * @returns {string} Human-readable duration string, or "--" on error.
 */
export function calculateTimeDifference(startISO, endISO, tFunction) {
    try {
        const start = DateTime.fromISO(startISO, {zone: 'utc'});
        const end = DateTime.fromISO(endISO, {zone: 'utc'});
        if (!start.isValid || !end.isValid) {
            throw new Error(`Invalid date format for time difference: ${startISO} or ${endISO}`);
        }
        const diff = end.diff(start, ['hours', 'minutes']);
        const hours = Math.floor(diff.as('hours'));
        const minutes = Math.round(diff.as('minutes')) % 60;

        if (hours === 0) {
            return `${minutes} ${tFunction("durationMinutesShort")}`;
        } else {
            return `${hours}:${String(minutes).padStart(2, '0')}${tFunction("durationHoursShort")}`;
        }
    } catch (error) {
        console.error("Error calculating time difference:", error);
        return "--";
    }
}

/**
 * Adds a specified number of minutes to a UTC ISO 8601 datetime string.
 * @param {string} dateISO - The UTC ISO 8601 datetime string.
 * @param {number} minutes - The number of minutes to add (can be negative).
 * @returns {string} The new UTC ISO 8601 datetime string after adding minutes.
 * @throws {Error} if the input date format is invalid.
 */
export function addMinutesToDate(dateISO, minutes) {
    const dateTime = DateTime.fromISO(dateISO, {zone: 'utc'});
    if (!dateTime.isValid) throw new Error(`Invalid date format for adding minutes: ${dateISO}`);
    return dateTime.plus({minutes}).toISO();
}

/**
 * Compares two time strings (HH:MM) in a given timezone and returns the later one.
 * @param {string} time1 - The first time string.
 * @param {string} time2 - The second time string.
 * @param {string} timezone - The timezone for comparison.
 * @returns {string} The later time string in HH:mm format, or a fallback on error.
 */
export function getLaterTime(time1, time2, timezone) {
    try {
        const t1 = DateTime.fromFormat(time1, 'HH:mm', {zone: timezone});
        const t2 = DateTime.fromFormat(time2, 'HH:mm', {zone: timezone});
        if (!t1.isValid || !t2.isValid) {
            throw new Error(`Invalid time format for 'getLaterTime' comparison: ${time1} or ${time2}`);
        }
        return t1 > t2 ? t1.toFormat('HH:mm') : t2.toFormat('HH:mm');
    } catch (error) {
        console.error("Error comparing times (getLaterTime):", error);
        return time1 || time2 || "--:--";
    }
}

/**
 * Compares two time strings (HH:MM) in a given timezone and returns the earlier one.
 * @param {string} time1 - The first time string.
 * @param {string} time2 - The second time string.
 * @param {string} timezone - The timezone for comparison.
 * @returns {string} The earlier time string in HH:mm format, or a fallback on error.
 */
export function getEarlierTime(time1, time2, timezone) {
    try {
        const t1 = DateTime.fromFormat(time1, 'HH:mm', {zone: timezone});
        const t2 = DateTime.fromFormat(time2, 'HH:mm', {zone: timezone});
        if (!t1.isValid || !t2.isValid) {
            throw new Error(`Invalid time format for 'getEarlierTime' comparison: ${time1} or ${time2}`);
        }
        return t1 < t2 ? t1.toFormat('HH:mm') : t2.toFormat('HH:mm');
    } catch (error) {
        console.error("Error comparing times (getEarlierTime):", error);
        return time1 || time2 || "--:--";
    }
}

/**
 * Calculates the duration between two Luxon DateTime objects (already in the correct local timezone and date).
 * @param {DateTime} startDateTime - Luxon DateTime object for the start.
 * @param {DateTime} endDateTime - Luxon DateTime object for the end.
 * @param {function} tFunction - The translation function.
 * @returns {object} An object { text: string, hours: number, minutes: number, totalMinutes: number }.
 */
export function calculateDurationLocalWithDates(startDateTime, endDateTime, tFunction) {
    try {
        if (!startDateTime.isValid || !endDateTime.isValid) {
            return {text: "--", hours: 0, minutes: 0, totalMinutes: 0};
        }
        // Assuming startDateTime and endDateTime are already Luxon objects in the correct zone
        if (endDateTime < startDateTime) {
            return {
                text: tFunction('errors.endDateBeforeStart') || "End before start",
                hours: 0,
                minutes: 0,
                totalMinutes: 0
            };
        }
        const diff = endDateTime.diff(startDateTime, ['hours', 'minutes']);
        const totalMinutes = Math.round(diff.as('minutes'));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        let durationText = hours > 0
            ? `${hours}:${String(minutes).padStart(2, '0')}${tFunction("durationHoursShort")}`
            : `${minutes} ${tFunction("durationMinutesShort")}`;
        return {text: durationText, hours: hours, minutes: minutes, totalMinutes: totalMinutes};
    } catch (error) {
        console.error("Error calculating duration with local dates:", error);
        return {text: "--", hours: 0, minutes: 0, totalMinutes: 0};
    }
}

/**
 * Formats a duration in minutes into a human-readable string (e.g., "45 min", "1:30 h").
 * @param {string|number} minutesInput - The duration in minutes.
 * @param {function} tFunction - The translation function.
 * @returns {string} Human-readable duration string, or '--' on error.
 */
export function getTimeFormatFromMinutes(minutesInput, tFunction) {
    const minutes = parseInt(minutesInput, 10);
    if (isNaN(minutes) || minutes < 0) {
        return '--';
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
        return `${hours}:${String(mins).padStart(2, '0')}${tFunction("durationHoursShort")}`;
    }
    return `${mins} ${tFunction("durationMinutesShort")}`;
}

/**
 * Formats a JavaScript Date object into "YYYY-MM-DD" string using UTC values.
 * @param {Date} date - The JavaScript Date object.
 * @param {string} timezone - The timezone of the date object
 * @returns {string} The formatted date string, or an empty string if date is invalid.
 */
export function formatDatetime(date, timezone = "utc") {
    if (!date || isNaN(date.getTime())) return '';
    // Use Luxon for consistency, ensuring UTC interpretation for formatting
    try {
        return DateTime.fromJSDate(date).setZone(timezone).toFormat('yyyy-MM-dd');
    } catch (error) {
        console.error("Error formatting datetime to yyyy-MM-dd:", error);
        // Fallback to manual formatting if Luxon fails
        let year = date.getUTCFullYear();
        let month = date.getUTCMonth() + 1;
        let day = date.getUTCDate();
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
}

/**
 * Parses a duration string (e.g., "45min", "1:30h") into total minutes.
 * @param {string} durationString - The duration string.
 * @param {function} tFunction - The translation function for "durationHoursShort" and "durationMinutesShort".
 * @returns {number} Total minutes, or 0 on error.
 */
export function parseDurationToMinutes(durationString, tFunction) {
    if (!durationString || typeof durationString !== 'string') return 0;
    try {
        const hoursShort = tFunction("durationHoursShort");
        const minutesShort = tFunction("durationMinutesShort");

        if (durationString.includes(hoursShort)) {
            const parts = durationString.replace(hoursShort, "").split(':');
            const hours = parseInt(parts[0], 10);
            const minutes = parseInt(parts[1], 10);
            if (isNaN(hours) || isNaN(minutes)) return 0;
            return (hours * 60) + minutes;
        } else if (durationString.includes(minutesShort)) {
            const minutes = parseInt(durationString.replace(minutesShort, "").trim(), 10);
            return isNaN(minutes) ? 0 : minutes;
        }
    } catch (e) {
        console.error("Error parsing duration string to minutes:", durationString, e);
    }
    return 0;
}

/**
 * Formats an ISO 8601 string for display as "dd. MMM" in the local timezone.
 * @param {string} isoString - The ISO 8601 datetime string (assumed UTC).
 * @param {string} timezone - The target display timezone.
 * @param {string} language - The language for locale formatting (e.g., 'en', 'de').
 * @returns {string} Formatted date string, or "" on error.
 */
export function formatLegDateForDisplay(isoString, timezone, language) {
    try {
        const localDt = DateTime.fromISO(isoString, {zone: 'utc'}).setZone(timezone);
        if (!localDt.isValid) {
            console.warn(`Invalid ISO string for leg date display: ${isoString}`);
            return "";
        }
        const localeMap = {EN: 'en-GB', DE: 'de-DE'}; // Map language to full locale
        const locale = localeMap[language.toUpperCase()] || `${language.toLowerCase()}-${language.toUpperCase()}`; // Fallback e.g. en-EN
        return localDt.setLocale(locale).toFormat('dd. MMM');
    } catch (error) {
        console.error("Error formatting leg date for display:", error);
        return "";
    }
}

/**
 * Formats a JavaScript Date object for full display (e.g., "17. May 2025") in UTC.
 * @param {Date} date - The JavaScript Date object.
 * @param {string} language - The language for locale formatting.
 * @returns {string} Formatted full date string, or "" on error.
 */
export function formatFullDateForDisplay(date, language) {
    if (!date || isNaN(date.getTime())) return '';
    try {
        const localeMap = {EN: 'en-GB', DE: 'de-DE'};
        const locale = localeMap[language.toUpperCase()] || `${language.toLowerCase()}-${language.toUpperCase()}`;

        // Format date for display using locale settings, ensuring UTC interpretation
        return DateTime.fromJSDate(date).setZone('utc').setLocale(locale).toFormat('dd. MMM yyyy');
    } catch (error) {
        console.error("Error formatting full date for display:", error);
        return "";
    }
}


/**
 * Converts a JavaScript Date object to a UTC midnight Date object.
 *
 * This function takes a provided JavaScript Date object and converts it to a Date object set to midnight in UTC.
 * If the input is invalid, it falls back to the provided luxon DateTime object's day start in UTC.
 *
 * @param {Date} jsDateInput - A valid JavaScript Date object to be converted. If invalid, the fallback is used.
 * @param {Object} fallbackLuxonDtForDay - A luxon DateTime object used as a fallback when the input date is invalid.
 * @return {Date} A JavaScript Date object representing midnight in UTC.
 */
export function convertToUTCMidnightJSDate(jsDateInput, fallbackLuxonDtForDay) {
    if (jsDateInput && !isNaN(new Date(jsDateInput.valueOf()))) {
        const dtInWidgetZone = DateTime.fromJSDate(jsDateInput, {zone: this.config.timezone});
        const isoDate = dtInWidgetZone.toISODate();
        return DateTime.fromISO(isoDate, {zone: 'utc'}).toJSDate();
    }
    return fallbackLuxonDtForDay.startOf('day').toUTC().toJSDate();
}