const logger = require('../../utils/logger');

// Timezone configuration - ideally from user settings or main config
// For MVP, we can assume UTC or a fixed timezone from config.
// const DEFAULT_TIMEZONE = config.get('system.defaultTimezone', 'UTC');

class DateNormalizer {
  constructor() {
    logger.info('DateNormalizer initialized.');
  }

  // Normalize a date to the start of the day in a given timezone (or default)
  // Returns a Date object
  normalizeToStartOfDay(dateInput, timezone = 'UTC') {
    if (!dateInput) return null;

    try {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) {
        logger.warn(`DateNormalizer: Invalid date input for normalization: ${dateInput}`);
        return null;
      }

      // For MVP, and since PostgreSQL's DATE type handles this well by ignoring time parts,
      // simply creating a new Date object and then converting to ISO string's date part
      // is often sufficient for database storage if the column is DATE.
      // For TIMESTAMP WITH TIME ZONE, the exact time matters.
      // This function aims to get a Date object representing midnight in the target timezone.

      // If we need to be precise about "start of day" in a specific timezone:
      // Example: If dateInput is "2023-07-15T02:00:00Z" (UTC)
      // And timezone is "America/New_York" (UTC-4 during EDT)
      // Start of day in New York is "2023-07-15T04:00:00Z" (UTC) which is "2023-07-15T00:00:00-04:00"

      // A simpler approach for MVP if we primarily care about the YYYY-MM-DD part in UTC:
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth(); // 0-indexed
      const day = date.getUTCDate();
      return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

      // For true timezone-aware start of day, a library like 'date-fns-tz' or 'luxon' is recommended.
      // Example with 'luxon' (if installed):
      // const { DateTime } = require('luxon');
      // return DateTime.fromJSDate(date).setZone(timezone).startOf('day').toJSDate();

    } catch (error) {
      logger.error(`DateNormalizer: Error normalizing date ${dateInput}: ${error.message}`);
      return null;
    }
  }

  // Format a Date object to 'YYYY-MM-DD' string (UTC based)
  formatDateToYYYYMMDD(date) {
    if (!date || isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  }

  // Get current date as 'YYYY-MM-DD' string (UTC based)
  getCurrentDateYYYYMMDD() {
    return new Date().toISOString().split('T')[0];
  }

  // Get start of today (UTC)
  getStartOfTodayUTC() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  }

  // Get start of a given date (UTC)
  getStartOfDayUTC(dateInput) {
    if (!dateInput) return null;
    const date = new Date(dateInput);
     if (isNaN(date.getTime())) return null;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  }

  // Get end of a given date (UTC) - useful for range queries
  getEndOfDayUTC(dateInput) {
    if (!dateInput) return null;
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return null;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
  }

  // Parse various string inputs into a Date object.
  // This is a very basic parser. For robust parsing, use a library.
  parseDate(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      // Try to parse YYYY-MM-DD more reliably if Date constructor fails for it
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const parts = dateString.split('-');
        // Month is 0-indexed in JS Date
        const utcDate = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
        if (!isNaN(utcDate.getTime())) return utcDate;
      }
      logger.warn(`DateNormalizer: Could not parse date string: ${dateString}`);
      return null;
    }
    return date;
  }

  // Validates if a string is in YYYY-MM-DD format
  isValidYYYYMMDD(dateString) {
    if (!dateString) return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(dateString);
  }
}

// Singleton instance
const dateNormalizerInstance = new DateNormalizer();
module.exports = dateNormalizerInstance;
