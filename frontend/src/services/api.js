// frontend/src/services/api.js
const API_BASE_URL = '/api';

const apiRequest = async (endpoint, method = 'GET', body = null, token = null) => {
    const options = {
        method,
        headers: {},
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const text = await response.text();
        const data = text ? JSON.parse(text) : {};
        if (!response.ok) {
            const error = new Error(data.message || `Error: ${response.status}`);
            error.response = { status: response.status, data: data };
            throw error;
        }
        return data;
    } catch (error) {
        console.error(`[API Error] ${method} ${endpoint}:`, error.message);
        throw error;
    }
};

// --- Core Routes ---
export const getAppConfig = () => apiRequest('/config');
export const getFeatureStatus = () => apiRequest('/status/features');
export const getGames = (token) => apiRequest('/games', 'GET', null, token);

// --- Auth Routes ---
export const loginUser = (credentials) => apiRequest('/auth/login', 'POST', credentials);
export const registerUser = (userData) => apiRequest('/auth/register', 'POST', userData);
export const verifyEmail = (token) => apiRequest('/auth/verify-email', 'POST', { token });
export const resendVerificationEmail = (email) => apiRequest('/auth/resend-verification', 'POST', { email });
export const forgotPassword = (email) => apiRequest('/auth/forgot-password', 'POST', { email });
export const resetPassword = (token, password) => apiRequest('/auth/reset-password', 'POST', { token, password });

// --- Core User Routes ---
export const getCoreUserData = (token) => apiRequest('/user-data', 'GET', null, token);
export const setUsername = (username, token) => apiRequest('/user/set-username', 'POST', { username }, token);
export const updatePassword = (passwordData, token) => apiRequest('/user/password', 'PUT', passwordData, token);
export const unlinkDiscord = (token) => apiRequest('/user/unlink/discord', 'POST', null, token);
export const deleteAccount = (password, token) => apiRequest('/user/delete/account', 'DELETE', { password }, token);
export const updateDiscordNotificationPreference = (enabled, token) => apiRequest('/user/notification-preference', 'PUT', { enabled }, token);
export const updateChallengePreference = (enabled, token) => apiRequest('/user/challenge-preference', 'PUT', { enabled }, token);

// --- Core Payment & History Routes ---
export const getInbox = (token) => apiRequest('/inbox', 'GET', null, token);
export const getTransactionHistory = (token) => apiRequest('/history', 'GET', null, token);
export const createCheckoutSession = (amount, token) => apiRequest('/payments/create-checkout-session', 'POST', { amount }, token);
export const getCryptoDepositAddress = (token) => apiRequest('/payments/crypto-address', 'GET', null, token);
export const getCryptoQuote = (amount, network, tokenType, token) => apiRequest('/payments/crypto-quote', 'POST', { amount, network, tokenType }, token);
export const requestCryptoWithdrawal = (gemAmount, recipientAddress, tokenType, token) => apiRequest('/payouts/request-crypto', 'POST', { gemAmount, recipientAddress, tokenType }, token);
export const cancelWithdrawalRequest = (requestId, token) => apiRequest(`/payouts/cancel-request/${requestId}`, 'POST', null, token);

// --- Rivals Game Routes ---
const RIVALS_PREFIX = '/games/rivals';
export const getRivalsGameProfile = (token) => apiRequest(`${RIVALS_PREFIX}/profile`, 'GET', null, token);
export const verifyRivalsAccount = (robloxUsername, token) => apiRequest(`${RIVALS_PREFIX}/profile/link`, 'POST', { robloxUsername }, token);
export const unlinkRivalsAccount = (token) => apiRequest(`${RIVALS_PREFIX}/profile/unlink`, 'POST', null, token);
export const getRivalsGameData = (token) => apiRequest(`${RIVALS_PREFIX}/gamedata`, 'GET', null, token);
export const findRivalsPlayer = (robloxUsername, token) => apiRequest(`${RIVALS_PREFIX}/duels/find-player?roblox_username=${encodeURIComponent(robloxUsername)}`, 'GET', null, token);
export const sendRivalsChallenge = (challengeData, token) => apiRequest(`${RIVALS_PREFIX}/duels/challenge`, 'POST', challengeData, token);
export const respondToRivalsDuel = (responseData, token) => apiRequest(`${RIVALS_PREFIX}/duels/respond`, 'POST', responseData, token);
export const cancelRivalsDuel = (duelId, token) => apiRequest(`${RIVALS_PREFIX}/duels/cancel/${duelId}`, 'DELETE', null, token);
export const startRivalsDuel = (duelId, token) => apiRequest(`${RIVALS_PREFIX}/duels/${duelId}/start`, 'POST', null, token);
export const forfeitRivalsDuel = (duelId, token) => apiRequest(`${RIVALS_PREFIX}/duels/${duelId}/forfeit`, 'POST', null, token);
export const getRivalsUnseenResults = (token) => apiRequest(`${RIVALS_PREFIX}/duels/unseen-results`, 'GET', null, token);
export const confirmRivalsDuelResult = (duelId, token) => apiRequest(`${RIVALS_PREFIX}/duels/${duelId}/confirm-result`, 'POST', null, token);
export const getQueueStatus = (token) => apiRequest(`${RIVALS_PREFIX}/queue/status`, 'GET', null, token);
export const joinQueue = (queueData, token) => apiRequest(`${RIVALS_PREFIX}/queue/join`, 'POST', queueData, token);
export const leaveQueue = (token) => apiRequest(`${RIVALS_PREFIX}/queue/leave`, 'POST', null, token);

// --- Generic/Shared Routes ---
export const getDuelHistory = (token) => apiRequest('/duel-history', 'GET', null, token);
export const createSupportTicket = (ticketData, token) => apiRequest('/tickets', 'POST', ticketData, token);
export const respondToDiscordLink = (messageId, response, token) => apiRequest('/discord/respond-link', 'POST', { messageId, response }, token);
export const getTranscript = (duelId, token) => apiRequest(`/transcripts/${duelId}`, 'GET', null, token);

// --- Admin Routes ---
export const getAdminStats = (token) => apiRequest('/admin/stats', 'GET', null, token);
export const getAdminUsers = (searchQuery, status, token) => {
    const params = new URLSearchParams({ search: searchQuery, status });
    return apiRequest(`/admin/users?${params.toString()}`, 'GET', null, token);
};
export const updateUserGems = (userId, amount, token) => apiRequest(`/admin/users/${userId}/gems`, 'POST', { amount }, token);
export const banUser = (userId, reason, duration_hours, token) => apiRequest(`/admin/users/${userId}/ban`, 'POST', { reason, duration_hours }, token);
export const unbanUser = (userId, token) => apiRequest(`/admin/users/${userId}/ban`, 'DELETE', null, token);
export const deleteUserAccount = (userId, token) => apiRequest(`/admin/users/${userId}`, 'DELETE', null, token);
export const getAdminPayoutRequests = (token) => apiRequest('/admin/payout-requests', 'GET', null, token);
export const approvePayoutRequest = (requestId, token) => apiRequest(`/payouts/requests/${requestId}/approve`, 'POST', null, token);
export const declinePayoutRequest = (requestId, reason, token) => apiRequest(`/payouts/requests/${requestId}/decline`, 'POST', { reason }, token);
export const getSystemStatus = (token) => apiRequest('/admin/system-status', 'GET', null, token);
export const updateSystemStatus = (statusData, token) => apiRequest('/admin/system-status', 'PUT', statusData, token);
export const createRivalsTournament = (tournamentData, token) => apiRequest('/admin/games/rivals/tournaments', 'POST', tournamentData, token);
