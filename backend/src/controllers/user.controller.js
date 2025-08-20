// /backend/src/controllers/user.controller.js
const UserService = require('../services/user.service');

class UserController {
  /**
   * Handles the request to get the currently authenticated user's profile.
   * @param {object} req - The Express request object.
   * @param {object} res - The Express response object.
   * @param {function} next - The Express next middleware function.
   */
  static async getMyProfile(req, res, next) {
    try {
      // The user ID is attached to the request by the authenticateToken middleware
      const userId = req.user.userId;
      const userProfile = await UserService.getUserProfile(userId);
      
      res.status(200).json({
        success: true,
        data: userProfile,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;
