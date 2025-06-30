// Frontend specific Date Normalizer utilities

const DateNormalizerFE = {
  // Format a Date object or date string to 'YYYY-MM-DD'
  formatDateToYYYYMMDD: (dateInput) => {
    if (!dateInput) return null;
    try {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return null;
      // Use UTC methods to avoid timezone issues if the input is already a JS Date object
      // If dateInput is a string like "2023-10-26", new Date() parses it as local time.
      // If it's "2023-10-26T00:00:00Z", it's UTC.
      // For consistency, especially if the backend expects UTC dates for queries:
      const year = date.getFullYear(); // Use getFullYear for local timezone interpretation of strings like YYYY-MM-DD
      const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
      const day = String(date.getDate()).padStart(2, '0'); // Use getDate for local timezone interpretation
      return `${year}-${month}-${day}`;
    } catch (e) {
      console.error("Error formatting date to YYYY-MM-DD:", e);
      return null;
    }
  },

  // Format a date string 'YYYY-MM-DD' or Date object to a more readable format like "October 26, 2023"
  formatDateReadable: (dateInput) => {
    if (!dateInput) return 'Invalid Date';
    try {
      // If dateInput is 'YYYY-MM-DD', new Date() will parse it as local midnight.
      // If it includes time and TZ, it will be parsed accordingly.
      // For display, local time interpretation is usually what's desired.
      const date = new Date(dateInput);
       // Adjust for potential timezone offset if dateInput is just 'YYYY-MM-DD'
       // This ensures that '2023-10-26' is treated as that date in the user's local timezone,
       // not potentially the day before if UTC conversion shifts it.
      const adjustedDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());


      if (isNaN(adjustedDate.getTime())) return 'Invalid Date';
      return adjustedDate.toLocaleDateString(undefined, { // undefined for user's locale
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e) {
      console.error("Error formatting date to readable format:", e);
      return 'Invalid Date';
    }
  },

  // Validates if a string is in YYYY-MM-DD format
  isValidYYYYMMDD: (dateString) => {
    if (!dateString) return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(dateString) && !isNaN(new Date(dateString + 'T00:00:00').getTime());
    // Adding T00:00:00 ensures it's a valid date, not just format e.g. 2023-02-30
  },

  // Get current date as 'YYYY-MM-DD' string
  getCurrentDateYYYYMMDD: () => {
    return new Date().toISOString().split('T')[0]; // This is UTC based YYYY-MM-DD
    // For local YYYY-MM-DD:
    // const today = new Date();
    // return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  },
};

export default DateNormalizerFE;
