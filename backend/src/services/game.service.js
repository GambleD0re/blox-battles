// /backend/src/services/game.service.js
const GameRepository = require('../repositories/game.repository');

class GameService {
  /**
   * Retrieves a list of all active games available on the platform.
   * @returns {Promise<Array<object>>} The list of active games.
   */
  static async getActiveGames() {
    // For now, this is a simple pass-through. In the future, this service
    // could add caching logic or transform the data from the repository.
    const games = await GameRepository.findAllActiveGames();
    return games;
  }

  /**
   * Retrieves all linked game identities for a specific user.
   * @param {string} userId - The UUID of the user.
   * @returns {Promise<Array<object>>} The user's linked game identities.
   */
  static async getUserGameIdentities(userId) {
    const identities = await GameRepository.findIdentitiesByUserId(userId);
    return identities;
  }
}

module.exports = GameService;```

---
**File 3 of 3**
```javascript
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
