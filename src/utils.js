/**
 * Utility functions for DianaWidget
 */

/**
 * Validates if a time string is in the correct format (HH:MM or HH:MM:SS)
 * @param {string} timeString - The time string to validate
 * @returns {boolean} - True if the time string is valid, false otherwise
 */
export function isValidTimeFormat(timeString) {
  if (!timeString || typeof timeString !== 'string') {
    return false;
  }
  
  // Check for HH:MM format
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  // Check for HH:MM:SS format
  const timeWithSecondsRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/;
  
  return timeRegex.test(timeString) || timeWithSecondsRegex.test(timeString);
}

/**
 * Formats a date object to YYYY-MM-DD format
 * @param {Date} date - The date to format
 * @returns {string} - The formatted date string
 */
export function formatDate(date) {
  if (!(date instanceof Date) || isNaN(date)) {
    return '';
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}