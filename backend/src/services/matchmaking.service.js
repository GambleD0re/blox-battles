// /backend/src/services/matchmaking.service.js
const QueueRepository = require('../repositories/queue.repository');
const DuelRepository = require('../repositories/duel.repository');
const UserRepository = require('../repositories/user.repository');
const ServerService = require('./server.service');
const logger = require('../utils/logger');
// const TaskService = require('./task.service'); // To be created
// const GameService = require('./game.service'); // To be used later

class MatchmakingService {
  /**
   * Finds and processes all possible matches from the current queue.
   * This is the main matchmaking engine loop.
   */
  static async findAndProcessMatches() {
    const waitingPlayers = await QueueRepository.findAllWaiting();
    if (waitingPlayers.length < 2) {
      return; // Not enough players to make a match
    }

    // Group players by a unique queue key (game_id + region + wager)
    const groupedByQueue = waitingPlayers.reduce((acc, player) => {
      const key = `${player.game_id}_${player.region}_${player.wager}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(player);
      return acc;
    }, {});

    for (const key in groupedByQueue) {
      const players = groupedByQueue[key];
      while (players.length >= 2) {
        const player1 = players.shift();
        const player2 = players.shift();
        
        // Use a self-invoking async function to process each pair
        // without blocking the main loop with awaits.
        (async () => {
          try {
            await this.createMatchFromQueue(player1, player2);
          } catch (error) {
            logger.error({ err: error, players: [player1.user_id, player2.user_id] }, 'Failed to create match from queue pair.');
            // Potentially add players back to the queue or notify them.
          }
        })();
      }
    }
  }

  /**
   * Creates a single match for two players found in the queue.
   * @param {object} p1 - Queue entry for player 1.
   * @param {object} p2 - Queue entry for player 2.
   */
  static async createMatchFromQueue(p1, p2) {
    logger.info({ p1: p1.user_id, p2: p2.user_id }, 'Attempting to create match from queue.');

    // Step 1: Allocate a game server
    const server = await ServerService.allocateServer(p1.region);
    if (!server) {
      // No server available, this match cannot proceed right now.
      // The players remain in the queue for the next cycle.
      logger.warn({ region: p1.region }, 'Matchmaking failed: No available servers.');
      return;
    }

    // Step 2: Create the duel in the database
    // This is a simplified parameter set for a random match.
    // A more advanced system would combine banned maps/weapons.
    const matchParameters = {
      map: 'random_from_pool',
      region: p1.region,
      banned_weapons: [],
    };

    const duelData = {
      challengerId: p1.user_id,
      opponentId: p2.user_id,
      gameId: p1.game_id,
      wager: p1.wager,
      matchParameters,
    };
    
    // This should ideally be wrapped in a database transaction
    const newDuel = await DuelRepository.create(duelData);
    await DuelRepository.updateStatus(newDuel.id, 'started');
    
    // Step 3: Remove players from queue
    await QueueRepository.removeByUserId(p1.user_id);
    await QueueRepository.removeByUserId(p2.user_id);

    // Step 4: Create the 'REFEREE_DUEL' task (Logic to be filled in with TaskService)
    logger.info({ duelId: newDuel.id }, 'Match created successfully. A task will be created.');
    // await TaskService.queueRefereeTask(newDuel, server);
  }
}

module.exports = MatchmakingService;
