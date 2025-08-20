// /backend/src/config/index.js
const dotenv = require('dotenv');
const path = require('path');
const logger = require('../utils/logger');

// Load the appropriate .env file based on the NODE_ENV
const envPath = process.env.NODE_ENV === 'production'
  ? path.resolve(__dirname, '../../.env.production')
  : path.resolve(__dirname, '../../.env');

dotenv.config({ path: envPath });

const requiredVars = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'SERVER_URL',
  'BACKEND_URL',
  'JWT_SECRET',
  'BOT_API_KEY'
];

// Validate that all required environment variables are present
for (const v of requiredVars) {
  if (!process.env[v]) {
    logger.fatal(`FATAL ERROR: Missing required environment variable: ${v}`);
    process.exit(1);
  }
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3001,
  databaseUrl: process.env.DATABASE_URL,
  frontendUrl: process.env.SERVER_URL,
  backendUrl: process.env.BACKEND_URL,
  brand: {
    fullName: process.env.BRAND_NAME_FULL || 'CyberDome E-Wagers',
    shortName: process.env.BRAND_NAME_SHORT || 'The CyberDome',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  apiKeys: {
    bot: process.env.BOT_API_KEY,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  alchemy: {
    apiKey: process.env.ALCHEMY_API_KEY,
    polygonUrl: process.env.ALCHEMY_POLYGON_URL,
    ethereumUrl: process.env.ALCHEMY_ETHEREUM_URL,
  },
  wallet: {
    masterXpub: process.env.MASTER_XPUB,
    payoutPrivateKey: process.env.PAYOUT_WALLET_PRIVATE_KEY,
  },
  email: {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    from: process.env.EMAIL_FROM,
  },
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN,
    guildId: process.env.DISCORD_GUILD_ID,
    adminRoleId: process.env.DISCORD_ADMIN_ROLE_ID,
    masterAdminRoleId: process.env.DISCORD_MASTER_ADMIN_ROLE_ID,
  }
};

// Freeze the config object to prevent accidental mutations during runtime
module.exports = Object.freeze(config);
