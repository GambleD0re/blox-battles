// /backend/src/config/environment.js

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const requiredVariables = [
  'PORT',
  'SERVER_URL',
  'BACKEND_URL',
  'DATABASE_URL',
  'JWT_SECRET',
  'BOT_API_KEY'
];

for (const variable of requiredVariables) {
  if (!process.env[variable]) {
    throw new Error(`FATAL ERROR: Environment variable ${variable} is not defined.`);
  }
}

const config = {
  port: process.env.PORT,
  serverUrl: process.env.SERVER_URL,
  backendUrl: process.env.BACKEND_URL,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  botApiKey: process.env.BOT_API_KEY,
  isProduction: process.env.NODE_ENV === 'production',
};

export default Object.freeze(config);
