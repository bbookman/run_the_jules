const axios = require('axios');
const BaseConnector = require('./BaseConnector');
const logger = require('../../utils/logger');
const db = require('../storage/DatabaseManager');

class LimitlessConnector extends BaseConnector {
  constructor() {
    super('limitless'); // Must match the key in config.dataSources
    this.apiClient = axios.create({
      baseURL: this.sourceConfig.baseUrl || 'https://api.limitless.ai/v1', // Ensure trailing slash consistency if API requires
      headers: {
        'Authorization': `Bearer ${this.sourceConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    logger.info(`LimitlessConnector initialized. Base URL: ${this.apiClient.defaults.baseURL}, Enabled: ${this.isEnabled()}`);
  }

  async fetchData(options = {}) {
    if (!this.isEnabled() || !this.sourceConfig.apiKey) {
      logger.warn('LimitlessConnector is disabled or API key is missing. Skipping fetch.');
      return null;
    }

    const lastSyncTime = options.forceFullSync ? new Date(0) : await this.getLastSyncTime();
    logger.info(`Limitless: Fetching data since ${lastSyncTime.toISOString()}`);

    // Limitless API specific parameters (refer to their documentation)
    // Example params: 'since' (timestamp or ID), 'limit', 'cursor'
    // For MVP, let's try a simple fetch. A robust implementation would handle pagination.
    // The Limitless dev spec mentions: timezone, date, start, end, cursor, direction, limit
    // We'll use a simplified approach for MVP, perhaps fetching recent items.
    // A common pattern is to fetch items created/updated after lastSyncTime.

    let allLifelogs = [];
    let cursor = options.cursor; // For pagination
    const limit = options.limit || 50; // Number of items per page
    let page = 1;

    try {
      // Loop for pagination if the API supports it
      // This is a generic pagination loop; adapt to Limitless API's specific mechanism (cursor, page, etc.)
      // For now, let's assume a simple case where we fetch a batch and if it's full, there might be more.
      // A more robust solution would check a 'hasNextPage' or similar flag from the API response.
      do {
        const params = this.buildApiParams({
          // since: lastSyncTime.toISOString(), // This might need to be formatted or be an ID
          limit: limit,
          cursor: cursor, // If API uses cursor-based pagination
          // page: page, // If API uses page-based pagination
          // direction: 'asc', // Or 'desc'
          // start: lastSyncTime.toISOString(), // If API uses start/end time range
          // For MVP, we might fetch all or recent, without complex time range logic initially
        });

        logger.debug(`Limitless: Fetching page ${page} with params:`, params);
        // The endpoint in dev_spec is /v1/lifelogs
        const response = await this.apiClient.get('/lifelogs', { params });

        const lifelogs = response.data.lifelogs || response.data.data || response.data; // Adjust based on actual API response structure

        if (lifelogs && lifelogs.length > 0) {
          allLifelogs = allLifelogs.concat(lifelogs);
          logger.info(`Limitless: Fetched ${lifelogs.length} lifelogs on page ${page}. Total: ${allLifelogs.length}`);

          // Pagination logic: Check for a 'nextCursor', 'nextPage', or if the number of items fetched is less than the limit
          cursor = response.data.nextCursor || response.data.pagination?.next_cursor; // Adapt to API
          if (!cursor && lifelogs.length < limit) { // Simple check if no explicit next cursor
            break;
          }
          page++;
        } else {
          logger.info(`Limitless: No more lifelogs found on page ${page}.`);
          break; // No more data
        }

        if (page > (options.maxPages || 10)) { // Safety break for MVP to avoid infinite loops
             logger.warn("Limitless: Reached max pages limit during fetch.");
             break;
        }

      } while (cursor); // Or other pagination condition

      logger.info(`Limitless: Successfully fetched a total of ${allLifelogs.length} lifelogs.`);
      return allLifelogs;

    } catch (error) {
      logger.error(`Limitless: Error fetching data: ${error.message}`, {
        status: error.response?.status,
        data: error.response?.data,
        // config: error.config, // Can be verbose
      });
      throw error; // Re-throw to be caught by BaseConnector.sync
    }
  }

  async processData(lifelogs, options = {}) {
    if (!lifelogs || lifelogs.length === 0) {
      logger.info('Limitless: No lifelogs to process.');
      return { newEntries: 0, updatedEntries: 0, errors: 0 };
    }

    let newEntries = 0;
    let updatedEntries = 0;
    let errorCount = 0;

    for (const lifelog of lifelogs) {
      try {
        // Transform lifelog data to match DB schema for limitless_entries
        const entry = {
          limitless_id: lifelog.id, // Assuming API 'id' maps to 'limitless_id'
          title: lifelog.title,
          markdown_content: lifelog.markdown_content || lifelog.contents?.find(c => c.type === 'markdown')?.content, // Example access
          start_time: new Date(lifelog.start_time || lifelog.startTime || lifelog.created_at), // Adjust based on API field names
          end_time: new Date(lifelog.end_time || lifelog.endTime || lifelog.updated_at), // Adjust
          is_starred: lifelog.is_starred || lifelog.isStarred || false,
          // created_at and updated_at will be set by DB defaults or triggers
        };

        // Validate required fields
        if (!entry.limitless_id || !entry.start_time || !entry.end_time) {
            logger.warn('Limitless: Skipping lifelog due to missing critical fields (id, start_time, end_time)', lifelog);
            errorCount++;
            continue;
        }
        if (isNaN(entry.start_time.getTime()) || isNaN(entry.end_time.getTime())) {
            logger.warn('Limitless: Skipping lifelog due to invalid date fields', {id: lifelog.id, start: lifelog.start_time, end: lifelog.end_time});
            errorCount++;
            continue;
        }


        // Upsert logic: Insert if new, update if exists (based on limitless_id)
        const upsertQuery = `
          INSERT INTO limitless_entries (limitless_id, title, markdown_content, start_time, end_time, is_starred)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (limitless_id) DO UPDATE SET
            title = EXCLUDED.title,
            markdown_content = EXCLUDED.markdown_content,
            start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time,
            is_starred = EXCLUDED.is_starred,
            updated_at = NOW()
          RETURNING id, (xmax = 0) AS inserted;
        `;
        // xmax = 0 indicates an insert, otherwise it's an update (PostgreSQL specific)

        const result = await db.query(upsertQuery, [
          entry.limitless_id, entry.title, entry.markdown_content,
          entry.start_time.toISOString(), entry.end_time.toISOString(), entry.is_starred
        ]);

        const dbEntryId = result.rows[0].id;
        if (result.rows[0].inserted) {
          newEntries++;
        } else {
          updatedEntries++;
        }
        logger.debug(`Limitless: Processed lifelog ${entry.limitless_id}. New: ${result.rows[0].inserted}. DB ID: ${dbEntryId}`);

        // Process content_nodes if they exist in the lifelog structure
        if (lifelog.contents && Array.isArray(lifelog.contents)) {
          await this.processContentNodes(lifelog.contents, dbEntryId, null); // Pass null as parent_id for root nodes
        }

      } catch (dbError) {
        logger.error(`Limitless: Error processing lifelog ${lifelog.id}: ${dbError.message}`, { stack: dbError.stack, lifelog });
        errorCount++;
      }
    }

    if (lifelogs.length > 0 && (newEntries > 0 || updatedEntries > 0)) {
        const latestEntryTime = lifelogs.reduce((latest, item) => {
            const itemTime = new Date(item.updated_at || item.created_at || item.end_time || 0);
            return itemTime > latest ? itemTime : latest;
        }, new Date(0));

        if (latestEntryTime > new Date(0)) {
            await this.updateLastSyncTime(latestEntryTime);
        }

        // Update daily aggregations for affected dates
        const affectedDates = new Set(lifelogs.map(l => new Date(l.start_time || l.startTime || l.created_at).toISOString().split('T')[0]));
        for (const date of affectedDates) {
            // This count is approximate; ideally, count actual entries for that date.
            // For now, we signal that there was activity.
            const entriesOnDate = lifelogs.filter(l => new Date(l.start_time || l.startTime || l.created_at).toISOString().split('T')[0] === date).length;
            if (entriesOnDate > 0) {
                const DataProcessor = require('../processing/DataProcessor'); // Moved require here to avoid circular deps if any
                await DataProcessor.updateDailyAggregation(date, this.sourceName, entriesOnDate);
            }
        }
    }


    logger.info(`Limitless: Processing complete. New: ${newEntries}, Updated: ${updatedEntries}, Errors: ${errorCount}`);
    return { newEntries, updatedEntries, errors: errorCount };
  }

  async processContentNodes(contentNodes, entryId, parentNodeDbId) {
    for (const node of contentNodes) {
      try {
        const contentNodeEntry = {
          entry_id: entryId,
          parent_id: parentNodeDbId, // Null for root nodes directly under an entry
          node_type: node.node_type || node.type || 'unknown',
          content: node.content || node.text,
          start_time: node.start_time ? new Date(node.start_time) : null,
          end_time: node.end_time ? new Date(node.end_time) : null,
          start_offset_ms: node.start_offset_ms || node.startOffsetMs,
          end_offset_ms: node.end_offset_ms || node.endOffsetMs,
          speaker_name: node.speaker_name || node.speakerName,
          speaker_identifier: node.speaker_identifier || node.speakerIdentifier,
        };

        // Simple insert for content nodes. Dev spec doesn't imply updates for these.
        const insertQuery = `
          INSERT INTO limitless_content_nodes (
            entry_id, parent_id, node_type, content, start_time, end_time,
            start_offset_ms, end_offset_ms, speaker_name, speaker_identifier
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id;
        `;
        const result = await db.query(insertQuery, [
          contentNodeEntry.entry_id, contentNodeEntry.parent_id, contentNodeEntry.node_type,
          contentNodeEntry.content,
          contentNodeEntry.start_time ? contentNodeEntry.start_time.toISOString() : null,
          contentNodeEntry.end_time ? contentNodeEntry.end_time.toISOString() : null,
          contentNodeEntry.start_offset_ms, contentNodeEntry.end_offset_ms,
          contentNodeEntry.speaker_name, contentNodeEntry.speaker_identifier
        ]);
        const contentNodeDbId = result.rows[0].id;
        logger.debug(`Limitless: Inserted content node ${contentNodeDbId} of type ${contentNodeEntry.node_type} for entry ${entryId}`);

        // Recursively process child nodes if they exist (e.g., if node.children is an array)
        if (node.children && Array.isArray(node.children) && node.children.length > 0) {
          await this.processContentNodes(node.children, entryId, contentNodeDbId);
        }

      } catch (error) {
        logger.error(`Limitless: Error processing content node for entry ${entryId}: ${error.message}`, { node });
        // Decide if this error should increment the main errorCount or be handled differently
      }
    }
  }
}

module.exports = LimitlessConnector;
