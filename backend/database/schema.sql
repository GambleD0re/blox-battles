-- backend/database/schema.sql
-- This script defines the PostgreSQL-compatible structure of the database.

-- Drop tables if they exist to ensure a clean slate. The CASCADE keyword will also drop dependent objects.
DROP TABLE IF EXISTS users, games, user_game_profiles, duels, tasks, game_servers, disputes, gem_purchases, transaction_history, payout_requests, crypto_deposits, inbox_messages, tournaments, tournament_participants, tournament_matches, system_status, tickets, ticket_messages, ticket_transcripts, reaction_roles, random_queue_entries CASCADE;

-- Table to manage the on/off status of site features.
CREATE TABLE system_status (
    feature_name VARCHAR(50) PRIMARY KEY,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    disabled_message TEXT
);

-- Table to define the games available on the platform.
CREATE TABLE games (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Create the 'users' table with the new is_username_set flag.
CREATE TABLE users (
    user_index SERIAL PRIMARY KEY,
    id UUID NOT NULL UNIQUE,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT,
    google_id VARCHAR(255) UNIQUE,
    discord_id VARCHAR(255) UNIQUE,
    discord_username VARCHAR(255),
    gems BIGINT DEFAULT 0,
    is_admin BOOLEAN DEFAULT FALSE,
    avatar_url TEXT,
    is_username_set BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    password_last_updated TIMESTAMP WITH TIME ZONE,
    discord_notifications_enabled BOOLEAN DEFAULT TRUE,
    accepting_challenges BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'banned', 'terminated')),
    ban_applied_at TIMESTAMP WITH TIME ZONE,
    ban_expires_at TIMESTAMP WITH TIME ZONE,
    ban_reason TEXT,
    crypto_deposit_address VARCHAR(255) UNIQUE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token TEXT,
    password_reset_token TEXT,
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    last_queue_leave_at TIMESTAMP WITH TIME ZONE
);

-- Table linking users to games and storing their game-specific profiles and stats.
CREATE TABLE user_game_profiles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id VARCHAR(50) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    linked_game_username VARCHAR(255),
    linked_game_id VARCHAR(255),
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    avatar_url TEXT,
    verification_phrase TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, game_id),
    UNIQUE (game_id, linked_game_username),
    UNIQUE (game_id, linked_game_id)
);

-- Use NUMERIC for financial values and JSONB for JSON data.
CREATE TABLE crypto_deposits (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tx_hash VARCHAR(255) NOT NULL,
    network VARCHAR(20) NOT NULL CHECK(network IN ('polygon', 'ethereum')),
    token_type VARCHAR(10) NOT NULL CHECK(token_type IN ('USDC', 'USDT', 'POL', 'ETH', 'PYUSD')),
    amount_crypto NUMERIC(20, 8) NOT NULL,
    gem_amount BIGINT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'credited', 'failed')),
    block_number BIGINT,
    required_confirmations INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    credited_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(tx_hash, network)
);

CREATE TABLE gem_purchases (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    stripe_session_id VARCHAR(255) NOT NULL UNIQUE,
    gem_amount BIGINT NOT NULL,
    amount_paid INTEGER NOT NULL, -- In cents
    currency VARCHAR(10) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transaction_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id VARCHAR(50) REFERENCES games(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL CHECK(type IN ('deposit_stripe', 'deposit_crypto', 'withdrawal', 'duel_wager', 'duel_win', 'admin_adjustment', 'tournament_buy_in', 'tournament_prize', 'server_crash_refund')),
    amount_gems BIGINT NOT NULL,
    description TEXT,
    reference_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payout_requests (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL CHECK(type IN ('crypto')),
    provider VARCHAR(50) NOT NULL CHECK(provider IN ('direct_node')),
    provider_payout_id VARCHAR(255),
    amount_gems BIGINT NOT NULL,
    amount_usd NUMERIC NOT NULL,
    fee_usd NUMERIC NOT NULL,
    destination_address VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'awaiting_approval' CHECK(status IN ('awaiting_approval', 'approved', 'declined', 'processing', 'completed', 'failed', 'canceled_by_user')),
    decline_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inbox_messages (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id VARCHAR(50) REFERENCES games(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    reference_id TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE duels (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(50) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    challenger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opponent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wager BIGINT NOT NULL,
    pot BIGINT DEFAULT 0,
    tax_collected BIGINT DEFAULT 0,
    game_specific_rules JSONB,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'started', 'in_progress', 'completed_unseen', 'under_review', 'completed', 'canceled', 'declined', 'cheater_forfeit')),
    winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    challenger_seen_result BOOLEAN DEFAULT FALSE,
    opponent_seen_result BOOLEAN DEFAULT FALSE,
    server_invite_link TEXT,
    assigned_server_id VARCHAR(255),
    expiration_offset_seconds INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    result_posted_at TIMESTAMP WITH TIME ZONE,
    transcript JSONB
);

CREATE TABLE random_queue_entries (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    game_id VARCHAR(50) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    region TEXT NOT NULL,
    wager BIGINT NOT NULL,
    game_specific_preferences JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE disputes (
    id SERIAL PRIMARY KEY,
    duel_id INTEGER NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    has_video_evidence BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'awaiting_user_discord_link', 'discord_ticket_created')),
    resolution TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    admin_resolver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    discord_forwarded_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK(type IN ('support', 'temp_ban_appeal', 'perm_ban_appeal', 'duel_dispute')),
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'awaiting_user_reply', 'resolved', 'closed')),
    subject TEXT NOT NULL,
    reference_id TEXT,
    discord_channel_id VARCHAR(255) UNIQUE,
    resolved_by_admin_username TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE ticket_messages (
    id SERIAL PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ticket_transcripts (
    id SERIAL PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    transcript_content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tournaments (
    id UUID PRIMARY KEY,
    game_id VARCHAR(50) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    region TEXT NOT NULL,
    buy_in_amount BIGINT NOT NULL,
    prize_pool_gems BIGINT NOT NULL,
    prize_distribution JSONB NOT NULL,
    rules JSONB NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 40,
    registration_opens_at TIMESTAMP WITH TIME ZONE NOT NULL,
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'registration_open', 'active', 'completed', 'dispute_period', 'finalized', 'canceled')),
    assigned_bot_id VARCHAR(255) NOT NULL,
    private_server_link TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tournament_participants (
    id SERIAL PRIMARY KEY,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    placement INTEGER,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tournament_id, user_id)
);

CREATE TABLE tournament_matches (
    id SERIAL PRIMARY KEY,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    duel_id INTEGER REFERENCES duels(id) ON DELETE SET NULL,
    round_number INTEGER NOT NULL,
    match_in_round INTEGER NOT NULL,
    player1_id UUID REFERENCES users(id) ON DELETE CASCADE,
    player2_id UUID REFERENCES users(id) ON DELETE CASCADE,
    winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'completed'))
);

CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    task_type VARCHAR(255) NOT NULL,
    payload JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE game_servers (
    server_id VARCHAR(255) PRIMARY KEY,
    game_id VARCHAR(50) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    region VARCHAR(50) NOT NULL,
    join_link TEXT NOT NULL,
    player_count INTEGER NOT NULL DEFAULT 0,
    last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE reaction_roles (
    message_id VARCHAR(255) NOT NULL,
    emoji_id VARCHAR(255) NOT NULL,
    role_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (message_id, emoji_id)
);

INSERT INTO system_status (feature_name, is_enabled, disabled_message) VALUES
('site_wide_maintenance', TRUE, 'The platform is currently down for scheduled maintenance. Please check back later.'),
('user_registration', TRUE, 'New user registrations are temporarily disabled.'),
('deposits', TRUE, 'All deposit methods are temporarily offline.'),
('withdrawals', TRUE, 'Withdrawals are temporarily unavailable.');

INSERT INTO games (id, name, description, icon_url, is_active) VALUES
('rivals', 'Roblox Rivals', 'The classic 1v1 dueling experience.', '/game-icons/rivals.png', TRUE);
