// /backend/src/controllers/auth.controller.js
const AuthService = require('../services/auth.service');

class AuthController {
  static async register(req, res, next) {
    try {
      const { email, password } = req.body;
      const { user, token } = await AuthService.register(email, password);

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
          },
          token,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const { user, token } = await AuthService.login(email, password);

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            isAdmin: user.is_admin,
          },
          token,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
