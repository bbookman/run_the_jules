const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const DataSyncManager = require('../../services/dataIngestion/DataSyncManager');
const MoodConnector = require('../../services/dataIngestion/MoodConnector'); // For manual mood entry

// POST /api/data/sync/{source}
// Triggers a sync for a specific data source.
router.post('/sync/:source', async (req, res, next) => {
  const { source } = req.params;
  const forceFullSync = req.query.forceFullSync === 'true'; // Example: /api/data/sync/limitless?forceFullSync=true

  logger.info(`API: Received request to sync source: ${source}`, { forceFullSync });

  if (!source) {
    return res.status(400).json({ error: 'Source parameter is required.' });
  }

  try {
    // DataSyncManager.syncSource returns a result object.
    const result = await DataSyncManager.syncSource(source, { forceFullSync, triggeredBy: 'api' });

    if (result.success) {
      res.json({ message: `Sync initiated for ${source}.`, details: result });
    } else {
      // If the connector itself is not found or disabled, syncSource handles it.
      // If an error occurred during sync, it's also in result.
      res.status(result.status || 500).json({
        error: `Failed to sync source: ${source}.`,
        details: result.message || result
      });
    }
  } catch (error) {
    logger.error(`API: Error syncing source ${source}: ${error.message}`, { stack: error.stack });
    next(error); // Pass to global error handler
  }
});

// POST /api/data/sync-all
// Triggers a sync for all enabled data sources.
router.post('/sync-all', async (req, res, next) => {
  const forceFullSync = req.query.forceFullSync === 'true';
  logger.info('API: Received request to sync all sources.', { forceFullSync });
  try {
    const results = await DataSyncManager.syncAllSources({ forceFullSync, triggeredBy: 'api' });
    res.json({ message: 'Sync initiated for all enabled sources.', details: results });
  } catch (error) {
    logger.error(`API: Error syncing all sources: ${error.message}`, { stack: error.stack });
    next(error);
  }
});


// POST /api/data/mood
// Endpoint for manually adding a mood entry.
router.post('/mood', async (req, res, next) => {
  const moodData = req.body;
  // user_id could be extracted from auth middleware in future, for MVP it might be null or part of body
  // const userId = req.user ? req.user.id : null;
  // moodData.user_id = userId;

  logger.info('API: Received request to add mood entry.', { data: moodData });

  if (!moodData || !moodData.date || moodData.mood_score === undefined) {
    return res.status(400).json({ error: 'Missing required mood data: date and mood_score are required.' });
  }

  try {
    // The MoodConnector's processData method is used to save the mood entry.
    const moodConnector = new MoodConnector(); // Or get a singleton instance
    if (!moodConnector.isEnabled()) {
        return res.status(403).json({ error: 'Mood tracking is currently disabled in server configuration.' });
    }
    const result = await moodConnector.processData(moodData);

    if (result.errors > 0) {
      res.status(400).json({ error: 'Failed to save mood entry.', details: result.message || 'Validation error or database issue.' });
    } else {
      res.status(201).json({ message: 'Mood entry saved successfully.', details: result });
    }
  } catch (error) {
    logger.error(`API: Error saving mood entry: ${error.message}`, { stack: error.stack });
    next(error);
  }
});


module.exports = router;
