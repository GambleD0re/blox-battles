// /backend/src/controllers/duel.controller.js
const DuelService = require('../services/duel.service');
const ServerService = require('../services/server.service');
const MatchmakingService = require('../services/matchmaking.service');
const QueueRepository = require('../repositories/queue.repository');
const DuelRepository = require('../repositories/duel.repository');

class DuelController {
  static async createChallenge(req, res, next) {
    try {
      const challengerId = req.user.userId;
      const challengeData = req.body; // { opponentId, gameId, wager, matchParameters }
      
      const newDuel = await DuelService.createDirectChallenge(challengerId, challengeData);

      res.status(201).json({
        success: true,
        data: newDuel,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getDuelById(req, res, next) {
    try {
        const duelId = parseInt(req.params.id, 10);
        const duel = await DuelRepository.findById(duelId);
        if (!duel) {
            const error = new Error('Duel not found.');
            error.statusCode = 404;
            error.code = 'DUEL_NOT_FOUND';
            throw error;
        }
        res.status(200).json({
            success: true,
            data: duel
        });
    } catch (error) {
        next(error);
    }
  }

  static async joinQueue(req, res, next) {
    try {
      const entryData = {
        userId: req.user.userId,
        gameId: req.body.gameId,
        region: req.body.region,
        wager: req.body.wager,
      };
      
      const queueEntry = await QueueRepository.create(entryData);
      
      // Trigger an async matchmaking check, but don't wait for it
      MatchmakingService.findAndProcessMatches();

      res.status(200).json({
        success: true,
        data: queueEntry,
      });
    } catch (error) {
      next(error);
    }
  }
  
  static async leaveQueue(req, res, next) {
    try {
        const userId = req.user.userId;
        const wasRemoved = await QueueRepository.removeByUserId(userId);
        if (!wasRemoved) {
            const error = new Error('You are not currently in the matchmaking queue.');
            error.statusCode = 404;
            error.code = 'NOT_IN_QUEUE';
            throw error;
        }
        res.status(200).json({
            success: true,
            data: { message: 'Successfully left the queue.' }
        });
    } catch (error) {
        next(error);
    }
  }

  static async serverHeartbeat(req, res, next) {
    try {
        const serverData = req.body;
        await ServerService.processHeartbeat(serverData);
        res.status(200).json({
            success: true,
            data: { message: `Heartbeat received for ${serverData.serverId}.` }
        });
    } catch (error) {
        next(error);
    }
  }
}

module.exports = DuelController;
