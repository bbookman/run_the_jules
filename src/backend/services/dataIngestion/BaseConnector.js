const logger = require('../../utils/logger');
const db = require('../storage/DatabaseManager');
const config = require('../storage/ConfigManager');

class BaseConnector {
  constructor(sourceName) {
    this.sourceName = sourceName;
    this.sourceConfig = config.get(`dataSources.${sourceName}`, {});
    this.apiClient = null; // To be configured by subclasses, e.g., using axios

    if (!this.sourceConfig.enabled) {
      logger.info(`Data source ${this.sourceName} is disabled in configuration.`);
    }
  }

  isEnabled() {
    return this.sourceConfig.enabled === true;
  }

  // Method to be implemented by subclasses to fetch data from the source API
  async fetchData(options = {}) {
    throw new Error(`fetchData() must be implemented by ${this.constructor.name}`);
  }

  // Method to be implemented by subclasses to process and store fetched data
  async processData(data) {
    throw new Error(`processData() must be implemented by ${this.constructor.name}`);
  }

  // Generic method to trigger a sync operation for the source
  async sync(options = {}) {
    if (!this.isEnabled()) {
      logger.info(`Sync skipped for disabled source: ${this.sourceName}`);
      return { success: false, message: `${this.sourceName} is disabled.`, newEntries: 0, updatedEntries: 0, errors: 0 };
    }

    logger.info(`Starting sync for ${this.sourceName}...`, options);
    try {
      const rawData = await this.fetchData(options);
      if (rawData) {
        const processResult = await this.processData(rawData, options); // Pass options if needed for context
        logger.info(`Sync completed for ${this.sourceName}.`, processResult);
        return { success: true, ...processResult };
      } else {
        logger.warn(`No data fetched for ${this.sourceName}. Sync might be partial or no new data available.`);
        return { success: true, message: 'No new data fetched.', newEntries: 0, updatedEntries: 0, errors: 0 };
      }
    } catch (error) {
      logger.error(`Error during sync for ${this.sourceName}: ${error.message}`, {
        stack: error.stack,
        source: this.sourceName,
        options
      });
      return { success: false, message: error.message, newEntries: 0, updatedEntries: 0, errors: 1 };
    }
  }

  // Utility method to get the last sync timestamp (example, could be stored in DB)
  async getLastSyncTime() {
    // This is a placeholder. In a real implementation, you'd fetch this from a
    // dedicated table in the database that stores sync metadata per source.
    // For now, we can simulate or return a fixed old date to fetch everything.
    // Example: SELECT last_successful_sync FROM data_source_sync_status WHERE source_name = $1
    const result = await db.query(
      "SELECT value FROM system_metadata WHERE key = $1",
      [`last_sync_time_${this.sourceName}`]
    );
    if (result.rows.length > 0) {
      return new Date(result.rows[0].value);
    }
    // Fallback to a very old date if no sync time is found, to fetch all data
    return new Date(0); // Beginning of time (Unix epoch)
  }

  // Utility method to update the last sync timestamp
  async updateLastSyncTime(syncTime) {
    // Placeholder: Update in the database.
    // Example: INSERT INTO data_source_sync_status (source_name, last_successful_sync) VALUES ($1, $2)
    // ON CONFLICT (source_name) DO UPDATE SET last_successful_sync = $2, updated_at = NOW()
    logger.info(`Updating last sync time for ${this.sourceName} to ${syncTime.toISOString()}`);
    await db.query(
      `INSERT INTO system_metadata (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [`last_sync_time_${this.sourceName}`, syncTime.toISOString()]
    );
  }

  // Helper for constructing API parameters, removing undefined values
  buildApiParams(paramObj) {
    const params = {};
    for (const key in paramObj) {
      if (paramObj[key] !== undefined) {
        params[key] = paramObj[key];
      }
    }
    return params;
  }
}

// Need a system_metadata table for BaseConnector's getLastSyncTime/updateLastSyncTime
// Add this to init.sql or run separately:
/*
CREATE TABLE IF NOT EXISTS system_metadata (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER set_system_metadata_timestamp
BEFORE UPDATE ON system_metadata
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
*/

module.exports = BaseConnector;
