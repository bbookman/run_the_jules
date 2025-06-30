const BaseConnector = require('./BaseConnector');
const logger = require('../../utils/logger');
const db = require('../storage/DatabaseManager');

// Mood data is manually inputted via an API endpoint as per PRD/DevSpec for MVP.
// This "connector" is more of a service to handle the storage of mood data
// when it's posted to the backend, rather than fetching from an external API.
// It doesn't have a `fetchData` method in the traditional sense.
// The `sync` method might not be directly applicable either, unless we use it
// to process a queue of mood entries or something similar (overkill for MVP).

class MoodConnector extends BaseConnector {
  constructor() {
    super('mood'); // Matches config.dataSources key
    // No API client needed for mood as it's input-driven.
    logger.info(`MoodConnector initialized. Enabled: ${this.isEnabled()}`);
  }

  // fetchData is not applicable for mood in MVP as it's manually input.
  async fetchData(options = {}) {
    if (!this.isEnabled()) {
      logger.warn('MoodConnector is disabled. Skipping fetch (not applicable).');
      return null;
    }
    logger.info('MoodConnector: fetchData called, but mood data is input-driven. No external fetching.');
    return null; // No data to fetch from an external source
  }

  // processData will be used to store mood data received from an API endpoint.
  // `moodEntryData` would be the payload from the POST request.
  async processData(moodEntryData, options = {}) {
    if (!this.isEnabled()) {
      logger.warn('MoodConnector is disabled. Skipping process.');
      return { newEntries: 0, updatedEntries: 0, errors: 1, message: 'Mood source disabled.' };
    }

    if (!moodEntryData) {
      logger.warn('MoodConnector: No mood entry data provided to process.');
      return { newEntries: 0, updatedEntries: 0, errors: 1, message: 'No data provided.' };
    }

    let newEntries = 0;
    let updatedEntries = 0;
    let errorCount = 0;

    // Validate incoming moodEntryData
    // Expected fields: date (YYYY-MM-DD), mood_score (1-10), mood_text (optional), notes (optional)
    // user_id is optional for MVP, can be null.
    const { date, mood_score, mood_text, notes, user_id = null, recorded_at } = moodEntryData;

    if (!date || mood_score === undefined) {
      logger.error('MoodConnector: Missing required fields (date, mood_score) in mood entry data.', moodEntryData);
      return { newEntries: 0, updatedEntries: 0, errors: 1, message: 'Missing required fields.' };
    }

    try {
      const entry = {
        user_id: user_id, // For future multi-user support
        date: new Date(date).toISOString().split('T')[0], // Ensure correct date format
        mood_score: parseInt(mood_score, 10),
        mood_text: mood_text,
        notes: notes,
        recorded_at: recorded_at ? new Date(recorded_at) : new Date(), // When the mood was input
      };

      if (isNaN(entry.mood_score) || entry.mood_score < 1 || entry.mood_score > 10) {
        logger.error('MoodConnector: Invalid mood_score.', { score: mood_score });
        return { newEntries: 0, updatedEntries: 0, errors: 1, message: 'Invalid mood score.' };
      }
      if (isNaN(new Date(entry.date).getTime())) {
          logger.error('MoodConnector: Invalid date format.', { date });
          return { newEntries: 0, updatedEntries: 0, errors: 1, message: 'Invalid date format.' };
      }


      // Upsert logic for mood_entries table. Unique constraint is on (date) for single user MVP.
      // If user_id is implemented, it would be (user_id, date).
      const upsertQuery = `
        INSERT INTO mood_entries (user_id, date, mood_score, mood_text, notes, recorded_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (date) DO UPDATE SET
          mood_score = EXCLUDED.mood_score,
          mood_text = EXCLUDED.mood_text,
          notes = EXCLUDED.notes,
          recorded_at = EXCLUDED.recorded_at,
          updated_at = NOW()
        RETURNING (xmax = 0) AS inserted;
      `;
      // If user_id is part of the key: ON CONFLICT (user_id, date) DO UPDATE ...

      const result = await db.query(upsertQuery, [
        entry.user_id, entry.date, entry.mood_score, entry.mood_text, entry.notes, entry.recorded_at.toISOString()
      ]);

      if (result.rows[0].inserted) {
        newEntries++;
      } else {
        updatedEntries++;
      }
      logger.info(`MoodConnector: Processed mood entry for date ${entry.date}. New: ${result.rows[0].inserted}`);

      // Mood data doesn't have external sync times, so no call to updateLastSyncTime here.
      if (newEntries > 0 || updatedEntries > 0) {
        const DataProcessor = require('../processing/DataProcessor');
        await DataProcessor.updateDailyAggregation(entry.date, this.sourceName, 1); // 1 indicates data is present
      }

    } catch (dbError) {
      logger.error(`MoodConnector: Error processing mood entry for date ${date}: ${dbError.message}`, { stack: dbError.stack, moodEntryData });
      errorCount++;
    }

    return { newEntries, updatedEntries, errors: errorCount };
  }

  // The `sync` method from BaseConnector might not be directly called for mood.
  // Instead, an API endpoint would call `processData` directly.
  // However, to conform to the BaseConnector structure if needed for a unified sync call:
  async sync(options = {}) {
     if (!this.isEnabled()) {
      logger.info(`Sync skipped for disabled source: ${this.sourceName}`);
      return { success: false, message: `${this.sourceName} is disabled.`};
    }
    logger.info(`MoodConnector: Sync called. Mood data is input-driven, this method is a placeholder or for potential batch processing.`);
    // If there was a queue of mood entries to process, it could be handled here.
    // For MVP, this likely does nothing.
    return { success: true, message: 'Mood sync is manual via API input.', newEntries: 0, updatedEntries: 0, errors: 0 };
  }
}

module.exports = MoodConnector;
