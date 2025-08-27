// backend/server.js
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
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initializeWebSocket } = require('./webSocketManager');
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

app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { userId, gemAmount } = session.metadata;
        const sessionId = session.id;
        const client = await db.getPool().connect();
        try {
            await client.query('BEGIN');
            const { rowCount } = await client.query("SELECT id FROM deposits WHERE provider = 'stripe' AND provider_transaction_id = $1", [sessionId]);
            if (rowCount > 0) {
                await client.query('ROLLBACK');
                return res.status(200).json({ received: true, message: 'Duplicate event.' });
            }
            await client.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [parseInt(gemAmount, 10), userId]);
            await client.query('INSERT INTO deposits (user_id, provider, provider_transaction_id, gem_amount, amount_paid, currency, status) VALUES ($1, $2, $3, $4, $5, $6, $7)', [userId, 'stripe', sessionId, parseInt(gemAmount, 10), session.amount_total, session.currency, 'completed']);
            await client.query('COMMIT');
        } catch (dbError) {
            await client.query('ROLLBACK');
            return res.status(500).json({ error: 'Database processing failed.' });
        } finally {
            client.release();
        }
    }
    res.status(200).json({ received: true });
});

app.post('/api/payments/xsolla-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    console.log('[Xsolla Webhook] Received a request.');
    try {
        const event = JSON.parse(req.body);

        if (event.type === 'payment_successful' && event.provider === 'paynearme') {
            const { transactionId } = event.payload;
            console.log(`[Xsolla Webhook] Processing successful payment for PayNearMe transaction: ${transactionId}`);
            const client = await db.getPool().connect();
            try {
                await client.query('BEGIN');
                const { rows: [deposit] } = await client.query("SELECT * FROM deposits WHERE provider_transaction_id = $1 AND provider = 'paynearme' AND status = 'pending' FOR UPDATE", [transactionId]);
                if (!deposit) {
                    await client.query('ROLLBACK');
                    console.warn(`[Xsolla Webhook] Received webhook for unknown or already processed transaction: ${transactionId}`);
                    return res.status(200).json({ message: 'Transaction already processed or not found.' });
                }
                await client.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [deposit.gem_amount, deposit.user_id]);
                await client.query("UPDATE deposits SET status = 'completed' WHERE id = $1", [deposit.id]);
                await client.query(`INSERT INTO transaction_history (user_id, type, amount_gems, description, reference_id) VALUES ($1, 'deposit_paysafecard', $2, 'Deposit via PayNearMe', $3)`, [deposit.user_id, deposit.gem_amount, transactionId]);
                await client.query('COMMIT');
                console.log(`[Xsolla Webhook] Successfully credited ${deposit.gem_amount} gems to user ${deposit.user_id}`);
            } catch (dbError) {
                await client.query('ROLLBACK');
                console.error(`[Xsolla Webhook] Database processing failed for transaction ${transactionId}:`, dbError);
                return res.status(500).json({ error: 'Database processing failed.' });
            } finally {
                client.release();
            }
        }
        res.status(200).json({ received: true });
    } catch (err) {
        console.error('[Xsolla Webhook] Error parsing webhook:', err);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
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
