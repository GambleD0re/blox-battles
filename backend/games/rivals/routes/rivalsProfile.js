// backend/games/rivals/routes/rivalsProfile.js
const express = require('express');
const { body } = require('express-validator');
const fetch = require('node-fetch');
const db = require('../../../database/database');
const { authenticateToken, handleValidationErrors, checkFeatureFlag } = require('../../../middleware/auth');

const router = express.Router();
const RIVALS_GAME_ID = 'rivals';

const generateUniquePhrase = () => {
    const words = ['Lion', 'Tiger', 'Bear', 'Eagle', 'River', 'Mountain', 'Forest', 'Crimson', 'Indigo', 'Amber', 'Anchor', 'Compass', 'Dream', 'Echo', 'Comet', 'Nebula', 'Soaring', 'Leaping', 'Arcane', 'Ancient'];
    return [...Array(12)].map(() => words[Math.floor(Math.random() * words.length)]).join(" ");
};

router.get('/', authenticateToken, async (req, res) => {
    try {
        const { rows: [profile] } = await db.query('SELECT * FROM user_game_profiles WHERE user_id = $1 AND game_id = $2', [req.user.userId, RIVALS_GAME_ID]);
        if (!profile) {
            const newPhrase = generateUniquePhrase();
            const { rows: [newProfile] } = await db.query(
                'INSERT INTO user_game_profiles (user_id, game_id, verification_phrase) VALUES ($1, $2, $3) RETURNING *',
                [req.user.userId, RIVALS_GAME_ID, newPhrase]
            );
            return res.status(200).json(newProfile);
        }
        res.status(200).json(profile);
    } catch (err) {
        console.error("Get Rivals Profile Error:", err.message);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
});

router.put('/challenge-preference', authenticateToken,
    body('enabled').isBoolean().withMessage('A boolean value for "enabled" is required.'),
    handleValidationErrors,
    async (req, res) => {
        const { enabled } = req.body;
        try {
            await db.query('UPDATE user_game_profiles SET accepting_challenges = $1 WHERE user_id = $2 AND game_id = $3', [enabled, req.user.userId, RIVALS_GAME_ID]);
            res.status(200).json({ message: 'Rivals challenge preferences updated successfully.' });
        } catch (err) {
            console.error("Update Rivals Challenge Preference Error:", err.message);
            res.status(500).json({ message: 'An internal server error occurred.' });
        }
    }
);

router.post('/link',
    authenticateToken,
    checkFeatureFlag('linking_rivals'),
    body('robloxUsername').trim().escape().notEmpty().withMessage('Roblox username is required.'),
    handleValidationErrors,
    async (req, res) => {
        const { robloxUsername } = req.body;
        const userId = req.user.userId;
        try {
            const { rows: [profile] } = await db.query('SELECT verification_phrase FROM user_game_profiles WHERE user_id = $1 AND game_id = $2', [userId, RIVALS_GAME_ID]);
            if (!profile || !profile.verification_phrase) {
                return res.status(400).json({ message: 'No verification phrase found. Please refresh.' });
            }

            const usersApiUrl = 'https://users.roblox.com/v1/usernames/users';
            const usersResponse = await fetch(usersApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernames: [robloxUsername], excludeBannedUsers: true }) });
            if (!usersResponse.ok) throw new Error('Roblox API is currently unavailable.');
            const usersData = await usersResponse.json();
            if (!usersData.data || usersData.data.length === 0) {
                return res.status(404).json({ message: `Roblox user "${robloxUsername}" not found.` });
            }
            
            const robloxId = usersData.data[0].id.toString();
            const infoApiUrl = `https://users.roblox.com/v1/users/${robloxId}`;
            const infoResponse = await fetch(infoApiUrl);
            const infoData = await infoResponse.json();

            if (infoData.description && infoData.description.includes(profile.verification_phrase)) {
                await db.query('UPDATE user_game_profiles SET linked_game_id = $1, linked_game_username = $2, verification_phrase = NULL WHERE user_id = $3 AND game_id = $4', [robloxId, robloxUsername, userId, RIVALS_GAME_ID]);
                res.status(200).json({ message: 'Roblox account linked successfully!' });
            } else {
                res.status(400).json({ message: 'Verification failed. The phrase was not found in your Roblox bio.' });
            }
        } catch (error) {
            console.error("Rivals link error:", error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        }
    }
);

router.post('/unlink', authenticateToken, async (req, res) => {
    try {
        const newPhrase = generateUniquePhrase();
        await db.query('UPDATE user_game_profiles SET linked_game_id = NULL, linked_game_username = NULL, verification_phrase = $1 WHERE user_id = $2 AND game_id = $3', [newPhrase, req.user.userId, RIVALS_GAME_ID]);
        res.status(200).json({ message: 'Rivals account unlinked successfully.' });
    } catch(err) {
        console.error("Unlink Rivals Error:", err.message);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
});

module.exports = router;
