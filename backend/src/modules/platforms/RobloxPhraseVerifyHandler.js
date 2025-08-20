// /backend/src/modules/platforms/RobloxPhraseVerifyHandler.js
const BasePlatformHandler = require('./BasePlatformHandler');
const logger = require('../../utils/logger');

// A pool of words to generate unique, memorable phrases.
const PHRASE_WORDS = [
  'Crimson', 'Azure', 'Golden', 'Emerald', 'Violet', 'Cyber', 'Neon', 'Quantum',
  'Lion', 'Eagle', 'Wolf', 'Shark', 'Falcon', 'Tiger', 'Phoenix', 'Dragon',
  'Mountain', 'River', 'Ocean', 'Forest', 'Glacier', 'Volcano', 'Comet', 'Star',
  'Shield', 'Sword', 'Anchor', 'Compass', 'Nexus', 'Relic', 'Beacon', 'Spire'
];

class RobloxPhraseVerifyHandler extends BasePlatformHandler {
  /**
   * Generates a unique 6-word phrase for Roblox profile verification.
   * @override
   * @returns {Promise<{phrase: string}>}
   */
  async generateLinkData() {
    const shuffled = [...PHRASE_WORDS].sort(() => 0.5 - Math.random());
    const phrase = shuffled.slice(0, 6).join(' ');
    return { phrase };
  }

  /**
   * Verifies a Roblox account by checking for the phrase in their profile description.
   * @override
   * @param {{identity: string}} verificationData - Contains the Roblox username.
   * @param {{phrase: string}} linkData - The phrase that should be in the user's bio.
   * @returns {Promise<{game_username: string, game_user_id: string}>}
   */
  async verifyIdentity(verificationData, linkData) {
    const { identity: robloxUsername } = verificationData;
    const { phrase } = linkData;

    if (!robloxUsername || !phrase) {
      const error = new Error('Roblox username and verification phrase are required.');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    try {
      // Step 1: Get Roblox User ID from username
      const usersApiUrl = 'https://users.roblox.com/v1/usernames/users';
      const usersResponse = await fetch(usersApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ usernames: [robloxUsername], excludeBannedUsers: true }),
      });

      if (!usersResponse.ok) throw new Error(`Roblox API (usernames) failed with status: ${usersResponse.status}`);
      const usersData = await usersResponse.json();

      if (!usersData.data || usersData.data.length === 0) {
        const error = new Error(`Roblox user "${robloxUsername}" not found.`);
        error.statusCode = 404;
        error.code = 'ROBLOX_USER_NOT_FOUND';
        throw error;
      }
      const robloxId = usersData.data[0].id.toString();
      const verifiedUsername = usersData.data[0].name;

      // Step 2: Get user profile description using the ID
      const infoApiUrl = `https://users.roblox.com/v1/users/${robloxId}`;
      const infoResponse = await fetch(infoApiUrl);
      if (!infoResponse.ok) throw new Error(`Roblox API (user info) failed with status: ${infoResponse.status}`);
      const infoData = await infoResponse.json();

      // Step 3: Check for the phrase
      if (infoData.description && infoData.description.includes(phrase)) {
        logger.info(`Successfully verified Roblox user ${verifiedUsername} (ID: ${robloxId})`);
        return {
          game_username: verifiedUsername,
          game_user_id: robloxId,
        };
      } else {
        const error = new Error('Verification failed. The unique phrase was not found in the Roblox profile description.');
        error.statusCode = 400;
        error.code = 'VERIFICATION_PHRASE_NOT_FOUND';
        throw error;
      }
    } catch (error) {
      logger.error({ err: error, robloxUsername }, 'An error occurred during Roblox API verification.');
      // Re-throw to be caught by the service layer
      throw error;
    }
  }
}

module.exports = RobloxPhraseVerifyHandler;
