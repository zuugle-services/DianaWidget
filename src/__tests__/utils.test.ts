/**
 * Unit tests for utils.ts
 */
import { getMonthName, getShortDayName, getApiErrorTranslationKey, formatDateForDisplay } from '../utils';

describe('getMonthName', () => {
    const mockTFunction = (key: string): string | string[] => {
        if (key === 'months') {
            return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        }
        return key;
    };

    it('should return correct month name for valid index', () => {
        expect(getMonthName(0, mockTFunction)).toBe('Jan');
        expect(getMonthName(5, mockTFunction)).toBe('Jun');
        expect(getMonthName(11, mockTFunction)).toBe('Dec');
    });

    it('should return fallback for invalid index', () => {
        expect(getMonthName(-1, mockTFunction)).toBe('months.-1');
        expect(getMonthName(12, mockTFunction)).toBe('months.12');
    });

    it('should return fallback when months is not an array', () => {
        const badTFunction = (): string => 'not-an-array';
        expect(getMonthName(0, badTFunction)).toBe('months.0');
    });
});

describe('getShortDayName', () => {
    const mockTFunction = (key: string): string | string[] => {
        if (key === 'shortDays') {
            return ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
        }
        return key;
    };

    it('should return correct day name for valid index', () => {
        expect(getShortDayName(0, mockTFunction)).toBe('M');
        expect(getShortDayName(4, mockTFunction)).toBe('F');
        expect(getShortDayName(6, mockTFunction)).toBe('S');
    });

    it('should return fallback for invalid index', () => {
        expect(getShortDayName(-1, mockTFunction)).toBe('shortDays.-1');
        expect(getShortDayName(7, mockTFunction)).toBe('shortDays.7');
    });
});

describe('getApiErrorTranslationKey', () => {
    it('should return correct translation key for known numeric error codes', () => {
        expect(getApiErrorTranslationKey(1001)).toBe('errors.api.queryParamMissing');
        expect(getApiErrorTranslationKey(1002)).toBe('errors.api.invalidLimitParam');
        expect(getApiErrorTranslationKey(1003)).toBe('errors.api.internalError');
        expect(getApiErrorTranslationKey(6001)).toBe('errors.api.monthlyQuotaExceeded');
    });

    it('should return correct translation key for known string error codes', () => {
        expect(getApiErrorTranslationKey('2017-1')).toBe('errors.api.noToConnectionsFound');
        expect(getApiErrorTranslationKey('2017-2')).toBe('errors.api.noFromConnectionsFound');
        expect(getApiErrorTranslationKey('APP_INVALID_DATA')).toBe('errors.api.invalidDataReceived');
    });

    it('should return unknown for unrecognized error codes', () => {
        expect(getApiErrorTranslationKey(9999)).toBe('errors.api.unknown');
        expect(getApiErrorTranslationKey('UNKNOWN_ERROR')).toBe('errors.api.unknown');
    });
});

describe('formatDateForDisplay', () => {
    it('should return empty string for invalid date', () => {
        expect(formatDateForDisplay(new Date('invalid'), 'en-GB')).toBe('');
        expect(formatDateForDisplay(null as unknown as Date, 'en-GB')).toBe('');
    });

    it('should format valid date correctly', () => {
        const date = new Date(Date.UTC(2024, 5, 15)); // June 15, 2024 UTC
        const result = formatDateForDisplay(date, 'en-GB', 'UTC');
        expect(result).toMatch(/15.*Jun.*2024/);
    });

    it('should handle different locales', () => {
        const date = new Date(Date.UTC(2024, 0, 1)); // January 1, 2024 UTC
        const resultDE = formatDateForDisplay(date, 'de-DE', 'UTC');
        expect(resultDE).toMatch(/01.*Jan.*2024/);
    });
});
