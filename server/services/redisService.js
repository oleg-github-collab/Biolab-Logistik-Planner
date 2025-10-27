const Redis = require('ioredis');
const logger = require('../utils/logger');

const REDIS_URL =
  process.env.REDIS_URL ||
  process.env.REDIS_TLS_URL ||
  process.env.UPSTASH_REDIS_URL ||
  process.env.REDISCLOUD_URL ||
  null;

const buildConfigFromUrl = (urlString) => {
  try {
    const url = new URL(urlString);
    const isTls = url.protocol === 'rediss:' || process.env.REDIS_USE_TLS === 'true';
    const dbPath = url.pathname?.replace('/', '') || '0';

    return {
      host: url.hostname,
      port: url.port ? parseInt(url.port, 10) : 6379,
      password: url.password || undefined,
      username: url.username || undefined,
      db: parseInt(dbPath, 10) || 0,
      tls: isTls ? { rejectUnauthorized: false } : undefined
    };
  } catch (error) {
    logger.error('Failed to parse REDIS_URL, falling back to manual config', { error: error.message });
    return null;
  }
};

// Redis configuration
const baseConfig = REDIS_URL ? buildConfigFromUrl(REDIS_URL) : null;
const redisConfig = {
  host: process.env.REDIS_HOST || baseConfig?.host || 'localhost',
  port: parseInt(process.env.REDIS_PORT || baseConfig?.port || 6379, 10),
  password: process.env.REDIS_PASSWORD || baseConfig?.password || undefined,
  username: process.env.REDIS_USERNAME || baseConfig?.username || undefined,
  db: parseInt(process.env.REDIS_DB || baseConfig?.db || 0, 10),
  retryStrategy: (times) => {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  maxRetriesPerRequest: 5,
  enableReadyCheck: true,
  lazyConnect: true,
  tls: baseConfig?.tls
};

// Create Redis client
const redis = new Redis(redisConfig);

// Create separate client for pub/sub
const redisPubSub = new Redis(redisConfig);

// Connection event handlers
redis.on('connect', () => {
  logger.info('Redis client connected');
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

redis.on('error', (error) => {
  logger.error('Redis client error:', error);
});

redis.on('close', () => {
  logger.warn('Redis client connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis client reconnecting...');
});

/**
 * Production-safe method to get keys using SCAN instead of KEYS
 * @param {string} pattern - Pattern to match
 * @returns {Promise<string[]>} Array of matching keys
 */
async function scanKeys(pattern) {
  const keys = [];
  let cursor = '0';

  do {
    const [newCursor, matchedKeys] = await redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      100 // Process 100 keys at a time
    );
    cursor = newCursor;
    keys.push(...matchedKeys);
  } while (cursor !== '0');

  return keys;
}

// Connect to Redis
async function connect() {
  try {
    await redis.connect();
    await redisPubSub.connect();
    logger.info('Redis clients connected successfully');
    return true;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    return false;
  }
}

// Graceful shutdown
async function disconnect() {
  try {
    await redis.quit();
    await redisPubSub.quit();
    logger.info('Redis clients disconnected');
  } catch (error) {
    logger.error('Error disconnecting from Redis:', error);
  }
}

// ===== SESSION MANAGEMENT =====

const SESSION_PREFIX = 'session:';
const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

async function createSession(userId, data = {}) {
  try {
    const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const sessionKey = `${SESSION_PREFIX}${sessionId}`;

    const sessionData = {
      userId,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      ...data
    };

    await redis.setex(sessionKey, SESSION_TTL, JSON.stringify(sessionData));
    logger.info('Session created:', { userId, sessionId });

    return sessionId;
  } catch (error) {
    logger.error('Error creating session:', error);
    return null;
  }
}

async function getSession(sessionId) {
  try {
    const sessionKey = `${SESSION_PREFIX}${sessionId}`;
    const data = await redis.get(sessionKey);

    if (!data) {
      return null;
    }

    const session = JSON.parse(data);

    // Update last activity
    session.lastActivity = new Date().toISOString();
    await redis.setex(sessionKey, SESSION_TTL, JSON.stringify(session));

    return session;
  } catch (error) {
    logger.error('Error getting session:', error);
    return null;
  }
}

async function deleteSession(sessionId) {
  try {
    const sessionKey = `${SESSION_PREFIX}${sessionId}`;
    await redis.del(sessionKey);
    logger.info('Session deleted:', sessionId);
    return true;
  } catch (error) {
    logger.error('Error deleting session:', error);
    return false;
  }
}

async function getUserSessions(userId) {
  try {
    const pattern = `${SESSION_PREFIX}*`;
    const keys = await scanKeys(pattern);
    const sessions = [];

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const session = JSON.parse(data);
        if (session.userId === userId) {
          sessions.push({
            sessionId: key.replace(SESSION_PREFIX, ''),
            ...session
          });
        }
      }
    }

    return sessions;
  } catch (error) {
    logger.error('Error getting user sessions:', error);
    return [];
  }
}

// ===== CACHING =====

const CACHE_PREFIX = 'cache:';

async function setCache(key, value, ttl = 3600) {
  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    const data = JSON.stringify(value);

    if (ttl) {
      await redis.setex(cacheKey, ttl, data);
    } else {
      await redis.set(cacheKey, data);
    }

    return true;
  } catch (error) {
    logger.error('Error setting cache:', error);
    return false;
  }
}

async function getCache(key) {
  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    const data = await redis.get(cacheKey);

    if (!data) {
      return null;
    }

    return JSON.parse(data);
  } catch (error) {
    logger.error('Error getting cache:', error);
    return null;
  }
}

async function deleteCache(key) {
  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    await redis.del(cacheKey);
    return true;
  } catch (error) {
    logger.error('Error deleting cache:', error);
    return false;
  }
}

async function deleteCachePattern(pattern) {
  try {
    const cachePattern = `${CACHE_PREFIX}${pattern}`;
    const keys = await scanKeys(cachePattern);

    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`Deleted ${keys.length} cache entries matching pattern: ${pattern}`);
    }

    return keys.length;
  } catch (error) {
    logger.error('Error deleting cache pattern:', error);
    return 0;
  }
}

// Cache with auto-refresh
async function getCacheOrFetch(key, fetchFn, ttl = 3600) {
  try {
    // Try to get from cache first
    const cached = await getCache(key);
    if (cached !== null) {
      return cached;
    }

    // If not in cache, fetch and store
    const data = await fetchFn();
    await setCache(key, data, ttl);

    return data;
  } catch (error) {
    logger.error('Error in getCacheOrFetch:', error);
    // If Redis fails, still try to fetch the data
    return await fetchFn();
  }
}

// ===== RATE LIMITING =====

const RATE_LIMIT_PREFIX = 'ratelimit:';

async function checkRateLimit(key, maxRequests = 100, windowSeconds = 60) {
  try {
    const rateLimitKey = `${RATE_LIMIT_PREFIX}${key}`;
    const current = await redis.incr(rateLimitKey);

    if (current === 1) {
      // First request in window, set expiry
      await redis.expire(rateLimitKey, windowSeconds);
    }

    return {
      allowed: current <= maxRequests,
      current,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - current)
    };
  } catch (error) {
    logger.error('Error checking rate limit:', error);
    // On error, allow the request
    return { allowed: true, current: 0, limit: maxRequests, remaining: maxRequests };
  }
}

async function resetRateLimit(key) {
  try {
    const rateLimitKey = `${RATE_LIMIT_PREFIX}${key}`;
    await redis.del(rateLimitKey);
    return true;
  } catch (error) {
    logger.error('Error resetting rate limit:', error);
    return false;
  }
}

// ===== ONLINE USERS TRACKING =====

const ONLINE_PREFIX = 'online:';
const ONLINE_TTL = 5 * 60; // 5 minutes

async function setUserOnline(userId, metadata = {}) {
  try {
    const onlineKey = `${ONLINE_PREFIX}${userId}`;
    const data = {
      userId,
      lastSeen: new Date().toISOString(),
      ...metadata
    };

    await redis.setex(onlineKey, ONLINE_TTL, JSON.stringify(data));
    return true;
  } catch (error) {
    logger.error('Error setting user online:', error);
    return false;
  }
}

async function isUserOnline(userId) {
  try {
    const onlineKey = `${ONLINE_PREFIX}${userId}`;
    const exists = await redis.exists(onlineKey);
    return exists === 1;
  } catch (error) {
    logger.error('Error checking if user online:', error);
    return false;
  }
}

async function getOnlineUsers() {
  try {
    const pattern = `${ONLINE_PREFIX}*`;
    const keys = await scanKeys(pattern);
    const users = [];

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        users.push(JSON.parse(data));
      }
    }

    return users;
  } catch (error) {
    logger.error('Error getting online users:', error);
    return [];
  }
}

async function setUserOffline(userId) {
  try {
    const onlineKey = `${ONLINE_PREFIX}${userId}`;
    await redis.del(onlineKey);
    return true;
  } catch (error) {
    logger.error('Error setting user offline:', error);
    return false;
  }
}

// ===== PUB/SUB =====

async function publish(channel, message) {
  try {
    const data = JSON.stringify(message);
    await redis.publish(channel, data);
    return true;
  } catch (error) {
    logger.error('Error publishing message:', error);
    return false;
  }
}

function subscribe(channel, callback) {
  try {
    redisPubSub.subscribe(channel);

    redisPubSub.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          const data = JSON.parse(message);
          callback(data);
        } catch (error) {
          logger.error('Error parsing pub/sub message:', error);
        }
      }
    });

    logger.info(`Subscribed to channel: ${channel}`);
    return true;
  } catch (error) {
    logger.error('Error subscribing to channel:', error);
    return false;
  }
}

function unsubscribe(channel) {
  try {
    redisPubSub.unsubscribe(channel);
    logger.info(`Unsubscribed from channel: ${channel}`);
    return true;
  } catch (error) {
    logger.error('Error unsubscribing from channel:', error);
    return false;
  }
}

// ===== COUNTERS =====

async function increment(key, amount = 1) {
  try {
    const value = await redis.incrby(key, amount);
    return value;
  } catch (error) {
    logger.error('Error incrementing counter:', error);
    return null;
  }
}

async function decrement(key, amount = 1) {
  try {
    const value = await redis.decrby(key, amount);
    return value;
  } catch (error) {
    logger.error('Error decrementing counter:', error);
    return null;
  }
}

async function getCounter(key) {
  try {
    const value = await redis.get(key);
    return value ? parseInt(value) : 0;
  } catch (error) {
    logger.error('Error getting counter:', error);
    return 0;
  }
}

// ===== LISTS (Queues) =====

async function pushToList(key, value) {
  try {
    const data = JSON.stringify(value);
    await redis.rpush(key, data);
    return true;
  } catch (error) {
    logger.error('Error pushing to list:', error);
    return false;
  }
}

async function popFromList(key) {
  try {
    const data = await redis.lpop(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch (error) {
    logger.error('Error popping from list:', error);
    return null;
  }
}

async function getListLength(key) {
  try {
    const length = await redis.llen(key);
    return length;
  } catch (error) {
    logger.error('Error getting list length:', error);
    return 0;
  }
}

// ===== HEALTH CHECK =====

async function healthCheck() {
  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;

    const info = await redis.info();
    const dbSize = await redis.dbsize();

    return {
      status: 'healthy',
      latency: `${latency}ms`,
      dbSize,
      connected: redis.status === 'ready'
    };
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return {
      status: 'unhealthy',
      error: error.message,
      connected: false
    };
  }
}

module.exports = {
  redis,
  redisPubSub,
  connect,
  disconnect,

  // Sessions
  createSession,
  getSession,
  deleteSession,
  getUserSessions,

  // Caching
  setCache,
  getCache,
  deleteCache,
  deleteCachePattern,
  getCacheOrFetch,

  // Rate limiting
  checkRateLimit,
  resetRateLimit,

  // Online users
  setUserOnline,
  isUserOnline,
  getOnlineUsers,
  setUserOffline,

  // Pub/Sub
  publish,
  subscribe,
  unsubscribe,

  // Counters
  increment,
  decrement,
  getCounter,

  // Lists
  pushToList,
  popFromList,
  getListLength,

  // Health
  healthCheck
};
