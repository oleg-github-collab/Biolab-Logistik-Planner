// Offline Queue Manager for messages and tasks
class OfflineQueueManager {
  constructor() {
    this.storageKey = 'offline_queue';
    this.listeners = [];
  }

  // Add item to queue
  enqueue(item) {
    const queue = this.getQueue();
    queue.push({
      ...item,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      attempts: 0
    });
    this.saveQueue(queue);
    this.notifyListeners();
    return queue[queue.length - 1];
  }

  // Remove item from queue
  dequeue(id) {
    let queue = this.getQueue();
    queue = queue.filter(item => item.id !== id);
    this.saveQueue(queue);
    this.notifyListeners();
  }

  // Get all items in queue
  getQueue() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error('Error reading offline queue:', err);
      return [];
    }
  }

  // Save queue to storage
  saveQueue(queue) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(queue));
    } catch (err) {
      console.error('Error saving offline queue:', err);
    }
  }

  // Clear entire queue
  clear() {
    localStorage.removeItem(this.storageKey);
    this.notifyListeners();
  }

  // Get queue size
  size() {
    return this.getQueue().length;
  }

  // Mark item as failed
  markFailed(id, error) {
    const queue = this.getQueue();
    const itemIndex = queue.findIndex(item => item.id === id);
    if (itemIndex !== -1) {
      queue[itemIndex].attempts += 1;
      queue[itemIndex].lastError = error;
      queue[itemIndex].lastAttempt = new Date().toISOString();

      // Remove if too many attempts
      if (queue[itemIndex].attempts >= 3) {
        queue.splice(itemIndex, 1);
        console.warn('Item removed from queue after 3 failed attempts:', id);
      }

      this.saveQueue(queue);
      this.notifyListeners();
    }
  }

  // Subscribe to queue changes
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Notify all listeners
  notifyListeners() {
    const queue = this.getQueue();
    this.listeners.forEach(callback => callback(queue));
  }

  // Process queue with a handler
  async processQueue(handler) {
    const queue = this.getQueue();
    const results = {
      success: [],
      failed: []
    };

    for (const item of queue) {
      try {
        await handler(item);
        this.dequeue(item.id);
        results.success.push(item.id);
      } catch (error) {
        console.error('Error processing queue item:', error);
        this.markFailed(item.id, error.message);
        results.failed.push({ id: item.id, error: error.message });
      }
    }

    return results;
  }

  // Get items by type
  getByType(type) {
    return this.getQueue().filter(item => item.type === type);
  }
}

// Singleton instance
const offlineQueue = new OfflineQueueManager();

export default offlineQueue;

// Usage example:
// offlineQueue.enqueue({ type: 'message', data: { receiverId: 123, message: 'Hello' } });
// offlineQueue.processQueue(async (item) => { await sendMessage(item.data); });
