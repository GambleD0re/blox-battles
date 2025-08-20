// /backend/src/controllers/platform.controller.js
const PlatformService = require('../services/platform.service');

class PlatformController {
  /**
   * Handles the request to initiate the account linking process for a platform.
   * @param {object} req - The Express request object.
   * @param {object} res - The Express response object.
   * @param {function} next - The Express next middleware function.
   */
  static async initiateLink(req, res, next) {
    try {
      const userId = req.user.userId;
      const platformId = parseInt(req.params.platformId, 10);
      
      // The service will generate the necessary data (e.g., a phrase for Roblox)
      const linkData = await PlatformService.initiateLinking(userId, platformId);

      res.status(200).json({
        success: true,
        data: linkData,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handles the request to verify and confirm a platform account link.
   * @param {object} req - The Express request object.
   * @param {object} res - The Express response object.
   * @param {function} next - The Express next middleware function.
   */
  static async confirmLink(req, res, next) {
    try {
      const userId = req.user.userId;
      const platformId = parseInt(req.params.platformId, 10);
      const verificationData = req.body; // e.g., { identity: 'roblox_username' }

      const verifiedIdentity = await PlatformService.confirmLinking(userId, platformId, verificationData);

      res.status(200).json({
        success: true,
        data: verifiedIdentity,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PlatformController;
