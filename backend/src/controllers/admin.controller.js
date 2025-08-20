// /backend/src/controllers/admin.controller.js
const AdminService = require('../services/admin.service');

class AdminController {
  static async getStats(req, res, next) {
    try {
      const stats = await AdminService.getDashboardStats();
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  static async findUsers(req, res, next) {
    try {
      const filters = {
        query: req.query.search,
        status: req.query.status,
      };
      const users = await AdminService.findUsers(filters);
      res.status(200).json({
        success: true,
        data: users,
      });
    } catch (error) {
      next(error);
    }
  }

  static async banUser(req, res, next) {
    try {
      const { userId } = req.params;
      const { reason, durationHours } = req.body;
      const updatedUser = await AdminService.banUser(userId, reason, durationHours);
      res.status(200).json({
        success: true,
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }

  static async unbanUser(req, res, next) {
    try {
      const { userId } = req.params;
      const updatedUser = await AdminService.unbanUser(userId);
      res.status(200).json({
        success: true,
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }

  static async adjustGems(req, res, next) {
    try {
      const { userId } = req.params;
      const { amount } = req.body;
      await AdminService.adjustUserGems(userId, amount);
      res.status(200).json({
        success: true,
        data: { message: `Successfully adjusted gems for user ${userId}.` },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminController;
