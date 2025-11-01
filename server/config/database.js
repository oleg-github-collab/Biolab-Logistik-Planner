/**
 * PostgreSQL Database Configuration
 * Production-grade connection pooling and error handling
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');

// Database configuration
const config = {
  // PostgreSQL connection from environment or Railway
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,

  // Connection pool settings
  max: 20, // Maximum number of clients in pool
  idleTimeoutMillis: 30000, // Close idle clients after 30s
  connectionTimeoutMillis: 10000, // Return error after 10s if can't connect

  // SSL for production (Railway requires this)
  // Only use SSL if we have a DATABASE_URL (production) AND it's not localhost
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? {
    rejectUnauthorized: false
  } : false
};

// Fallback to local PostgreSQL if no connection string
if (!config.connectionString) {
  config.host = process.env.DB_HOST || 'localhost';
  config.port = process.env.DB_PORT || 5432;
  config.database = process.env.DB_NAME || 'biolab_logistik';
  config.user = process.env.DB_USER || 'postgres';
  config.password = process.env.DB_PASSWORD || 'postgres';
}

// Create connection pool
const pool = new Pool(config);

// Pool error handling
pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle PostgreSQL client', err);
});

pool.on('connect', (client) => {
  logger.info('New PostgreSQL client connected');
});

pool.on('remove', (client) => {
  logger.info('PostgreSQL client removed from pool');
});

// Test connection on startup (non-blocking, non-fatal)
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    logger.error('❌ Failed to connect to PostgreSQL on startup', {
      error: err.message,
      code: err.code
    });
    logger.warn('Database connection failed - will retry on first query');
    logger.warn('Make sure DATABASE_URL is set correctly in production');

    // Don't exit - let the app start and retry connections
    // This allows Railway health checks to pass while DB initializes
  } else {
    logger.info('✅ PostgreSQL connected successfully', {
      time: res.rows[0].now,
      database: config.database || 'Railway PostgreSQL'
    });
  }
});

/**
 * Execute query with automatic connection handling
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    logger.database('Query executed', {
      text: text.substring(0, 100),
      duration,
      rows: res.rowCount
    });

    return res;
  } catch (error) {
    logger.error('Database query error', {
      text: text.substring(0, 100),
      error: error.message
    });
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 */
const getClient = async () => {
  const client = await pool.connect();

  // Add query method with logging
  const originalQuery = client.query;
  client.query = (...args) => {
    logger.database('Transaction query', {
      text: args[0].substring(0, 100)
    });
    return originalQuery.apply(client, args);
  };

  // Add release with logging
  const originalRelease = client.release;
  client.release = () => {
    logger.database('Client released');
    return originalRelease.call(client);
  };

  return client;
};

/**
 * Execute function within a transaction
 */
const transaction = async (callback) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    logger.info('Transaction committed successfully');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Graceful shutdown
 */
const shutdown = async () => {
  logger.info('Closing PostgreSQL pool...');
  await pool.end();
  logger.info('PostgreSQL pool closed');
};

module.exports = {
  pool,
  query,
  getClient,
  transaction,
  shutdown
};
