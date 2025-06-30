const axios = require('axios');
const BaseConnector = require('./BaseConnector');
const logger = require('../../utils/logger');
const db = require('../storage/DatabaseManager');

class BeeConnector extends BaseConnector {
  constructor() {
    super('bee'); // Matches config.dataSources key
    this.apiClient = axios.create({
      baseURL: this.sourceConfig.baseUrl || 'https://api.bee.computer/v1/me', // Ensure correct base URL
      headers: {
        'Authorization': `Bearer ${this.sourceConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
     logger.info(`BeeConnector initialized. Base URL: ${this.apiClient.defaults.baseURL}, Enabled: ${this.isEnabled()}`);
  }

  async fetchData(options = {}) {
    if (!this.isEnabled() || !this.sourceConfig.apiKey) {
      logger.warn('BeeConnector is disabled or API key is missing. Skipping fetch.');
      return null;
    }

    const lastSyncTime = options.forceFullSync ? new Date(0) : await this.getLastSyncTime();
    logger.info(`Bee: Fetching data since ${lastSyncTime.toISOString()}`);

    const results = {
      conversations: [],
      facts: [],
      todos: [],
      locations: [], // As per dev spec
    };

    // Fetching different types of data from Bee.computer
    // Dev spec indicates subSources: conversations, facts, todos, locations
    // We'll fetch each if enabled in config.

    try {
      if (this.sourceConfig.subSources?.conversations) {
        results.conversations = await this._fetchPaginatedData('/conversations', lastSyncTime, options, 'conversations');
        // After fetching conversations, we might need to fetch details for each (e.g., transcriptions)
        if (results.conversations.length > 0) {
            const detailedConversations = [];
            for (const convo of results.conversations) {
                try {
                    const detailResponse = await this.apiClient.get(`/conversations/${convo.id}`);
                    detailedConversations.push(detailResponse.data.conversation || detailResponse.data);
                } catch (detailError) {
                    logger.error(`Bee: Error fetching details for conversation ${convo.id}: ${detailError.message}`);
                    detailedConversations.push(convo); // Keep basic info if detail fails
                }
            }
            results.conversations = detailedConversations;
        }
      }
      if (this.sourceConfig.subSources?.facts) {
        results.facts = await this._fetchPaginatedData('/facts', lastSyncTime, options, 'facts');
      }
      if (this.sourceConfig.subSources?.todos) {
        results.todos = await this._fetchPaginatedData('/todos', lastSyncTime, options, 'todos');
      }
      if (this.sourceConfig.subSources?.locations) {
        // Locations might not have a 'since' or pagination in the same way. Adjust if needed.
        results.locations = await this._fetchPaginatedData('/locations', lastSyncTime, options, 'locations');
      }

      logger.info(`Bee: Successfully fetched data. Conversations: ${results.conversations.length}, Facts: ${results.facts.length}, Todos: ${results.todos.length}, Locations: ${results.locations.length}`);
      return results;

    } catch (error) {
      logger.error(`Bee: Error fetching data: ${error.message}`, {
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    }
  }

  async _fetchPaginatedData(endpoint, sinceTime, options, dataType) {
    let allData = [];
    let page = options.page || 1; // Bee API might use page-based pagination
    const limit = options.limit || 50;
    let keepFetching = true;

    logger.debug(`Bee: Fetching ${dataType} from ${endpoint}. Since: ${sinceTime.toISOString()}, Page: ${page}, Limit: ${limit}`);

    while (keepFetching) {
      const params = this.buildApiParams({
        limit: limit,
        page: page,
        // Bee API might use 'updated_since' or 'created_since'
        // For MVP, we might just fetch recent pages if 'since' is not directly supported for all items
        // Or filter client-side after fetching if necessary (less ideal)
        // For now, assuming the API filters by 'since' if available, or we get all and filter in processData
      });

      try {
        const response = await this.apiClient.get(endpoint, { params });
        // The actual data might be in `response.data.conversations`, `response.data.facts`, etc.
        // Or it could be `response.data.data` or just `response.data` if it's an array.
        const responseData = response.data[dataType] || response.data.data || response.data;

        if (responseData && responseData.length > 0) {
          allData = allData.concat(responseData);
          logger.info(`Bee: Fetched ${responseData.length} ${dataType} on page ${page}. Total ${dataType}: ${allData.length}`);

          // Pagination logic for Bee:
          // Check if `responseData.length < limit` or if there's a specific pagination indicator.
          // Example: `response.data.pagination?.has_next_page`
          if (responseData.length < limit) {
            keepFetching = false;
          } else {
            page++;
          }
        } else {
          logger.info(`Bee: No more ${dataType} found on page ${page}.`);
          keepFetching = false;
        }

        if (page > (options.maxPages || 10)) { // Safety break for MVP
             logger.warn(`Bee: Reached max pages limit for ${dataType}.`);
             break;
        }

      } catch (error) {
        logger.error(`Bee: Error fetching ${dataType} from ${endpoint} (page ${page}): ${error.message}`, {
          status: error.response?.status,
          data: error.response?.data,
        });
        // Decide whether to stop for this data type or try to continue
        keepFetching = false; // Stop on error for this data type
        // Optionally rethrow if this should halt the entire Bee sync
      }
    }
    return allData;
  }


  async processData(data, options = {}) {
    if (!data) {
      logger.info('Bee: No data object to process.');
      return { newEntries: 0, updatedEntries: 0, errors: 0 };
    }

    let totalNew = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    let latestSyncTimestamp = await this.getLastSyncTime();

    if (data.conversations && data.conversations.length > 0) {
      const convoStats = await this._processConversations(data.conversations, latestSyncTimestamp);
      totalNew += convoStats.newEntries;
      totalUpdated += convoStats.updatedEntries;
      totalErrors += convoStats.errors;
      if (convoStats.latestTimestamp > latestSyncTimestamp) latestSyncTimestamp = convoStats.latestTimestamp;
    }
    if (data.facts && data.facts.length > 0) {
      const factStats = await this._processFacts(data.facts, latestSyncTimestamp);
      totalNew += factStats.newEntries;
      totalUpdated += factStats.updatedEntries;
      totalErrors += factStats.errors;
      if (factStats.latestTimestamp > latestSyncTimestamp) latestSyncTimestamp = factStats.latestTimestamp;
    }
    if (data.todos && data.todos.length > 0) {
      const todoStats = await this._processTodos(data.todos, latestSyncTimestamp);
      totalNew += todoStats.newEntries;
      totalUpdated += todoStats.updatedEntries;
      totalErrors += todoStats.errors;
      if (todoStats.latestTimestamp > latestSyncTimestamp) latestSyncTimestamp = todoStats.latestTimestamp;
    }
    if (data.locations && data.locations.length > 0) {
      const locationStats = await this._processLocations(data.locations, latestSyncTimestamp);
      totalNew += locationStats.newEntries;
      totalUpdated += locationStats.updatedEntries; // Locations might be insert-only
      totalErrors += locationStats.errors;
      if (locationStats.latestTimestamp > latestSyncTimestamp) latestSyncTimestamp = locationStats.latestTimestamp;
    }

    // Update last sync time with the overall latest timestamp processed
    if (latestSyncTimestamp > await this.getLastSyncTime()) {
        await this.updateLastSyncTime(latestSyncTimestamp);
    }

    // Update daily aggregations
    // This needs a set of all dates affected by conversations, facts, todos, locations
    const affectedDates = new Set();
    (data.conversations || []).forEach(c => affectedDates.add(new Date(c.start_time || c.startTime).toISOString().split('T')[0]));
    // Facts, Todos, Locations might not always have a clear single "date" they belong to for daily aggregation.
    // For MVP, we'll focus on conversations for daily aggregation count for 'bee'.

    for (const date of affectedDates) {
        const convosOnDate = (data.conversations || []).filter(c => new Date(c.start_time || c.startTime).toISOString().split('T')[0] === date).length;
        if (convosOnDate > 0) { // Or if any other Bee data type was processed for this date
            const DataProcessor = require('../processing/DataProcessor');
            await DataProcessor.updateDailyAggregation(date, this.sourceName, convosOnDate);
        }
    }


    logger.info(`Bee: Processing complete. Total New: ${totalNew}, Total Updated: ${totalUpdated}, Total Errors: ${totalErrors}`);
    return { newEntries: totalNew, updatedEntries: totalUpdated, errors: totalErrors };
  }

  _getTimestamp(item, fields = ['updated_at', 'created_at', 'start_time', 'spoken_at', 'recorded_at']) {
    for (const field of fields) {
        if (item[field]) return new Date(item[field]);
    }
    return new Date(0); // Fallback if no known timestamp field
  }

  async _processConversations(conversations, currentLatestTimestamp) {
    let newEntries = 0, updatedEntries = 0, errors = 0;
    let latestItemTimestamp = new Date(0);

    for (const convo of conversations) {
      try {
        const itemTimestamp = this._getTimestamp(convo, ['updated_at', 'end_time', 'start_time']);
        if (itemTimestamp > latestItemTimestamp) latestItemTimestamp = itemTimestamp;

        const entry = {
          bee_id: convo.id,
          start_time: new Date(convo.start_time || convo.startTime),
          end_time: new Date(convo.end_time || convo.endTime),
          device_type: convo.device_type || convo.deviceType,
          summary: convo.summary,
          short_summary: convo.short_summary || convo.shortSummary,
          state: convo.state,
          primary_location: convo.primary_location ? JSON.stringify(convo.primary_location) : null,
        };

        if (!entry.bee_id || !entry.start_time || !entry.end_time || isNaN(entry.start_time.getTime()) || isNaN(entry.end_time.getTime())) {
            logger.warn('Bee Conversation: Skipping due to missing critical fields or invalid dates', {id: convo.id, start: convo.start_time, end: convo.end_time});
            errors++;
            continue;
        }

        const upsertQuery = `
          INSERT INTO bee_conversations (bee_id, start_time, end_time, device_type, summary, short_summary, state, primary_location)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (bee_id) DO UPDATE SET
            start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, device_type = EXCLUDED.device_type,
            summary = EXCLUDED.summary, short_summary = EXCLUDED.short_summary, state = EXCLUDED.state,
            primary_location = EXCLUDED.primary_location, updated_at = NOW()
          RETURNING id, (xmax = 0) AS inserted;
        `;
        const result = await db.query(upsertQuery, [
          entry.bee_id, entry.start_time.toISOString(), entry.end_time.toISOString(), entry.device_type,
          entry.summary, entry.short_summary, entry.state, entry.primary_location
        ]);

        const dbConvoId = result.rows[0].id;
        result.rows[0].inserted ? newEntries++ : updatedEntries++;

        // Process utterances if they exist (e.g., convo.transcriptions or convo.utterances)
        const utterances = convo.transcriptions || convo.utterances;
        if (utterances && Array.isArray(utterances)) {
          await this._processUtterances(utterances, dbConvoId);
        }

      } catch (dbError) {
        logger.error(`Bee: Error processing conversation ${convo.id}: ${dbError.message}`, { stack: dbError.stack });
        errors++;
      }
    }
    return { newEntries, updatedEntries, errors, latestTimestamp: latestItemTimestamp > currentLatestTimestamp ? latestItemTimestamp : currentLatestTimestamp };
  }

  async _processUtterances(utterances, dbConvoId) {
    for (const utt of utterances) {
      try {
        // Bee dev spec: bee_utterance_id, speaker, text, start_seconds, end_seconds, spoken_at, is_realtime
        // API might have different field names, e.g. utt.id for bee_utterance_id
        const utteranceEntry = {
          conversation_id: dbConvoId,
          bee_utterance_id: utt.id || utt.utterance_id, // Adjust based on actual API field
          speaker: utt.speaker,
          text: utt.text,
          start_seconds: utt.start_seconds || utt.startOffsetSeconds, // Adjust
          end_seconds: utt.end_seconds || utt.endOffsetSeconds, // Adjust
          spoken_at: new Date(utt.spoken_at || utt.timestamp), // Adjust
          is_realtime: utt.is_realtime !== undefined ? utt.is_realtime : true,
        };

        if (!utteranceEntry.bee_utterance_id || !utteranceEntry.spoken_at || isNaN(utteranceEntry.spoken_at.getTime())) {
            logger.warn('Bee Utterance: Skipping due to missing critical fields or invalid date', {utt_id: utt.id, convo_id: dbConvoId});
            continue; // Skip this utterance
        }

        // Utterances are usually immutable parts of a conversation.
        // We can insert them and use ON CONFLICT DO NOTHING if they might be re-fetched.
        // A composite key (conversation_id, bee_utterance_id) is in schema.
        const insertQuery = `
          INSERT INTO bee_utterances (conversation_id, bee_utterance_id, speaker, text, start_seconds, end_seconds, spoken_at, is_realtime)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (conversation_id, bee_utterance_id) DO NOTHING;
        `; // Or DO UPDATE if utterances can change, though less common
        await db.query(insertQuery, [
          utteranceEntry.conversation_id, utteranceEntry.bee_utterance_id, utteranceEntry.speaker,
          utteranceEntry.text, utteranceEntry.start_seconds, utteranceEntry.end_seconds,
          utteranceEntry.spoken_at.toISOString(), utteranceEntry.is_realtime
        ]);
      } catch (error) {
        logger.error(`Bee: Error processing utterance for conversation ${dbConvoId}: ${error.message}`, { utterance_id: utt.id });
        // Potentially increment an error counter for utterances if needed
      }
    }
  }

  async _processFacts(facts, currentLatestTimestamp) {
    let newEntries = 0, updatedEntries = 0, errors = 0;
    let latestItemTimestamp = new Date(0);
    for (const fact of facts) {
        try {
            const itemTimestamp = this._getTimestamp(fact, ['updated_at', 'created_at']);
            if (itemTimestamp > latestItemTimestamp) latestItemTimestamp = itemTimestamp;

            const entry = {
                bee_id: fact.id,
                content: fact.content,
                is_confirmed: fact.is_confirmed !== undefined ? fact.is_confirmed : true,
            };
            if (!entry.bee_id) { errors++; continue; }

            const upsertQuery = `
                INSERT INTO bee_facts (bee_id, content, is_confirmed) VALUES ($1, $2, $3)
                ON CONFLICT (bee_id) DO UPDATE SET content = EXCLUDED.content, is_confirmed = EXCLUDED.is_confirmed, updated_at = NOW()
                RETURNING (xmax = 0) AS inserted;`;
            const result = await db.query(upsertQuery, [entry.bee_id, entry.content, entry.is_confirmed]);
            result.rows[0].inserted ? newEntries++ : updatedEntries++;
        } catch (dbError) { errors++; logger.error(`Bee: Error processing fact ${fact.id}: ${dbError.message}`); }
    }
    return { newEntries, updatedEntries, errors, latestTimestamp: latestItemTimestamp > currentLatestTimestamp ? latestItemTimestamp : currentLatestTimestamp };
  }

  async _processTodos(todos, currentLatestTimestamp) {
    let newEntries = 0, updatedEntries = 0, errors = 0;
    let latestItemTimestamp = new Date(0);
    for (const todo of todos) {
        try {
            const itemTimestamp = this._getTimestamp(todo, ['updated_at', 'created_at', 'alarm_at']);
            if (itemTimestamp > latestItemTimestamp) latestItemTimestamp = itemTimestamp;

            const entry = {
                bee_id: todo.id,
                text: todo.text,
                alarm_at: todo.alarm_at ? new Date(todo.alarm_at) : null,
                completed: todo.completed || false,
            };
            if (!entry.bee_id) { errors++; continue; }

            const upsertQuery = `
                INSERT INTO bee_todos (bee_id, text, alarm_at, completed) VALUES ($1, $2, $3, $4)
                ON CONFLICT (bee_id) DO UPDATE SET text = EXCLUDED.text, alarm_at = EXCLUDED.alarm_at, completed = EXCLUDED.completed, updated_at = NOW()
                RETURNING (xmax = 0) AS inserted;`;
            const result = await db.query(upsertQuery, [entry.bee_id, entry.text, entry.alarm_at ? entry.alarm_at.toISOString() : null, entry.completed]);
            result.rows[0].inserted ? newEntries++ : updatedEntries++;
        } catch (dbError) { errors++; logger.error(`Bee: Error processing todo ${todo.id}: ${dbError.message}`); }
    }
    return { newEntries, updatedEntries, errors, latestTimestamp: latestItemTimestamp > currentLatestTimestamp ? latestItemTimestamp : currentLatestTimestamp };
  }

  async _processLocations(locations, currentLatestTimestamp) {
    // Locations are often insert-only snapshots.
    let newEntries = 0, updatedEntries = 0, errors = 0; // updatedEntries might always be 0
    let latestItemTimestamp = new Date(0);

    for (const loc of locations) {
      try {
        // Bee dev spec: bee_id, latitude, longitude, address, created_at (for the record in DB)
        // API might provide 'timestamp' or 'recorded_at' for when the location itself was captured.
        const recordedAt = new Date(loc.recorded_at || loc.timestamp || loc.created_at); // Prioritize specific location timestamp
        if (recordedAt > latestItemTimestamp) latestItemTimestamp = recordedAt;

        const entry = {
          bee_id: loc.id, // Assuming API 'id' maps to 'bee_id' for the location record
          latitude: loc.latitude,
          longitude: loc.longitude,
          address: loc.address,
          recorded_at: recordedAt,
        };

        if (!entry.bee_id || entry.latitude === undefined || entry.longitude === undefined || isNaN(recordedAt.getTime())) {
            logger.warn('Bee Location: Skipping due to missing critical fields or invalid date', loc);
            errors++;
            continue;
        }

        // Locations are often unique by their content AND timestamp.
        // If bee_id is unique for each location point, ON CONFLICT (bee_id) is fine.
        // If not, a more complex unique constraint or just inserting might be needed.
        // The schema has bee_id as UNIQUE for bee_locations.
        const insertQuery = `
          INSERT INTO bee_locations (bee_id, latitude, longitude, address, recorded_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (bee_id) DO UPDATE SET
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            address = EXCLUDED.address,
            recorded_at = EXCLUDED.recorded_at
            -- created_at is not updated here, updated_at is not on this table by spec
          RETURNING (xmax = 0) AS inserted;
        `;
        // If truly insert-only and duplicates by bee_id should be ignored: ON CONFLICT (bee_id) DO NOTHING.
        const result = await db.query(insertQuery, [
          entry.bee_id, entry.latitude, entry.longitude, entry.address, entry.recorded_at.toISOString()
        ]);
        // If using DO NOTHING, result might be empty if conflict. Check result.rowCount.
        if (result.rowCount > 0) {
            result.rows[0].inserted ? newEntries++ : updatedEntries++;
        }

      } catch (dbError) {
        logger.error(`Bee: Error processing location ${loc.id}: ${dbError.message}`, { stack: dbError.stack });
        errors++;
      }
    }
    return { newEntries, updatedEntries, errors, latestTimestamp: latestItemTimestamp > currentLatestTimestamp ? latestItemTimestamp : currentLatestTimestamp };
  }
}

module.exports = BeeConnector;
