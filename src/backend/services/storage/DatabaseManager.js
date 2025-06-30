const { Pool } = require('pg');
const config = require('./ConfigManager');
const logger = require('../../utils/logger');

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.dbConfig = config.get('database');
    this._connect();
  }

  _connect() {
    if (!this.dbConfig || !this.dbConfig.host) {
      logger.error('Database configuration is missing or incomplete. Cannot establish connection.');
      // Optionally, you could throw an error here to halt startup if DB is critical
      // throw new Error('Database configuration is missing or incomplete.');
      return;
    }

    // Construct connection string if DATABASE_URL is not directly provided
    // Useful if individual params are given but not a full URL string.
    // Docker-compose provides DATABASE_URL directly via environment variables.
    const connectionString = process.env.DATABASE_URL || this.dbConfig.connectionString ||
      `postgresql://${this.dbConfig.username}:${this.dbConfig.password}@${this.dbConfig.host}:${this.dbConfig.port}/${this.dbConfig.database}`;

    this.pool = new Pool({
      connectionString: connectionString,
      ssl: this.dbConfig.ssl ? { rejectUnauthorized: false } : false, // Basic SSL config
      // Other pool options can be configured here:
      // max: 20, // max number of clients in the pool
      // idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
      // connectionTimeoutMillis: 2000, // how long to wait for a connection from the pool
    });

    this.pool.on('connect', client => {
      logger.info(`New client connected to PostgreSQL database: ${this.dbConfig.database} on ${this.dbConfig.host}`);
      // You can set properties on the client after connection
      // client.query('SET DATESTYLE = iso, mdy');
    });

    this.pool.on('error', (err, client) => {
      logger.error('Unexpected error on idle PostgreSQL client', {
        error: err.message,
        stack: err.stack,
        // clientInfo: client // Be careful logging client objects, might be verbose
      });
      // process.exit(-1); // Optionally exit if critical
    });

    // Test the connection
    this.query('SELECT NOW()')
      .then(res => logger.info('PostgreSQL Database connected successfully. Server time: ' + res.rows[0].now))
      .catch(err => {
        logger.error('Failed to connect to PostgreSQL database.', {
          error: err.message,
          stack: err.stack,
          dbConfigHost: this.dbConfig.host, // Log some config to help debug
          dbConfigDb: this.dbConfig.database,
        });
        // Optionally, re-throw or handle to prevent app from starting if DB is critical
        // throw err;
      });
  }

  async query(text, params) {
    if (!this.pool) {
      logger.error('Database pool is not initialized. Query cannot be executed.');
      throw new Error('Database pool not initialized.');
    }
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Executed query', { text, duration: `${duration}ms`, rowCount: res.rowCount });
      return res;
    } catch (error) {
      logger.error('Error executing query', {
        text,
        // params, // Be careful logging params if they contain sensitive data
        error: error.message,
        pgCode: error.code, // PostgreSQL error code
        // stack: error.stack // Can be very verbose
      });
      throw error; // Re-throw the error so the caller can handle it
    }
  }

  async getClient() {
    if (!this.pool) {
      logger.error('Database pool is not initialized. Cannot get client.');
      throw new Error('Database pool not initialized.');
    }
    const client = await this.pool.connect();
    logger.debug('Database client acquired from pool.');
    // You might want to wrap the client's release method or add logging
    const originalRelease = client.release;
    client.release = (err) => {
      logger.debug('Database client released back to pool.');
      return originalRelease.call(client, err);
    };
    return client;
  }

  // Graceful shutdown
  async close() {
    if (this.pool) {
      logger.info('Closing PostgreSQL database connection pool...');
      await this.pool.end();
      logger.info('PostgreSQL database connection pool closed.');
      this.pool = null;
    }
  }
}

// Singleton instance
const dbManagerInstance = new DatabaseManager();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down database manager...');
  await dbManagerInstance.close();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down database manager...');
  await dbManagerInstance.close();
  process.exit(0);
});

module.exports = dbManagerInstance;
