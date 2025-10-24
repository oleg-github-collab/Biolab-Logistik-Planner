/**
 * Conflict Resolution System
 * Handles concurrent editing and state conflicts
 */

class ConflictResolver {
  constructor() {
    this.editLocks = new Map(); // taskId/messageId -> { userId, timestamp, expiresAt }
    this.pendingChanges = new Map(); // itemId -> { changes[], version }
    this.lockDuration = 30000; // 30 seconds
  }

  /**
   * Try to acquire edit lock for an item
   */
  acquireLock(itemId, userId, itemType = 'task') {
    const existingLock = this.editLocks.get(itemId);

    // Check if lock exists and is still valid
    if (existingLock && existingLock.expiresAt > Date.now()) {
      if (existingLock.userId === userId) {
        // User already has the lock, extend it
        this.extendLock(itemId, userId);
        return { success: true, lock: existingLock };
      } else {
        // Lock held by another user
        return {
          success: false,
          reason: 'locked',
          lockedBy: existingLock.userName,
          expiresIn: existingLock.expiresAt - Date.now()
        };
      }
    }

    // Acquire new lock
    const lock = {
      itemId,
      userId,
      itemType,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.lockDuration
    };

    this.editLocks.set(itemId, lock);
    return { success: true, lock };
  }

  /**
   * Extend existing lock
   */
  extendLock(itemId, userId) {
    const lock = this.editLocks.get(itemId);
    if (lock && lock.userId === userId) {
      lock.expiresAt = Date.now() + this.lockDuration;
      this.editLocks.set(itemId, lock);
      return true;
    }
    return false;
  }

  /**
   * Release lock
   */
  releaseLock(itemId, userId) {
    const lock = this.editLocks.get(itemId);
    if (lock && lock.userId === userId) {
      this.editLocks.delete(itemId);
      return true;
    }
    return false;
  }

  /**
   * Force release lock (admin or timeout)
   */
  forceReleaseLock(itemId) {
    this.editLocks.delete(itemId);
    return true;
  }

  /**
   * Check if item is locked by someone else
   */
  isLocked(itemId, userId) {
    const lock = this.editLocks.get(itemId);
    if (!lock || lock.expiresAt <= Date.now()) {
      return false;
    }
    return lock.userId !== userId;
  }

  /**
   * Get lock info
   */
  getLockInfo(itemId) {
    const lock = this.editLocks.get(itemId);
    if (!lock || lock.expiresAt <= Date.now()) {
      return null;
    }
    return lock;
  }

  /**
   * Clean expired locks
   */
  cleanExpiredLocks() {
    const now = Date.now();
    const expired = [];

    for (const [itemId, lock] of this.editLocks.entries()) {
      if (lock.expiresAt <= now) {
        expired.push(itemId);
      }
    }

    expired.forEach(itemId => this.editLocks.delete(itemId));
    return expired.length;
  }

  /**
   * Merge changes with conflict resolution strategy
   */
  mergeChanges(currentState, incomingChanges, strategy = 'last-write-wins') {
    switch (strategy) {
      case 'last-write-wins':
        return this.lastWriteWins(currentState, incomingChanges);

      case 'merge-fields':
        return this.mergeFields(currentState, incomingChanges);

      case 'user-choice':
        return this.prepareUserChoice(currentState, incomingChanges);

      default:
        return this.lastWriteWins(currentState, incomingChanges);
    }
  }

  /**
   * Last write wins strategy
   */
  lastWriteWins(currentState, incomingChanges) {
    return {
      resolved: { ...currentState, ...incomingChanges },
      conflicts: [],
      strategy: 'last-write-wins'
    };
  }

  /**
   * Merge non-conflicting fields
   */
  mergeFields(currentState, incomingChanges) {
    const conflicts = [];
    const resolved = { ...currentState };

    for (const [key, incomingValue] of Object.entries(incomingChanges)) {
      const currentValue = currentState[key];

      // Skip if same value
      if (JSON.stringify(currentValue) === JSON.stringify(incomingValue)) {
        continue;
      }

      // Check if both changed from original
      if (currentValue !== undefined && currentValue !== incomingValue) {
        conflicts.push({
          field: key,
          currentValue,
          incomingValue,
          timestamp: Date.now()
        });
      } else {
        resolved[key] = incomingValue;
      }
    }

    return {
      resolved,
      conflicts,
      strategy: 'merge-fields'
    };
  }

  /**
   * Prepare data for user to choose
   */
  prepareUserChoice(currentState, incomingChanges) {
    const conflicts = [];

    for (const [key, incomingValue] of Object.entries(incomingChanges)) {
      const currentValue = currentState[key];

      if (currentValue !== incomingValue) {
        conflicts.push({
          field: key,
          currentValue,
          incomingValue,
          options: [
            { label: 'Ihre Version', value: currentValue },
            { label: 'Neue Version', value: incomingValue }
          ]
        });
      }
    }

    return {
      resolved: null,
      conflicts,
      strategy: 'user-choice',
      requiresUserAction: conflicts.length > 0
    };
  }

  /**
   * Apply user's conflict resolution choices
   */
  applyUserChoices(currentState, choices) {
    const resolved = { ...currentState };

    choices.forEach(choice => {
      resolved[choice.field] = choice.selectedValue;
    });

    return resolved;
  }

  /**
   * Version-based conflict detection
   */
  detectVersionConflict(currentVersion, incomingVersion) {
    if (incomingVersion <= currentVersion) {
      return {
        hasConflict: true,
        type: 'version',
        message: 'Die Daten wurden bereits aktualisiert. Bitte neu laden.'
      };
    }
    return { hasConflict: false };
  }

  /**
   * Timestamp-based conflict detection
   */
  detectTimestampConflict(currentTimestamp, incomingTimestamp, threshold = 1000) {
    const diff = Math.abs(new Date(currentTimestamp) - new Date(incomingTimestamp));

    if (diff < threshold) {
      return {
        hasConflict: true,
        type: 'concurrent',
        message: 'Gleichzeitige Änderungen erkannt',
        timeDiff: diff
      };
    }
    return { hasConflict: false };
  }

  /**
   * Get all active locks
   */
  getActiveLocks() {
    const now = Date.now();
    const active = [];

    for (const [itemId, lock] of this.editLocks.entries()) {
      if (lock.expiresAt > now) {
        active.push({
          ...lock,
          timeRemaining: lock.expiresAt - now
        });
      }
    }

    return active;
  }

  /**
   * Clear all locks (emergency use)
   */
  clearAllLocks() {
    const count = this.editLocks.size;
    this.editLocks.clear();
    return count;
  }
}

// Singleton instance
const conflictResolver = new ConflictResolver();

// Auto-cleanup expired locks every minute
setInterval(() => {
  const cleaned = conflictResolver.cleanExpiredLocks();
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} expired edit locks`);
  }
}, 60000);

export default conflictResolver;
