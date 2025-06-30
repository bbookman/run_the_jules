const logger = require('../../utils/logger');
// const db = require('../storage/DatabaseManager'); // If needed for direct DB ops

// This DataProcessor is quite minimal for MVP as most transformation logic
// is currently handled within each connector's processData method.
// It could be expanded for more complex cross-source processing, enrichment,
// or running NLP tasks if not handled by AIProvider.

class DataProcessor {
  constructor() {
    logger.info('DataProcessor initialized.');
  }

  // Example: Generic data enrichment or transformation
  // This is a placeholder for more complex scenarios.
  async enrichData(item, sourceType) {
    logger.debug(`DataProcessor: Enriching item from ${sourceType}`, { itemId: item.id });
    // Add common tags, parse entities, link to other data points, etc.
    // For MVP, this might not do much.
    const enrichedItem = { ...item }; // Create a copy

    // Example: Add a processed timestamp
    enrichedItem.processedAt = new Date().toISOString();

    // Example: Basic text cleaning (if not done elsewhere)
    if (enrichedItem.text && typeof enrichedItem.text === 'string') {
      // enrichedItem.text = this.cleanText(enrichedItem.text);
    }

    // Example: if it's a Bee conversation, maybe extract keywords or a sentiment
    if (sourceType === 'bee' && item.summary) {
        // enrichedItem.keywords = this.extractKeywords(item.summary); // Hypothetical
    }

    // Return the (potentially) modified item
    return enrichedItem;
  }

  // Example utility function (could be part of a text processing submodule)
  cleanText(text) {
    if (!text) return text;
    // Replace multiple spaces with single, trim, etc.
    return text.replace(/\s+/g, ' ').trim();
  }

  // Placeholder for keyword extraction
  extractKeywords(text, count = 5) {
    if (!text) return [];
    // Simple keyword extraction: split by space, count frequency, take top N (very naive)
    const words = text.toLowerCase().match(/\b(\w+)\b/g) || [];
    const frequency = words.reduce((map, word) => {
      if (word.length > 3 && !['the', 'a', 'is', 'to', 'of', 'and', 'in', 'it'].includes(word)) { // Basic stop words
        map[word] = (map[word] || 0) + 1;
      }
      return map;
    }, {});
    return Object.entries(frequency)
      .sort(([,a],[,b]) => b-a)
      .slice(0, count)
      .map(([word]) => word);
  }


  // This method could be used to update the daily_aggregations table
  // after data has been synced for a particular source and date.
  async updateDailyAggregation(date, sourceType, itemCount) {
    if (!date || !sourceType) {
      logger.warn('DataProcessor: updateDailyAggregation called with missing date or sourceType.');
      return;
    }

    // Ensure date is in 'YYYY-MM-DD' format
    const formattedDate = new Date(date).toISOString().split('T')[0];

    logger.info(`DataProcessor: Updating daily aggregation for ${formattedDate}, source ${sourceType}, count ${itemCount}`);

    let fieldToUpdate;
    let countFieldToUpdate;

    switch (sourceType) {
      case 'limitless':
        fieldToUpdate = 'has_limitless_data';
        countFieldToUpdate = 'limitless_entry_count';
        break;
      case 'bee':
        fieldToUpdate = 'has_bee_data';
        countFieldToUpdate = 'bee_conversation_count'; // Assuming itemCount refers to conversations for bee
        break;
      case 'weather':
        fieldToUpdate = 'has_weather_data';
        // No specific count field for weather in daily_aggregations beyond the boolean flag
        break;
      case 'mood':
        fieldToUpdate = 'has_mood_data';
        // No specific count field for mood
        break;
      default:
        logger.warn(`DataProcessor: Unknown source type '${sourceType}' for daily aggregation update.`);
        return;
    }

    try {
      const updateQuery = `
        INSERT INTO daily_aggregations (date, ${fieldToUpdate}${countFieldToUpdate ? `, ${countFieldToUpdate}` : ''})
        VALUES ($1, $2${countFieldToUpdate ? `, $3` : ''})
        ON CONFLICT (date) DO UPDATE SET
          ${fieldToUpdate} = EXCLUDED.${fieldToUpdate}${countFieldToUpdate ? `,
          ${countFieldToUpdate} = GREATEST(COALESCE(daily_aggregations.${countFieldToUpdate}, 0), EXCLUDED.${countFieldToUpdate})` : ''},
          -- Use GREATEST to ensure count doesn't decrease if multiple updates happen with partial counts.
          -- Or, if itemCount is total for the day: ${countFieldToUpdate} = EXCLUDED.${countFieldToUpdate}
          updated_at = NOW();
      `;

      const queryParams = [formattedDate, true];
      if (countFieldToUpdate) {
        queryParams.push(itemCount > 0 ? itemCount : 0); // Ensure count is not negative
      }

      await db.query(updateQuery, queryParams);
      logger.info(`DataProcessor: Daily aggregation updated for ${formattedDate}, source ${sourceType}.`);

    } catch (error) {
      logger.error(`DataProcessor: Error updating daily aggregation for ${formattedDate}, source ${sourceType}: ${error.message}`, { stack: error.stack });
    }
  }
}

// Singleton instance
const dataProcessorInstance = new DataProcessor();
module.exports = dataProcessorInstance;
