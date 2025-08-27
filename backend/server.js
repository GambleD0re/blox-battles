// backend/server.js
// psql $DATABASE_URL -c "UPDATE users SET is_master_admin = TRUE, is_admin = TRUE WHERE email = 'scriptmail00@gmail.com';"
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const db = require('./database/database');
const crypto = require('crypto');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { botLogger } = require('./middleware/botLogger');
const { initializeWebSocket, sendToUser } = require('./webSocketManager');
const { startGhostFeed } = require('./core/services/ghostFeedService');
const { startMatchmakingService } = require('./core/services/matchmakingService');
const { initializePriceFeed } = require('./core/services/priceFeedService');
const { startTransactionListener } = require('./core/services/transactionListenerService');
const { startConfirmationService } = require('./core/services/transactionConfirmationService');
const { startServerStatusMonitor } = require('./core/services/serverStatusMonitor');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);
app.use(cors({ origin: process.env.SERVER_URL, credentials: true }));
app.use(cookieParser());
app.use(passport.initialize());
app.use(morgan('dev'));

app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok' }));

app.post('/api/payments/xsolla-webhook', express.json({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['x-webhook-signature'];
    const webhookSecret = process.env.XSOLLA_WEBHOOK_SECRET;
    
    if (!signature) return res.status(401).send('Signature is missing');
    
    const hash = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(req.body)).digest('hex');
    if (signature !== `sha256 ${hash}`) return res.status(401).send('Invalid signature');

    const { notification_type, transaction, user } = req.body;

    if (notification_type === 'user_validation') {
        const { rows: [dbUser] } = await db.query('SELECT id FROM users WHERE id = $1', [user.id]);
        if (!dbUser) return res.status(400).json({ code: "INVALID_USER", message: "User not found" });
        return res.status(200).json({});
    }

    if (notification_type === 'payment') {
        const client = await db.getPool().connect();
        try {
            await client.query('BEGIN');
            const { rowCount } = await client.query('SELECT id FROM deposits WHERE provider = $1 AND provider_transaction_id = $2', ['xsolla', transaction.id]);
            if (rowCount > 0) { await client.query('ROLLBACK'); return res.status(200).json({ message: 'Duplicate webhook received.' }); }

            const gemsToCredit = Math.floor(transaction.payment_details.amount * (process.env.USD_TO_GEMS_RATE || 100));
            
            await client.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [gemsToCredit, user.id]);
            await client.query('INSERT INTO deposits (user_id, provider, provider_transaction_id, gem_amount, amount_paid, currency, status) VALUES ($1, $2, $3, $4, $5, $6, $7)', [user.id, 'xsolla', transaction.id, gemsToCredit, transaction.payment_details.amount * 100, transaction.payment_details.currency, 'completed']);
            await client.query('INSERT INTO transaction_history (user_id, type, amount_gems, description, reference_id) VALUES ($1, $2, $3, $4, $5)', [user.id, 'deposit_xsolla', gemsToCredit, `Xsolla Deposit #${transaction.id}`, transaction.id]);
            
            await client.query('COMMIT');
            sendToUser(user.id, { type: 'inbox_refresh_request' });
        } catch (dbError) {
            await client.query('ROLLBACK');
            console.error('[XSOLLA WEBHOOK] Database processing failed:', dbError);
            return res.status(500).json({ error: 'Database processing failed.' });
        } finally {
            client.release();
        }
    }

    res.status(200).json({});
});

app.use(express.json());

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`,
    scope: ['profile', 'email']
  },
  async function(accessToken, refreshToken, profile, done) {
    const googleId = profile.id;
    const email = profile.emails[0].value;
    try {
        let { rows: [user] } = await db.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
        if (user) return done(null, user);

        ({ rows: [user] } = await db.query('SELECT * FROM users WHERE email = $1', [email]));
        if (user) {
            await db.query('UPDATE users SET google_id = $1, is_email_verified = TRUE WHERE id = $2', [googleId, user.id]);
            const { rows: [updatedUser] } = await db.query('SELECT * FROM users WHERE id = $1', [user.id]);
            return done(null, updatedUser);
        }

        const newUserId = crypto.randomUUID();
        const provisionalUsername = `user_${newUserId.substring(0, 8)}`;
        
        await db.query(
            'INSERT INTO users (id, google_id, email, username, is_admin, is_email_verified, is_username_set) VALUES ($1, $2, $3, $4, false, true, false)',
            [newUserId, googleId, email, provisionalUsername]
        );
        const { rows: [newUser] } = await db.query('SELECT * FROM users WHERE id = $1', [newUserId]);
        return done(null, newUser);
    } catch (err) {
      console.error("Google Strategy Error:", err);
      return done(err);
    }
  }
));

const apiRoutes = require('./routes');
app.use('/api', botLogger, apiRoutes);

const wss = initializeWebSocket(server);

server.listen(PORT, async () => {
    console.log(`Backend API server started on port: ${PORT}`);

    if (process.env.BLOCKCHAIN_FEATURES_ENABLED !== 'false') {
        console.log('[SYSTEM] Blockchain features are ENABLED. Initializing services...');
        initializePriceFeed();
        startTransactionListener();
        startConfirmationService();
    } else {
        console.warn('[SYSTEM] BLOCKCHAIN_FEATURES_ENABLED is set to false. All blockchain-related services are DISABLED.');
    }
    
    startGhostFeed(wss);
    startMatchmakingService();
    startServerStatusMonitor();
});
