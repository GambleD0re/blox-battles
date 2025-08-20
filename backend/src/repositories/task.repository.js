// /backend/src/repositories/task.repository.js
const { query } = require('../config/database');

class TaskRepository {
  /**
   * Creates a new task in the database.
   * @param {string} type - The type of the task (e.g., 'REFEREE_DUEL').
   * @param {object} payload - The JSON data associated with the task.
   * @param {object} [client=query] - Optional database client for transactions.
   * @returns {Promise<object>} The newly created task.
   */
  static async create(type, payload, client = query) {
    const text = `
      INSERT INTO tasks (task_type, payload, status)
      VALUES ($1, $2, 'pending')
      RETURNING *;
    `;
    const values = [type, JSON.stringify(payload || {})];
    const { rows } = await client.query(text, values);
    return rows[0];
  }

  /**
   * Fetches a batch of pending tasks of specific types, locking them for processing.
   * This prevents multiple workers from grabbing the same tasks.
   * @param {Array<string>} types - An array of task types to fetch.
   * @param {number} limit - The maximum number of tasks to fetch.
   * @param {object} client - An active pg client for transactional integrity.
   * @returns {Promise<Array<object>>} A list of pending tasks.
   */
  static async fetchAndLockPending(types, limit, client) {
    const text = `
      SELECT id, task_type, payload, status, created_at
      FROM tasks
      WHERE status = 'pending' AND task_type = ANY($1::varchar[])
      ORDER BY created_at ASC
      LIMIT $2
      FOR UPDATE SKIP LOCKED;
    `;
    const values = [types, limit];
    const { rows } = await client.query(text, values);
    return rows;
  }

  /**
   * Updates the status of a batch of tasks.
   * @param {Array<number>} ids - An array of task IDs to update.
   * @param {string} status - The new status (e.g., 'processing', 'completed', 'failed').
   * @param {object} client - An active pg client for transactional integrity.
   * @returns {Promise<void>}
   */
  static async updateStatusForIds(ids, status, client) {
    if (ids.length === 0) return;
    const text = `
      UPDATE tasks
      SET status = $1, completed_at = CASE WHEN $1 IN ('completed', 'failed') THEN NOW() ELSE completed_at END
      WHERE id = ANY($2::int[]);
    `;
    const values = [status, ids];
    await client.query(text, values);
  }
}

module.exports = TaskRepository;
