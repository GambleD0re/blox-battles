// /backend/src/services/platform.service.js
const RobloxPhraseVerifyHandler = require('../modules/platforms/RobloxPhraseVerifyHandler');
const logger = require('../utils/logger');
// const GameRepository = require('../repositories/game.repository'); // To be used in future steps

// A map that connects the database handler key to the actual handler class.
const handlerMap = new Map([
  ['ROBLOX_PHRASE_VERIFY', RobloxPhraseVerifyHandler],
]);

class PlatformService {
  /**
   * Gets the appropriate handler class for a given platform.
   * @param {object} platform - The platform object from the database.
   * @returns {BasePlatformHandler} An instance of the correct handler.
   */
  static getHandler(platform) {
    const HandlerClass = handlerMap.get(platform.linking_handler);
    if (!HandlerClass) {
      logger.error({ handlerKey: platform.linking_handler }, 'No platform handler found for the given key.');
      const error = new Error('This platform does not support account linking or is misconfigured.');
      error.statusCode = 501;
      error.code = 'HANDLER_NOT_IMPLEMENTED';
      throw error;
    }
    return new HandlerClass();
  }

  /**
   * Initiates the account linking process for a user and a platform.
   * @param {string} userId - The CyberDome user's ID.
   * @param {number} platformId - The ID of the platform to link to.
   * @returns {Promise<object>} The data required by the frontend for the user to proceed.
   */
  static async initiateLinking(userId, platformId) {
    // Step 1: Fetch platform details from the database (logic will be added with repositories)
    // const platform = await GameRepository.findPlatformById(platformId);
    // For now, we mock the platform object based on our knowledge
    const mockPlatform = { id: 1, name: 'Roblox', linking_handler: 'ROBLOX_PHRASE_VERIFY' };

    // Step 2: Get the correct handler and generate link data
    const handler = this.getHandler(mockPlatform);
    const linkData = await handler.generateLinkData();

    // Step 3: Create a pending entry in the user_game_identities table (logic will be added with repositories)
    // await GameRepository.createPendingIdentity(userId, gameId, linkData);
    logger.info(`Generated link data for user ${userId} for platform ${mockPlatform.name}`);
    
    // Step 4: Return the data to the user
    return linkData;
  }

  /**
   * Confirms and finalizes the account linking process.
   * @param {string} userId - The CyberDome user's ID.
   * @param {number} platformId - The ID of the platform.
   * @param {object} verificationData - The data submitted by the user (e.g., { identity: 'robloxUsername' }).
   * @returns {Promise<object>} The newly verified game identity.
   */
  static async confirmLinking(userId, platformId, verificationData) {
    // Step 1: Fetch the pending identity and its linkData from the database (logic will be added)
    // const pendingIdentity = await GameRepository.findPendingIdentity(userId, platformId);
    // const linkData = { phrase: pendingIdentity.verification_phrase };
    
    // For now, we'll assume we have the linkData
    const mockLinkData = { phrase: "A temporary phrase for demonstration" };
    const mockPlatform = { id: 1, name: 'Roblox', linking_handler: 'ROBLOX_PHRASE_VERIFY' };

    // Step 2: Get handler and verify identity
    const handler = this.getHandler(mockPlatform);
    const verifiedDetails = await handler.verifyIdentity(verificationData, mockLinkData);

    // Step 3: Update the user_game_identities record to be verified and store details
    // const updatedIdentity = await GameRepository.verifyIdentity(pendingIdentity.id, verifiedDetails);
    logger.info(`Successfully confirmed link for user ${userId} on platform ${mockPlatform.name}`);

    // Step 4: Return the confirmed identity
    // return updatedIdentity;
    return { ...verifiedDetails, is_verified: true };
  }
}

module.exports = PlatformService;
