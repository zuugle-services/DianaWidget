/**
 * Tests for utility functions
 */
import { isValidTimeFormat, formatDate } from '../src/utils.js';

describe('isValidTimeFormat', () => {
  test('should return true for valid HH:MM format', () => {
    expect(isValidTimeFormat('09:30')).toBe(true);
    expect(isValidTimeFormat('23:59')).toBe(true);
    expect(isValidTimeFormat('00:00')).toBe(true);
  });

  test('should return true for valid HH:MM:SS format', () => {
    expect(isValidTimeFormat('09:30:45')).toBe(true);
    expect(isValidTimeFormat('23:59:59')).toBe(true);
    expect(isValidTimeFormat('00:00:00')).toBe(true);
  });

  test('should return false for invalid time formats', () => {
    expect(isValidTimeFormat('24:00')).toBe(false);
    expect(isValidTimeFormat('12:60')).toBe(false);
    expect(isValidTimeFormat('12:30:60')).toBe(false);
    expect(isValidTimeFormat('12-30')).toBe(false);
    expect(isValidTimeFormat('12.30')).toBe(false);
    expect(isValidTimeFormat('')).toBe(false);
    expect(isValidTimeFormat(null)).toBe(false);
    expect(isValidTimeFormat(undefined)).toBe(false);
    expect(isValidTimeFormat(123)).toBe(false);
  });
});

describe('formatDate', () => {
  test('should format date correctly', () => {
    const date = new Date(2023, 0, 15); // January 15, 2023
    expect(formatDate(date)).toBe('2023-01-15');
  });

  test('should pad month and day with leading zeros', () => {
    const date = new Date(2023, 0, 1); // January 1, 2023
    expect(formatDate(date)).toBe('2023-01-01');
  });

  test('should return empty string for invalid dates', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('not a date')).toBe('');
    expect(formatDate(new Date('invalid date'))).toBe('');
  });
});
