const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const db = require('../../services/storage/DatabaseManager');
const DateNormalizer = require('../../services/processing/DateNormalizer');
const AIProvider = require('../../services/ai/AIProvider');

// GET /api/calendar/month/{year}/{month}
router.get('/month/:year/:month', async (req, res, next) => {
  try {
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10); // 1-indexed month

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Invalid year or month parameter.' });
    }

    // Calculate the first and last day of the month in UTC
    // Month in JavaScript's Date object is 0-indexed, so subtract 1
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0)); // Day 0 of next month is last day of current month

    logger.info(`Fetching monthly calendar data for ${year}-${month} (UTC Start: ${startDate.toISOString()}, UTC End: ${endDate.toISOString()})`);

    // Query daily_aggregations table for the given month
    // For MVP, user_id is not strictly enforced in aggregation, so we don't filter by it.
    // Future: AND (user_id = $3 OR user_id IS NULL)
    const query = `
      SELECT
        date,
        has_limitless_data,
        has_bee_data,
        has_weather_data,
        has_mood_data,
        limitless_entry_count,
        bee_conversation_count
      FROM daily_aggregations
      WHERE date >= $1 AND date <= $2
      ORDER BY date ASC;
    `;

    const result = await db.query(query, [
        DateNormalizer.formatDateToYYYYMMDD(startDate),
        DateNormalizer.formatDateToYYYYMMDD(endDate)
    ]);

    const daysData = result.rows.map(row => {
      const dataTypes = [];
      if (row.has_limitless_data) dataTypes.push('limitless');
      if (row.has_bee_data) dataTypes.push('bee');
      if (row.has_weather_data) dataTypes.push('weather');
      if (row.has_mood_data) dataTypes.push('mood');

      return {
        date: DateNormalizer.formatDateToYYYYMMDD(new Date(row.date)), // Ensure correct formatting
        hasData: dataTypes.length > 0,
        dataTypes: dataTypes,
        entryCount: (row.limitless_entry_count || 0) + (row.bee_conversation_count || 0), // Example total count
      };
    });

    res.json({
      year: year,
      month: month,
      days: daysData,
    });

  } catch (error) {
    logger.error(`Error fetching monthly calendar data: ${error.message}`, { stack: error.stack, params: req.params });
    next(error);
  }
});

// GET /api/calendar/day/{date} (date in YYYY-MM-DD format)
router.get('/day/:date', async (req, res, next) => {
  try {
    const dateParam = req.params.date;
    if (!DateNormalizer.isValidYYYYMMDD(dateParam)) {
        return res.status(400).json({ error: 'Invalid date format. Please use YYYY-MM-DD.' });
    }

    const normalizedDate = DateNormalizer.getStartOfDayUTC(dateParam);
    if (!normalizedDate) {
         return res.status(400).json({ error: 'Invalid date value.' });
    }
    const dateStr = DateNormalizer.formatDateToYYYYMMDD(normalizedDate);

    logger.info(`Fetching daily data for ${dateStr}`);

    const responsePayload = {
      date: dateStr,
      aiSummary: "AI Daily Summary feature not yet implemented for this day.", // Placeholder
      modules: {},
    };

    // Fetch AI summary from daily_aggregations
    const aggQuery = `SELECT ai_summary FROM daily_aggregations WHERE date = $1`;
    const aggResult = await db.query(aggQuery, [dateStr]);
    if (aggResult.rows.length > 0 && aggResult.rows[0].ai_summary) {
      responsePayload.aiSummary = aggResult.rows[0].ai_summary;
    } else {
        // If no summary exists, generate and store it (or get placeholder)
        responsePayload.aiSummary = await AIProvider.generateDailySummary(dateStr);
    }

    // Fetch Limitless data for the day
    // Querying limitless_entries directly for the specific day
    const limitlessQuery = `
        SELECT id, limitless_id, title, markdown_content, start_time, end_time, is_starred
        FROM limitless_entries
        WHERE DATE(start_time AT TIME ZONE 'UTC') = $1 ORDER BY start_time ASC;`;
    const limitlessResult = await db.query(limitlessQuery, [dateStr]);
    if (limitlessResult.rows.length > 0) {
      responsePayload.modules.limitless = {
        entries: limitlessResult.rows,
        count: limitlessResult.rows.length,
      };
    }

    // Fetch Bee data for the day
    // This is more complex as Bee data has conversations, facts, todos.
    // For MVP, let's fetch conversations that started on this day.
    const beeQuery = `
        SELECT id, bee_id, start_time, end_time, summary, short_summary, device_type
        FROM bee_conversations
        WHERE DATE(start_time AT TIME ZONE 'UTC') = $1 ORDER BY start_time ASC;`;
    const beeResult = await db.query(beeQuery, [dateStr]);
    // In a full implementation, you'd also fetch related utterances, facts for the day, todos due/created.
    // For now, just conversations.
    if (beeResult.rows.length > 0) {
      responsePayload.modules.bee = {
        conversations: beeResult.rows,
        // facts: [], // Placeholder for facts related to this day
        // todos: [], // Placeholder for todos related to this day
        count: beeResult.rows.length,
      };
    }

    // Fetch Weather data for the day
    const weatherQuery = `
        SELECT temperature_high, temperature_low, condition, description, humidity, icon_code, sunrise, sunset
        FROM weather_entries
        WHERE date = $1;`; // Assuming location is handled by WeatherConnector's single configured location for now
    const weatherResult = await db.query(weatherQuery, [dateStr]);
    if (weatherResult.rows.length > 0) {
      responsePayload.modules.weather = weatherResult.rows[0]; // Assuming one entry per day/location
    }

    // Fetch Mood data for the day
    const moodQuery = `SELECT mood_score, mood_text, notes, recorded_at FROM mood_entries WHERE date = $1;`;
    const moodResult = await db.query(moodQuery, [dateStr]);
    if (moodResult.rows.length > 0) {
      responsePayload.modules.mood = moodResult.rows[0];
    }

    res.json(responsePayload);

  } catch (error) {
    logger.error(`Error fetching daily data: ${error.message}`, { stack: error.stack, params: req.params });
    next(error);
  }
});

module.exports = router;
