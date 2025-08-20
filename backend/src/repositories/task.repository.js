// /backend/src/services/task.service.js
const TaskRepository = require('../repositories/task.repository');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

class TaskService {
  /**
   * Queues a new background task.
   * @param {string} type - The task type.
   * @param {object} payload - The data required for the task.
   * @returns {Promise<object>} The created task object.
   */
  static async queueTask(type, payload) {
    try {
      const task = await TaskRepository.create(type, payload);
      logger.info({ taskId: task.id, taskType: type }, 'Successfully queued new task.');
      return task;
    } catch (error) {
      logger.error({ err: error, taskType: type, payload }, 'Failed to queue task.');
      // Depending on criticality, you might want to re-throw or handle differently
      throw new Error('Could not queue the requested task.');
    }
  }

  /**
   * Fetches a batch of pending tasks and marks them as 'processing'.
   * This is a transactional operation to ensure atomicity.
   * @param {Array<string>} types - The types of tasks this worker can handle.
   * @param {number} [limit=10] - The max number of tasks to fetch.
   * @returns {Promise<Array<object>>} A list of tasks to be processed.
   */
  static async fetchTasksForWorker(types, limit = 10) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tasks = await TaskRepository.fetchAndLockPending(types, limit, client);
      if (tasks.length > 0) {
        const taskIds = tasks.map(t => t.id);
        await TaskRepository.updateStatusForIds(taskIds, 'processing', client);
      }
      await client.query('COMMIT');
      return tasks;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ err: error, workerTypes: types }, 'Failed to fetch tasks for worker.');
      return []; // Return empty on error to prevent worker crash
    } finally {
      client.release();
    }
  }

  /**
   * Marks a single task as completed.
   * @param {number} taskId - The ID of the task.
   */
  static async completeTask(taskId) {
    const client = await pool.connect();
    try {
      await TaskRepository.updateStatusForIds([taskId], 'completed', client);
      logger.debug({ taskId }, 'Task marked as completed.');
    } finally {
      client.release();
    }
  }

  /**
   * Marks a single task as failed.
   * @param {number} taskId - The ID of the task.
   */
  static async failTask(taskId) {
    const client = await pool.connect();
    try {
      await TaskRepository.updateStatusForIds([taskId], 'failed', client);
      logger.warn({ taskId }, 'Task marked as failed.');
    } finally {
      client.release();
    }
  }
}

module.exports = TaskService;
