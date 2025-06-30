const axios = require('axios');
const BaseConnector = require('./BaseConnector');
const logger = require('../../utils/logger');
const db = require('../storage/DatabaseManager');

class WeatherConnector extends BaseConnector {
  constructor() {
    super('weather'); // Matches config.dataSources key
    this.apiProvider = this.sourceConfig.provider || 'openweathermap'; // Default provider

    if (this.apiProvider === 'openweathermap') {
      this.apiClient = axios.create({
        baseURL: this.sourceConfig.baseUrl || 'https://api.openweathermap.org/data/2.5',
        params: {
          appid: this.sourceConfig.apiKey,
          units: this.sourceConfig.units || 'metric', // or 'imperial'
        },
      });
    } else {
      logger.warn(`Weather provider ${this.apiProvider} is not supported by this connector. Disabling.`);
      this.sourceConfig.enabled = false;
    }
    logger.info(`WeatherConnector initialized for provider ${this.apiProvider}. Enabled: ${this.isEnabled()}`);
  }

  async fetchData(options = {}) {
    if (!this.isEnabled() || !this.sourceConfig.apiKey || !this.sourceConfig.location) {
      logger.warn('WeatherConnector is disabled, API key or location is missing. Skipping fetch.');
      return null;
    }

    // Weather data is typically fetched for the current day or a forecast.
    // For historical data, specific API endpoints or different providers might be needed.
    // MVP fetches current weather for a configured location.
    // The dev spec implies fetching for a date, so we might need an API that supports historical data for a specific day.
    // OpenWeatherMap's free tier has limited historical data.
    // For MVP, we'll fetch current weather and store it against today's date.
    // A more advanced version would fetch for specific past dates if the user navigates to them and data is missing.

    const location = options.location || this.sourceConfig.location;
    const dateToFetch = options.date ? new Date(options.date) : new Date(); // Default to today

    // Check if data for this location and date already exists
    // This is important for weather as it doesn't change for a past date
    const existingQuery = `SELECT id FROM weather_entries WHERE location = $1 AND date = $2`;
    const existingResult = await db.query(existingQuery, [location, dateToFetch.toISOString().split('T')[0]]);
    if (existingResult.rowCount > 0 && !options.forceRefresh) {
        logger.info(`Weather data for ${location} on ${dateToFetch.toISOString().split('T')[0]} already exists. Skipping fetch.`);
        return null; // Or return the existing data if needed by caller
    }


    logger.info(`Weather: Fetching weather data for location: ${location} for date: ${dateToFetch.toISOString().split('T')[0]}`);

    try {
      if (this.apiProvider === 'openweathermap') {
        // Using 'weather' endpoint for current weather.
        // For historical, one might use 'onecall/timemachine' (requires paid plan for >5 days ago)
        // or other historical data APIs.
        // For MVP, let's assume we are fetching "current" weather for the location and associate it with "today".
        // If options.date is in the past, this simple fetch might not be accurate.
        // A true historical fetch would require a different endpoint or logic.

        const params = this.buildApiParams({
            q: location, // City name, state code and country code divided by comma, e.g., "London,uk"
            // lat: latitude, lon: longitude // Alternative to q for geo coordinates
        });

        // If fetching for a specific date, and it's today or future (forecast)
        // This is a simplified model. OpenWeatherMap's free "weather" endpoint is current.
        // "forecast/daily" could be used for up to 16 days.
        // For MVP, we'll just get current and stamp it.
        const response = await this.apiClient.get('/weather', { params });

        // Attach the date and location to the response for processData
        response.data.fetchedDate = dateToFetch.toISOString().split('T')[0];
        response.data.fetchedLocation = location;

        logger.info(`Weather: Successfully fetched weather data for ${location}.`);
        return response.data;
      }
    } catch (error) {
      logger.error(`Weather: Error fetching data for ${location}: ${error.message}`, {
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    }
    return null;
  }

  async processData(weatherData, options = {}) {
    if (!weatherData) {
      logger.info('Weather: No weather data to process.');
      return { newEntries: 0, updatedEntries: 0, errors: 0 };
    }

    let newEntries = 0;
    let updatedEntries = 0;
    let errorCount = 0;

    const date = weatherData.fetchedDate; // Date for which data was fetched
    const location = weatherData.fetchedLocation; // Location for which data was fetched

    try {
      let entry = {};
      if (this.apiProvider === 'openweathermap') {
        entry = {
          date: date,
          location: location,
          temperature_high: weatherData.main?.temp_max,
          temperature_low: weatherData.main?.temp_min,
          condition: weatherData.weather?.[0]?.main,
          description: weatherData.weather?.[0]?.description,
          humidity: weatherData.main?.humidity,
          icon_code: weatherData.weather?.[0]?.icon,
          sunrise: weatherData.sys?.sunrise ? new Date(weatherData.sys.sunrise * 1000) : null,
          sunset: weatherData.sys?.sunset ? new Date(weatherData.sys.sunset * 1000) : null,
          data: JSON.stringify(weatherData), // Store the raw response
        };
      } else {
        logger.warn(`Weather: Processing not implemented for provider ${this.apiProvider}`);
        return { newEntries: 0, updatedEntries: 0, errors: 1 };
      }

      if (!entry.date || !entry.location) {
          logger.error('Weather: Processed entry is missing date or location.', entry);
          return { newEntries: 0, updatedEntries: 0, errors: 1 };
      }

      // Upsert logic based on (date, location)
      const upsertQuery = `
        INSERT INTO weather_entries (date, location, temperature_high, temperature_low, condition, description, humidity, icon_code, sunrise, sunset, data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (date, location) DO UPDATE SET
          temperature_high = EXCLUDED.temperature_high,
          temperature_low = EXCLUDED.temperature_low,
          condition = EXCLUDED.condition,
          description = EXCLUDED.description,
          humidity = EXCLUDED.humidity,
          icon_code = EXCLUDED.icon_code,
          sunrise = EXCLUDED.sunrise,
          sunset = EXCLUDED.sunset,
          data = EXCLUDED.data,
          created_at = NOW() -- Or updated_at if schema has it; created_at for weather is effectively 'last_updated_at'
        RETURNING (xmax = 0) AS inserted;
      `;
      // Note: weather_entries schema has created_at, no updated_at. So updated records also refresh created_at.
      // This is okay if created_at is seen as "when this record was last synced/updated".

      const result = await db.query(upsertQuery, [
        entry.date, entry.location, entry.temperature_high, entry.temperature_low,
        entry.condition, entry.description, entry.humidity, entry.icon_code,
        entry.sunrise ? entry.sunrise.toISOString() : null,
        entry.sunset ? entry.sunset.toISOString() : null,
        entry.data
      ]);

      if (result.rows[0].inserted) {
        newEntries++;
      } else {
        updatedEntries++;
      }
      logger.debug(`Weather: Processed weather for ${location} on ${date}. New: ${result.rows[0].inserted}`);

      // Weather data usually doesn't have a 'last modified' time from API for a specific day's weather.
      // So, we don't update LastSyncTime based on weather data content. BaseConnector's default sync time update is fine.

      if (newEntries > 0 || updatedEntries > 0) {
        const DataProcessor = require('../processing/DataProcessor');
        await DataProcessor.updateDailyAggregation(date, this.sourceName, 1); // 1 indicates data is present
      }

    } catch (dbError) {
      logger.error(`Weather: Error processing weather data for ${location} on ${date}: ${dbError.message}`, { stack: dbError.stack });
      errorCount++;
    }

    logger.info(`Weather: Processing complete for ${location} on ${date}. New: ${newEntries}, Updated: ${updatedEntries}, Errors: ${errorCount}`);
    return { newEntries, updatedEntries, errors: errorCount };
  }

  // Override sync to handle date-specific fetching if needed.
  // For MVP, base sync is fine.
  // async sync(options = {}) {
  //   // If options.date is provided, fetch for that specific date.
  //   // Otherwise, fetch for today.
  //   const dateToSync = options.date || new Date().toISOString().split('T')[0];
  //   return super.sync({ ...options, date: dateToSync, location: this.sourceConfig.location });
  // }
}

module.exports = WeatherConnector;
