/**
 * Transaction Manager
 * Provides transaction-like semantics for frontend operations
 */

import errorRecovery from './errorRecovery';
import stateValidator from './stateValidator';

class TransactionManager {
  constructor() {
    this.activeTransactions = new Map();
    this.transactionLog = [];
    this.maxLogSize = 100;
  }

  /**
   * Begin a new transaction
   */
  begin(transactionId, context = {}) {
    if (this.activeTransactions.has(transactionId)) {
      throw new Error(`Transaction ${transactionId} already exists`);
    }

    const transaction = {
      id: transactionId,
      startedAt: new Date().toISOString(),
      context,
      operations: [],
      snapshots: new Map(),
      status: 'active',
      rollbackHandlers: []
    };

    this.activeTransactions.set(transactionId, transaction);
    return transaction;
  }

  /**
   * Add operation to transaction
   */
  addOperation(transactionId, operation) {
    const transaction = this.activeTransactions.get(transactionId);

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== 'active') {
      throw new Error(`Transaction ${transactionId} is not active`);
    }

    operation.timestamp = new Date().toISOString();
    transaction.operations.push(operation);
  }

  /**
   * Save state snapshot for rollback
   */
  snapshot(transactionId, key, state) {
    const transaction = this.activeTransactions.get(transactionId);

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    transaction.snapshots.set(key, JSON.parse(JSON.stringify(state)));
  }

  /**
   * Register rollback handler
   */
  onRollback(transactionId, handler) {
    const transaction = this.activeTransactions.get(transactionId);

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    transaction.rollbackHandlers.push(handler);
  }

  /**
   * Commit transaction
   */
  async commit(transactionId) {
    const transaction = this.activeTransactions.get(transactionId);

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== 'active') {
      throw new Error(`Transaction ${transactionId} is not active`);
    }

    try {
      // Validate all operations
      for (const operation of transaction.operations) {
        if (operation.validate && typeof operation.validate === 'function') {
          const isValid = await operation.validate();
          if (!isValid) {
            throw new Error(`Operation validation failed: ${operation.type}`);
          }
        }
      }

      // Execute commit handlers
      for (const operation of transaction.operations) {
        if (operation.commit && typeof operation.commit === 'function') {
          await operation.commit();
        }
      }

      transaction.status = 'committed';
      transaction.completedAt = new Date().toISOString();

      this.logTransaction(transaction);
      this.activeTransactions.delete(transactionId);

      console.log(`✅ Transaction ${transactionId} committed successfully`);

      return { success: true, transaction };
    } catch (error) {
      console.error(`❌ Transaction ${transactionId} commit failed:`, error);

      // Auto-rollback on commit failure
      await this.rollback(transactionId, error);

      throw error;
    }
  }

  /**
   * Rollback transaction
   */
  async rollback(transactionId, reason = null) {
    const transaction = this.activeTransactions.get(transactionId);

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    try {
      console.warn(`🔄 Rolling back transaction ${transactionId}...`);

      // Execute rollback handlers in reverse order
      for (let i = transaction.rollbackHandlers.length - 1; i >= 0; i--) {
        const handler = transaction.rollbackHandlers[i];
        try {
          await handler(transaction.snapshots);
        } catch (handlerError) {
          console.error('Rollback handler failed:', handlerError);
        }
      }

      // Execute operation rollbacks in reverse order
      for (let i = transaction.operations.length - 1; i >= 0; i--) {
        const operation = transaction.operations[i];
        if (operation.rollback && typeof operation.rollback === 'function') {
          try {
            await operation.rollback(transaction.snapshots);
          } catch (opError) {
            console.error('Operation rollback failed:', opError);
          }
        }
      }

      transaction.status = 'rolled_back';
      transaction.completedAt = new Date().toISOString();
      transaction.rollbackReason = reason;

      this.logTransaction(transaction);
      this.activeTransactions.delete(transactionId);

      console.log(`↩️ Transaction ${transactionId} rolled back`);

      return { success: true, rolledBack: true };
    } catch (error) {
      console.error(`❌ Transaction ${transactionId} rollback failed:`, error);

      transaction.status = 'failed';
      transaction.completedAt = new Date().toISOString();
      transaction.error = error.message;

      this.logTransaction(transaction);
      this.activeTransactions.delete(transactionId);

      throw error;
    }
  }

  /**
   * Execute function within transaction
   */
  async execute(transactionId, fn, context = {}) {
    const transaction = this.begin(transactionId, context);

    try {
      const result = await fn(transaction);
      await this.commit(transactionId);
      return result;
    } catch (error) {
      await errorRecovery.handleError(error, {
        transactionId,
        context
      });
      throw error;
    }
  }

  /**
   * Optimistic update with automatic rollback
   */
  async optimistic(transactionId, updates, apiCall, rollbackFn) {
    const transaction = this.begin(transactionId);

    try {
      // Apply optimistic updates immediately
      const originalState = {};
      Object.keys(updates).forEach(key => {
        originalState[key] = updates[key].current;
        updates[key].setter(updates[key].optimistic);
      });

      this.snapshot(transactionId, 'optimistic', originalState);

      // Register rollback
      this.onRollback(transactionId, async (snapshots) => {
        const saved = snapshots.get('optimistic');
        if (rollbackFn) {
          await rollbackFn(saved);
        } else {
          // Auto-restore original values
          Object.keys(updates).forEach(key => {
            updates[key].setter(saved[key]);
          });
        }
      });

      // Execute API call
      const result = await apiCall();

      // Commit if successful
      await this.commit(transactionId);

      return result;
    } catch (error) {
      // Rollback on failure
      await this.rollback(transactionId, error);
      throw error;
    }
  }

  /**
   * Batch operations in single transaction
   */
  async batch(transactionId, operations) {
    const transaction = this.begin(transactionId);

    const results = [];
    const errors = [];

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];

      try {
        this.addOperation(transactionId, {
          type: operation.type || `operation_${i}`,
          execute: operation.execute,
          rollback: operation.rollback,
          validate: operation.validate
        });

        const result = await operation.execute();
        results.push({ index: i, result, success: true });
      } catch (error) {
        errors.push({ index: i, error, operation: operation.type });

        // Rollback on first error
        await this.rollback(transactionId, error);

        return {
          success: false,
          results,
          errors,
          rolledBack: true
        };
      }
    }

    await this.commit(transactionId);

    return {
      success: true,
      results
    };
  }

  /**
   * Log transaction to history
   */
  logTransaction(transaction) {
    const log = {
      id: transaction.id,
      status: transaction.status,
      startedAt: transaction.startedAt,
      completedAt: transaction.completedAt,
      duration: transaction.completedAt
        ? new Date(transaction.completedAt) - new Date(transaction.startedAt)
        : null,
      operationsCount: transaction.operations.length,
      rollbackReason: transaction.rollbackReason,
      error: transaction.error
    };

    this.transactionLog.push(log);

    if (this.transactionLog.length > this.maxLogSize) {
      this.transactionLog.shift();
    }
  }

  /**
   * Get transaction status
   */
  getStatus(transactionId) {
    const transaction = this.activeTransactions.get(transactionId);

    if (transaction) {
      return {
        active: true,
        status: transaction.status,
        operationsCount: transaction.operations.length,
        startedAt: transaction.startedAt
      };
    }

    // Check log
    const logged = this.transactionLog.find(t => t.id === transactionId);
    if (logged) {
      return {
        active: false,
        ...logged
      };
    }

    return null;
  }

  /**
   * Get transaction statistics
   */
  getStatistics() {
    const stats = {
      active: this.activeTransactions.size,
      total: this.transactionLog.length,
      committed: 0,
      rolledBack: 0,
      failed: 0,
      averageDuration: 0
    };

    let totalDuration = 0;

    this.transactionLog.forEach(log => {
      if (log.status === 'committed') stats.committed++;
      if (log.status === 'rolled_back') stats.rolledBack++;
      if (log.status === 'failed') stats.failed++;
      if (log.duration) totalDuration += log.duration;
    });

    if (stats.total > 0) {
      stats.averageDuration = Math.round(totalDuration / stats.total);
    }

    return stats;
  }

  /**
   * Clear transaction log
   */
  clearLog() {
    this.transactionLog = [];
  }

  /**
   * Abort all active transactions (emergency)
   */
  async abortAll() {
    const transactions = Array.from(this.activeTransactions.keys());

    for (const transactionId of transactions) {
      try {
        await this.rollback(transactionId, 'aborted');
      } catch (error) {
        console.error(`Failed to abort transaction ${transactionId}:`, error);
      }
    }

    return transactions.length;
  }
}

// Singleton instance
const transactionManager = new TransactionManager();

export default transactionManager;

// Usage examples:
/*
// Simple transaction
await transactionManager.execute('update-task-123', async (txn) => {
  txn.snapshot('task', currentTask);
  await updateTaskAPI(newData);
});

// Optimistic update
await transactionManager.optimistic(
  'optimistic-123',
  {
    tasks: {
      current: currentTasks,
      optimistic: newTasks,
      setter: setTasks
    }
  },
  () => api.updateTasks(newTasks),
  (original) => setTasks(original.tasks)
);

// Batch operations
await transactionManager.batch('batch-123', [
  {
    type: 'create-task',
    execute: () => api.createTask(task1),
    rollback: () => api.deleteTask(task1.id)
  },
  {
    type: 'update-task',
    execute: () => api.updateTask(task2),
    rollback: (snapshots) => api.updateTask(snapshots.get('task2'))
  }
]);
*/
