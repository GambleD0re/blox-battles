// backend/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const db = require('./database/database');
const crypto = require('crypto');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { botLogger } = require('./middleware/botLogger');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initializeWebSocket } = require('./webSocketManager');
const { startGhostFeed } = require('./services/ghostFeedService');
const { startMatchmakingService } = require('./services/matchmakingService');
const { initializePriceFeed } = require('./core/services/priceFeedService');
const { startTransactionListener } = require('./core/services/transactionListenerService');
const { startConfirmationService } = require('./core/services/transactionConfirmationService');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);
app.use(cors({ origin: process.env.SERVER_URL, credentials: true }));
app.use(cookieParser());
app.use(passport.initialize());
app.use(morgan('dev'));

app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Health check passed' });
});

app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error(`Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { userId, gemAmount } = session.metadata;
        const client = await db.getPool().connect();
        try {
            await client.query('BEGIN');
            await client.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [parseInt(gemAmount, 10), userId]);
            await client.query('INSERT INTO transaction_history (user_id, type, amount_gems, description) VALUES ($1, $2, $3, $4)', [userId, 'deposit_stripe', parseInt(gemAmount, 10), `${parseInt(gemAmount, 10)} Gems purchased via Card`]);
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
    const username = profile.displayName.replace(/\s+/g, '_').substring(0, 20);
    try {
        let { rows: [user] } = await db.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
        if (user) return done(null, user);

        ({ rows: [user] } = await db.query('SELECT * FROM users WHERE email = $1', [email]));
        if (user) {
            await db.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, user.id]);
            const { rows: [updatedUser] } = await db.query('SELECT * FROM users WHERE id = $1', [user.id]);
            return done(null, updatedUser);
        }

        const { rows: [existingUsername] } = await db.query('SELECT 1 FROM users WHERE username = $1', [username]);
        const finalUsername = existingUsername ? `${username}${crypto.randomInt(1000, 9999)}` : username;
        const newUserId = crypto.randomUUID();
        
        await db.query('INSERT INTO users (id, google_id, email, username, is_admin, is_email_verified) VALUES ($1, $2, $3, $4, false, true)', [newUserId, googleId, email, finalUsername]);
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
    
    await initializePriceFeed();
    startTransactionListener();
    startConfirmationService();
    startGhostFeed(wss);
    startMatchmakingService();
});
