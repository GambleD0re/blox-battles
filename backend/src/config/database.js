// /backend/src/config/database.js

import pg from 'pg';
import config from './environment.js';
import logger from '../utils/logger.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.isProduction ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  logger.info('Successfully connected to the PostgreSQL database pool.');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

// A simple query function to test the connection on startup or for simple queries.
// Repositories will typically use the pool directly to manage transactions.
export const query = (text, params) => pool.query(text, params);

export default pool;
