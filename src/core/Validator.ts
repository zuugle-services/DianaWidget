/**
 * Configuration validation logic for DianaWidget
 */

import { DateTime } from 'luxon';
import translations from '../translations';
import { convertLocalTimeToUTC } from '../datetimeUtils';
import {
    TIME_CONFIG_FIELDS,
    isValidLocationType,
    isCoordinateLocationType
} from '../constants';
import type { WidgetConfig, Language } from '../types';

/**
 * Result of configuration validation
 */
export interface ValidationResult {
    errors: string[];
    config: WidgetConfig;
}

/**
 * Validates and normalizes the widget configuration.
 * 
 * This function performs the following:
 * - Normalizes language to uppercase
 * - Validates required fields
 * - Validates location types
 * - Validates time formats and logical consistency
 * - Validates date formats and ranges
 * - Normalizes API base URL (removes trailing slash)
 * 
 * @param config - The widget configuration to validate
 * @returns ValidationResult with errors array and normalized config
 */
export function validateConfig(config: WidgetConfig): ValidationResult {
    const errors: string[] = [];

    // Normalize language to uppercase and trim to allow both 'en' and 'EN'
    if (config.language && typeof config.language === 'string') {
        config.language = config.language.trim().toUpperCase() as Language;
    }
    
    if (!translations[config.language]) {
        console.warn(`Unsupported language '${config.language}', falling back to EN`);
        config.language = 'EN';
    }

    // Validate required fields
    const missingFields = config.requiredFields.filter(field => !config[field]);
    if (config.multiday && !config.activityDurationMinutes) {
        const index = missingFields.indexOf('activityDurationMinutes');
        if (index > -1) {
            missingFields.splice(index, 1);
        }
    }
    if (missingFields.length > 0) {
        errors.push(`Missing required configuration: ${missingFields.join(', ')}`);
    }

    // Normalize API base URL
    if (config.apiBaseUrl[config.apiBaseUrl.length - 1] === "/") {
        config.apiBaseUrl = config.apiBaseUrl.slice(0, -1);
    }

    // Validate timezone
    if (!DateTime.local().setZone(config.timezone).isValid) {
        errors.push(`Invalid timezone '${config.timezone}'. Error: ${DateTime.local().setZone(config.timezone).invalidReason}`);
        config.timezone = 'Europe/Vienna';
    }

    // Validate location types
    if (config.activityStartLocationType && !isValidLocationType(config.activityStartLocationType)) {
        errors.push(`Invalid activityStartLocationType '${config.activityStartLocationType}'.`);
    }
    if (config.activityEndLocationType && !isValidLocationType(config.activityEndLocationType)) {
        errors.push(`Invalid activityEndLocationType '${config.activityEndLocationType}'.`);
    }

    // Validate activity duration
    if (config.activityDurationMinutes !== undefined && config.activityDurationMinutes !== null) {
        const durationValue = typeof config.activityDurationMinutes === 'number' 
            ? config.activityDurationMinutes 
            : parseInt(config.activityDurationMinutes, 10);
        if (isNaN(durationValue) || durationValue <= 0) {
            errors.push(`Invalid activityDurationMinutes '${config.activityDurationMinutes}'. Must be a positive integer.`);
        }
    }

    // Validate time formats
    const timeRegex = /^(2[0-3]|[01]?[0-9]):([0-5]?[0-9])(:([0-5]?[0-9]))?$/;
    TIME_CONFIG_FIELDS.forEach(field => {
        if (config[field] && !timeRegex.test(config[field])) {
            errors.push(`Invalid time format for '${field}': '${config[field]}'. Expected HH:MM or HH:MM:SS`);
        }
    });

    // Check for logical time errors only if formats are valid
    if (!errors.some(e => e.includes('Invalid time format'))) {
        validateTimeLogic(config, errors);
    }

    // Validate override user start location
    validateUserStartLocation(config, errors);

    // Validate date fields
    validateDateFields(config, errors);

    return { errors, config };
}

/**
 * Validates logical consistency of time configurations
 */
function validateTimeLogic(config: WidgetConfig, errors: string[]): void {
    // Skip validation if any of the required time fields are undefined
    if (!config.activityEarliestStartTime || !config.activityLatestStartTime ||
        !config.activityEarliestEndTime || !config.activityLatestEndTime) {
        return;
    }

    try {
        const earliestStart = convertLocalTimeToUTC(config.activityEarliestStartTime, new Date("2000-10-10"), config.timezone);
        const latestStart = convertLocalTimeToUTC(config.activityLatestStartTime, new Date("2000-10-10"), config.timezone);
        if (latestStart < earliestStart) {
            errors.push(`activityLatestStartTime (${config.activityLatestStartTime}) cannot be before activityEarliestStartTime (${config.activityEarliestStartTime}).`);
        }

        const earliestEnd = convertLocalTimeToUTC(config.activityEarliestEndTime, new Date("2000-10-10"), config.timezone);
        const latestEnd = convertLocalTimeToUTC(config.activityLatestEndTime, new Date("2000-10-10"), config.timezone);
        if (latestEnd < earliestEnd) {
            errors.push(`activityLatestEndTime (${config.activityLatestEndTime}) cannot be before activityEarliestEndTime (${config.activityEarliestEndTime}).`);
        }
    } catch (e) {
        errors.push("There was an issue parsing activity time configurations for logical validation.");
    }
}

/**
 * Validates user start location override settings
 */
function validateUserStartLocation(config: WidgetConfig, errors: string[]): void {
    if (config.overrideUserStartLocation && (typeof config.overrideUserStartLocation !== 'string')) {
        errors.push(`Invalid overrideUserStartLocation '${config.overrideUserStartLocation}'. Must be a string or null.`);
    }
    if (config.overrideUserStartLocation && !isValidLocationType(config.overrideUserStartLocationType)) {
        errors.push(`Invalid or missing overrideUserStartLocationType '${config.overrideUserStartLocationType}'.`);
    } else if (config.overrideUserStartLocation && isCoordinateLocationType(config.overrideUserStartLocationType)) {
        const coordsRegex = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
        if (!coordsRegex.test(config.overrideUserStartLocation)) {
            errors.push(`Invalid coordinate format for overrideUserStartLocation: '${config.overrideUserStartLocation}'. Expected "lat,lon".`);
        }
    }

    if (config.disableUserStartLocationField && !config.overrideUserStartLocation) {
        console.warn("Warning: 'disableUserStartLocationField' is set to true but 'overrideUserStartLocation' is not provided. The parameter will be ignored.");
        config.disableUserStartLocationField = false;
    }
}

/**
 * Validates date-related configuration fields
 */
function validateDateFields(config: WidgetConfig, errors: string[]): void {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (config.displayStartDate && (!dateRegex.test(config.displayStartDate) || !DateTime.fromISO(config.displayStartDate).isValid)) {
        errors.push(`Invalid displayStartDate: ${config.displayStartDate}.`);
    }
    if (config.displayEndDate && (!dateRegex.test(config.displayEndDate) || !DateTime.fromISO(config.displayEndDate).isValid)) {
        errors.push(`Invalid displayEndDate: ${config.displayEndDate}.`);
    }
    if (config.displayStartDate && config.displayEndDate && DateTime.fromISO(config.displayStartDate) > DateTime.fromISO(config.displayEndDate)) {
        errors.push(`displayStartDate cannot be after displayEndDate.`);
    }
    if (config.overrideActivityStartDate && (!dateRegex.test(config.overrideActivityStartDate) || !DateTime.fromISO(config.overrideActivityStartDate).isValid)) {
        errors.push(`Invalid overrideActivityStartDate: ${config.overrideActivityStartDate}.`);
    }
    if (config.overrideActivityEndDate) {
        if (!dateRegex.test(config.overrideActivityEndDate) || !DateTime.fromISO(config.overrideActivityEndDate).isValid) {
            errors.push(`Invalid overrideActivityEndDate: ${config.overrideActivityEndDate}.`);
        } else if (!config.multiday) {
            console.warn("Warning: 'overrideActivityEndDate' is provided but 'multiday' is false. It will be ignored.");
            config.overrideActivityEndDate = null;
        } else if (config.overrideActivityStartDate && DateTime.fromISO(config.overrideActivityEndDate) < DateTime.fromISO(config.overrideActivityStartDate)) {
            errors.push(`overrideActivityEndDate cannot be before overrideActivityStartDate.`);
        }
    }

    // Validate multiday duration consistency
    if (config.multiday && config.activityDurationDaysFixed && config.overrideActivityStartDate && config.overrideActivityEndDate) {
        const start = DateTime.fromISO(config.overrideActivityStartDate);
        const end = DateTime.fromISO(config.overrideActivityEndDate);
        if (start.isValid && end.isValid) {
            // +1 because a 2-day duration is start_date -> start_date + 1 day. Diff will be 1 day.
            const diffInDays = end.diff(start, 'days').as('days') + 1;
            const fixedDuration = typeof config.activityDurationDaysFixed === 'number'
                ? config.activityDurationDaysFixed
                : parseInt(config.activityDurationDaysFixed, 10);
            if (diffInDays !== fixedDuration) {
                errors.push(`The duration between overrideActivityStartDate (${config.overrideActivityStartDate}) and overrideActivityEndDate (${config.overrideActivityEndDate}) is ${diffInDays} days, which contradicts the fixed duration of ${fixedDuration} days.`);
            }
        }
    }
}
