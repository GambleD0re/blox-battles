// /backend/src/modules/games/RobloxRivalsBotHandler.js
const BaseGameHandler = require('./BaseGameHandler');

class RobloxRivalsBotHandler extends BaseGameHandler {
  /**
   * Validates match parameters against the schema for Roblox Rivals.
   * @override
   * @param {object} matchParameters - e.g., { map: 'crossroads', region: 'NA-East' }
   * @returns {{isValid: boolean, error: string|null}}
   */
  validateParameters(matchParameters) {
    const schema = this.game.rules_schema; // e.g., { "maps": { "type": "SELECT" ... } }
    
    if (!schema.maps || !matchParameters.map) {
      return { isValid: false, error: 'A map must be selected.' };
    }
    if (!matchParameters.region) {
      return { isValid: false, error: 'A region must be selected.' };
    }
    // In a real implementation, we would fetch the list of valid maps from
    // another table or a config file and check if matchParameters.map is in that list.
    
    return { isValid: true, error: null };
  }

  /**
   * Creates the 'REFEREE_DUEL' task payload for the Roblox Lua bot.
   * @override
   * @returns {Promise<object>} The task payload.
   */
  async createMatchTask(duel, server, challenger, opponent) {
    const payload = {
      websiteDuelId: duel.id,
      serverId: server.server_id,
      serverLink: server.join_link,
      challenger: challenger.game_username,
      opponent: opponent.game_username,
      map: duel.match_parameters.map,
      bannedWeapons: duel.match_parameters.banned_weapons || [],
      wager: duel.wager,
    };
    return payload;
  }

  /**
   * Processes the final result from the Lua bot's log stream.
   * @override
   * @returns {Promise<{winnerId: string, loserId: string, transcript: object}>}
   */
  async processMatchResult(duel, resultPayload) {
    const winnerUsername = resultPayload.winner_username;
    let winnerId = null;
    let loserId = null;

    if (winnerUsername) {
      // This is a simplified lookup. A real implementation would query
      // the user_game_identities table to resolve the username to a UUID.
      if (winnerUsername.toLowerCase() === resultPayload.challenger.game_username.toLowerCase()) {
        winnerId = duel.challenger_id;
        loserId = duel.opponent_id;
      } else {
        winnerId = duel.opponent_id;
        loserId = duel.challenger_id;
      }
    }

    return {
      winnerId,
      loserId,
      transcript: resultPayload.full_transcript || {},
    };
  }
}

module.exports = RobloxRivalsBotHandler;
