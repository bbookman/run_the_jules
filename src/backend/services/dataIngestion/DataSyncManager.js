const cron = require('node-cron');
const logger = require('../../utils/logger');
const config = require('../storage/ConfigManager');
const DataProcessor = require('../processing/DataProcessor'); // For updating daily aggregations

// Import all connectors
const LimitlessConnector = require('./LimitlessConnector');
const BeeConnector = require('./BeeConnector');
const WeatherConnector = require('./WeatherConnector');
// MoodConnector is not typically synced automatically, but can be included if a batch process is ever needed.
// const MoodConnector = require('./MoodConnector');

class DataSyncManager {
  constructor() {
    this.connectors = {};
    this.cronJobs = {};
    this._initializeConnectors();
    this._scheduleSyncs();
    logger.info('DataSyncManager initialized and sync jobs scheduled.');
  }

  _initializeConnectors() {
    // Instantiate all available connectors
    const limitless = new LimitlessConnector();
    if (limitless.isEnabled()) this.connectors.limitless = limitless;

    const bee = new BeeConnector();
    if (bee.isEnabled()) this.connectors.bee = bee;

    const weather = new WeatherConnector();
    if (weather.isEnabled()) this.connectors.weather = weather;

    // Mood connector is usually not part of automated sync, but can be added if needed
    // const mood = new MoodConnector();
    // if (mood.isEnabled()) this.connectors.mood = mood;

    logger.info(`Initialized connectors: ${Object.keys(this.connectors).join(', ')}`);
  }

  _scheduleSyncs() {
    Object.entries(this.connectors).forEach(([sourceName, connectorInstance]) => {
      const sourceConfig = config.get(`dataSources.${sourceName}`);
      if (sourceConfig && sourceConfig.enabled && sourceConfig.syncInterval) {
        if (cron.validate(sourceConfig.syncInterval)) {
          logger.info(`Scheduling sync for ${sourceName} with interval: ${sourceConfig.syncInterval}`);
          this.cronJobs[sourceName] = cron.schedule(sourceConfig.syncInterval, async () => {
            logger.info(`Cron job triggered for ${sourceName} sync.`);
            try {
              await this.syncSource(sourceName, { triggeredBy: 'cron' });
            } catch (error) {
              logger.error(`Error during scheduled sync for ${sourceName}: ${error.message}`, { stack: error.stack });
            }
          });
        } else {
          logger.warn(`Invalid cron interval '${sourceConfig.syncInterval}' for ${sourceName}. Sync will not be scheduled.`);
        }
      } else {
        logger.info(`Automatic sync not scheduled for ${sourceName} (disabled or no interval).`);
      }
    });
  }

  // Trigger sync for a specific data source
  async syncSource(sourceName, options = {}) {
    const connector = this.connectors[sourceName];
    if (!connector) {
      logger.warn(`DataSyncManager: Connector for source '${sourceName}' not found or not enabled.`);
      return { success: false, message: `Connector ${sourceName} not found.` };
    }

    if (!connector.isEnabled()) {
      logger.info(`DataSyncManager: Sync skipped for disabled source: ${sourceName}`);
      return { success: false, message: `${sourceName} is disabled.` };
    }

    logger.info(`DataSyncManager: Starting manual sync for ${sourceName}...`, options);
    try {
      // The `sync` method in BaseConnector handles fetching and processing
      const result = await connector.sync(options);
      logger.info(`DataSyncManager: Sync finished for ${sourceName}. New: ${result.newEntries || 0}, Updated: ${result.updatedEntries || 0}, Errors: ${result.errors || 0}`);

      // Update daily aggregations after successful sync
      // This part needs careful thought: what date and item count to pass?
      // If sync fetches data for multiple days, this needs to be more granular.
      // For MVP, let's assume sync primarily brings in data for "today" or recent past.
      // A more robust approach would have connectors return which dates were affected.
      if (result.success && (result.newEntries > 0 || result.updatedEntries > 0)) {
        // This is a simplification. A connector should ideally report which dates had new/updated data.
        // For now, we might just update for "today" if relevant, or this needs more info from connectors.
        // Example: if result contained an array of { date, count }
        // For now, this is a placeholder for where aggregation updates would occur.
        // The connectors themselves might be better placed to call DataProcessor.updateDailyAggregation
        // for the specific dates they processed.

        // Let's assume connectors return the count of items for the primary entity type they manage.
        // And for simplicity, let's try to update aggregation for today.
        // This is NOT robust for historical syncs.
        if (sourceName !== 'weather' && sourceName !== 'mood') { // Weather/Mood have specific date handling
            const today = new Date().toISOString().split('T')[0];
            // This count is the total from the sync, not necessarily for 'today'.
            // A better approach: connectors call DataProcessor.updateDailyAggregation within their processData.
            // await DataProcessor.updateDailyAggregation(today, sourceName, result.newEntries + result.updatedEntries);
        }
      }
      return result;
    } catch (error) {
      logger.error(`DataSyncManager: Error during sync for ${sourceName}: ${error.message}`, { stack: error.stack });
      return { success: false, message: error.message, error_details: error };
    }
  }

  // Trigger sync for all enabled data sources
  async syncAllSources(options = {}) {
    logger.info('DataSyncManager: Starting sync for all enabled sources...', options);
    const results = {};
    for (const sourceName of Object.keys(this.connectors)) {
      if (this.connectors[sourceName].isEnabled()) {
        results[sourceName] = await this.syncSource(sourceName, options);
      } else {
        logger.info(`DataSyncManager: Skipping disabled source ${sourceName} in syncAllSources.`);
        results[sourceName] = { success: true, message: 'Disabled, skipped.'};
      }
    }
    logger.info('DataSyncManager: Sync all sources finished.');
    return results;
  }

  // Stop all scheduled cron jobs (e.g., on application shutdown)
  stopAllScheduledSyncs() {
    logger.info('DataSyncManager: Stopping all scheduled sync jobs...');
    Object.values(this.cronJobs).forEach(job => job.stop());
    logger.info('DataSyncManager: All scheduled sync jobs stopped.');
  }
}

// Singleton instance
const dataSyncManagerInstance = new DataSyncManager();

// Graceful shutdown
process.on('SIGINT', () => dataSyncManagerInstance.stopAllScheduledSyncs());
process.on('SIGTERM', () => dataSyncManagerInstance.stopAllScheduledSyncs());

module.exports = dataSyncManagerInstance;
