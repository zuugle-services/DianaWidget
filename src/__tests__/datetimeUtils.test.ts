/**
 * Unit tests for datetimeUtils.ts
 */
import { DateTime } from 'luxon';
import { 
    convertLocalTimeToUTC,
    convertLocalTimeToUTCDatetime,
    convertConfigTimeToLocalTime,
    convertUTCToLocalTime,
    calculateTimeDifference,
    addMinutesToDate,
    getLaterTime,
    getEarlierTime,
    getTimeFormatFromMinutes,
    formatDatetime,
    formatFullDateForDisplay,
    calculateDurationLocalWithDates
} from '../datetimeUtils';

describe('convertLocalTimeToUTC', () => {
    it('should convert Vienna local time to UTC', () => {
        // Vienna is UTC+1 in winter, UTC+2 in summer
        const date = new Date(Date.UTC(2024, 0, 15)); // January 15, 2024 (winter)
        const result = convertLocalTimeToUTC('14:30', date, 'Europe/Vienna');
        // 14:30 in Vienna (UTC+1) should be 13:30 UTC
        expect(result).toBe('13:30:00');
    });

    it('should handle invalid time gracefully', () => {
        const date = new Date(Date.UTC(2024, 0, 15));
        const result = convertLocalTimeToUTC('invalid', date, 'Europe/Vienna');
        expect(result).toBe('00:00:00');
    });

    it('should handle time with seconds', () => {
        const date = new Date(Date.UTC(2024, 0, 15));
        const result = convertLocalTimeToUTC('14:30:45', date, 'Europe/Vienna');
        expect(result).toBe('13:30:45');
    });
});

describe('convertLocalTimeToUTCDatetime', () => {
    it('should convert local time to full UTC datetime string', () => {
        const date = new Date(Date.UTC(2024, 0, 15));
        const result = convertLocalTimeToUTCDatetime('14:30', date, 'Europe/Vienna');
        expect(result).toContain('2024-01-15T13:30:00');
    });

    it('should handle invalid input gracefully', () => {
        const date = new Date(Date.UTC(2024, 0, 15));
        const result = convertLocalTimeToUTCDatetime('invalid', date, 'Europe/Vienna');
        expect(result).toBe('0000-00-00T00:00:00Z');
    });
});

describe('convertConfigTimeToLocalTime', () => {
    it('should convert config time to local display format', () => {
        const date = new Date(Date.UTC(2024, 0, 15));
        const result = convertConfigTimeToLocalTime('14:30', date, 'Europe/Vienna');
        expect(result).toBe('14:30');
    });

    it('should handle invalid time gracefully', () => {
        const date = new Date(Date.UTC(2024, 0, 15));
        const result = convertConfigTimeToLocalTime('invalid', date, 'Europe/Vienna');
        expect(result).toBe('--:--');
    });
});

describe('convertUTCToLocalTime', () => {
    it('should convert UTC timestamp to local time', () => {
        const result = convertUTCToLocalTime('2024-01-15T13:30:00Z', 'Europe/Vienna');
        expect(result).toBe('14:30');
    });

    it('should handle invalid timestamp gracefully', () => {
        const result = convertUTCToLocalTime('invalid', 'Europe/Vienna');
        expect(result).toBe('--:--');
    });
});

describe('calculateTimeDifference', () => {
    const mockTFunction = (key: string): string => {
        if (key === 'durationMinutesShort') return 'min';
        if (key === 'durationHoursShort') return 'h';
        return key;
    };

    it('should calculate difference in minutes', () => {
        const result = calculateTimeDifference(
            '2024-01-15T10:00:00Z',
            '2024-01-15T10:45:00Z',
            mockTFunction
        );
        expect(result).toBe('45 min');
    });

    it('should calculate difference in hours and minutes', () => {
        const result = calculateTimeDifference(
            '2024-01-15T10:00:00Z',
            '2024-01-15T11:30:00Z',
            mockTFunction
        );
        expect(result).toBe('1:30h');
    });

    it('should handle invalid timestamps gracefully', () => {
        const result = calculateTimeDifference('invalid', 'also-invalid', mockTFunction);
        expect(result).toBe('--');
    });
});

describe('addMinutesToDate', () => {
    it('should add minutes to a date', () => {
        const result = addMinutesToDate('2024-01-15T10:00:00Z', 30);
        expect(result).toContain('2024-01-15T10:30:00');
    });

    it('should handle negative minutes', () => {
        const result = addMinutesToDate('2024-01-15T10:00:00Z', -30);
        expect(result).toContain('2024-01-15T09:30:00');
    });

    it('should throw for invalid date', () => {
        expect(() => addMinutesToDate('invalid', 30)).toThrow();
    });
});

describe('getLaterTime', () => {
    it('should return the later time', () => {
        const result = getLaterTime('10:00', '14:30', 'UTC');
        expect(result).toBe('14:30');
    });

    it('should return the first time if it is later', () => {
        const result = getLaterTime('18:00', '09:00', 'UTC');
        expect(result).toBe('18:00');
    });

    it('should handle equal times', () => {
        const result = getLaterTime('10:00', '10:00', 'UTC');
        expect(result).toBe('10:00');
    });
});

describe('getEarlierTime', () => {
    it('should return the earlier time', () => {
        const result = getEarlierTime('10:00', '14:30', 'UTC');
        expect(result).toBe('10:00');
    });

    it('should return the second time if it is earlier', () => {
        const result = getEarlierTime('18:00', '09:00', 'UTC');
        expect(result).toBe('09:00');
    });
});

describe('getTimeFormatFromMinutes', () => {
    const mockTFunction = (key: string): string => {
        if (key === 'durationMinutesShort') return 'min';
        if (key === 'durationHoursShort') return 'h';
        return key;
    };

    it('should format minutes only', () => {
        const result = getTimeFormatFromMinutes(45, mockTFunction);
        expect(result).toBe('45 min');
    });

    it('should format hours and minutes', () => {
        const result = getTimeFormatFromMinutes(90, mockTFunction);
        expect(result).toBe('1:30h');
    });

    it('should handle string input', () => {
        const result = getTimeFormatFromMinutes('120', mockTFunction);
        expect(result).toBe('2:00h');
    });

    it('should handle invalid input', () => {
        const result = getTimeFormatFromMinutes('invalid', mockTFunction);
        expect(result).toBe('--');
    });

    it('should handle negative input', () => {
        const result = getTimeFormatFromMinutes(-10, mockTFunction);
        expect(result).toBe('--');
    });
});

describe('formatDatetime', () => {
    it('should format date to YYYY-MM-DD', () => {
        const date = new Date(Date.UTC(2024, 5, 15)); // June 15, 2024
        const result = formatDatetime(date, 'utc');
        expect(result).toBe('2024-06-15');
    });

    it('should return empty string for invalid date', () => {
        expect(formatDatetime(new Date('invalid'))).toBe('');
        expect(formatDatetime(null as unknown as Date)).toBe('');
    });
});

describe('formatFullDateForDisplay', () => {
    it('should format date for display with locale', () => {
        const date = new Date(Date.UTC(2024, 5, 15));
        const result = formatFullDateForDisplay(date, 'EN');
        expect(result).toMatch(/15.*Jun.*2024/);
    });

    it('should return empty string for invalid date', () => {
        expect(formatFullDateForDisplay(new Date('invalid'), 'EN')).toBe('');
    });
});

describe('calculateDurationLocalWithDates', () => {
    const mockTFunction = (key: string): string => {
        if (key === 'durationMinutesShort') return 'min';
        if (key === 'durationHoursShort') return 'h';
        if (key === 'errors.endDateBeforeStart') return 'End before start';
        return key;
    };

    it('should calculate duration between two DateTime objects', () => {
        const start = DateTime.fromISO('2024-01-15T10:00:00', { zone: 'utc' });
        const end = DateTime.fromISO('2024-01-15T11:30:00', { zone: 'utc' });
        const result = calculateDurationLocalWithDates(start, end, mockTFunction);
        
        expect(result.hours).toBe(1);
        expect(result.minutes).toBe(30);
        expect(result.totalMinutes).toBe(90);
        expect(result.text).toBe('1:30h');
    });

    it('should handle minutes only duration', () => {
        const start = DateTime.fromISO('2024-01-15T10:00:00', { zone: 'utc' });
        const end = DateTime.fromISO('2024-01-15T10:45:00', { zone: 'utc' });
        const result = calculateDurationLocalWithDates(start, end, mockTFunction);
        
        expect(result.hours).toBe(0);
        expect(result.minutes).toBe(45);
        expect(result.text).toBe('45 min');
    });

    it('should handle end before start', () => {
        const start = DateTime.fromISO('2024-01-15T12:00:00', { zone: 'utc' });
        const end = DateTime.fromISO('2024-01-15T10:00:00', { zone: 'utc' });
        const result = calculateDurationLocalWithDates(start, end, mockTFunction);
        
        expect(result.text).toBe('End before start');
        expect(result.totalMinutes).toBe(0);
    });

    it('should handle invalid DateTime objects', () => {
        const invalidDt = DateTime.invalid('test');
        const validDt = DateTime.fromISO('2024-01-15T10:00:00', { zone: 'utc' });
        
        const result = calculateDurationLocalWithDates(invalidDt, validDt, mockTFunction);
        expect(result.text).toBe('--');
    });
});
