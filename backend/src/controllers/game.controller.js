// /backend/src/controllers/game.controller.js
const GameService = require('../services/game.service');

class GameController {
  /**
   * Handles the request to get the list of all active games.
   * @param {object} req - The Express request object.
   * @param {object} res - The Express response object.
   * @param {function} next - The Express next middleware function.
   */
  static async getAllActiveGames(req, res, next) {
    try {
      const games = await GameService.getActiveGames();
      res.status(200).json({
        success: true,
        data: games,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handles the request to get the authenticated user's game identities.
   * @param {object} req - The Express request object.
   * @param {object} res - The Express response object.
   * @param {function} next - The Express next middleware function.
   */
  static async getMyGameIdentities(req, res, next) {
    try {
      const userId = req.user.userId;
      const identities = await GameService.getUserGameIdentities(userId);
      res.status(200).json({
        success: true,
        data: identities,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = GameController;
