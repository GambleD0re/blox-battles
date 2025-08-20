// /backend/src/config/database.js
const { Pool } = require('pg');
const config = require('./index');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.env === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
});

pool.on('connect', () => {
  logger.info('A client has connected to the database pool.');
});

pool.on('error', (err, client) => {
  logger.error({ err, client }, 'Unexpected error on idle PostgreSQL client');
  process.exit(-1);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
