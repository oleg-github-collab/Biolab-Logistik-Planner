const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const database = require('./config/database');
const logger = require('./utils/logger');
const {
  setUserOnline,
  setUserOffline,
  getOnlineUsers: getOnlineUsersFromRedis
} = require('./services/redisService');
const {
  ensureDirectConversation,
  fetchConversationById,
  getConversationMembers,
  listUserConversations,
  CONVERSATION_TYPES
} = require('./services/conversationService');
const {
  normalizeMessageRow,
  enrichMessages,
  createMessageRecord
} = require('./services/messageService');

let io;

// Active users tracking
const activeUsers = new Map(); // userId -> {socketId, userInfo, lastSeen}

// Cleanup stale connections every 5 minutes
setInterval(() => {
  const now = Date.now();
  const staleTimeout = 5 * 60 * 1000; // 5 minutes

  for (const [userId, userData] of activeUsers.entries()) {
    if (userData.lastSeen && (now - userData.lastSeen.getTime()) > staleTimeout) {
      logger.info('Removing stale user connection', { userId });
      activeUsers.delete(userId);
    }
  }
}, 5 * 60 * 1000);

const buildOnlinePayload = (users) => users.map((entry) => ({
  userId: entry.userInfo ? entry.userInfo.id : parseInt(entry.userId, 10),
  name: entry.userInfo ? entry.userInfo.name : entry.name,
  lastSeen: entry.lastSeen || entry.lastSeenAt || new Date().toISOString()
}));

const emitOnlineUsers = async (targetSocket = null) => {
  const fallback = buildOnlinePayload(Array.from(activeUsers.values()));

  try {
    const redisUsers = await getOnlineUsersFromRedis();
    if (Array.isArray(redisUsers) && redisUsers.length > 0) {
      const payload = redisUsers.map((user) => ({
        userId: parseInt(user.userId, 10),
        name: user.name,
        lastSeen: user.lastSeen
      }));

      if (targetSocket) {
        targetSocket.emit('online_users', payload);
      } else if (io) {
        io.emit('online_users', payload);
      }
      return;
    }
  } catch (error) {
    logger.warn('Redis online user broadcast failed, falling back to local state', { error: error.message });
  }

  if (targetSocket) {
    targetSocket.emit('online_users', fallback);
  } else if (io) {
    io.emit('online_users', fallback);
  }
};

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:3000",
        "http://localhost:5000",
        "https://biolab-logistik-planner-production.up.railway.app"
      ],
      methods: ["GET", "POST"],
      credentials: true
    },
    pingTimeout: 30000,
    pingInterval: 10000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e8,
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
    perMessageDeflate: {
      threshold: 1024
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('No token provided'));
      }

      // Verify token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        logger.error('JWT_SECRET not configured for WebSocket');
        return next(new Error('Server configuration error'));
      }
      const decoded = jwt.verify(token, jwtSecret);

      const userResult = await database.query(
        'SELECT id, name, email, role FROM users WHERE id = $1',
        [decoded.user.id]
      );

      if (userResult.rows.length === 0) {
        return next(new Error('Benutzer nicht gefunden'));
      }

      const user = userResult.rows[0];
      socket.userId = user.id;
      socket.userInfo = user;
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    const userInfo = socket.userInfo;

    logger.info('User connected via WebSocket', {
      userId,
      username: userInfo.name,
      socketId: socket.id
    });

    // Add user to active users
    activeUsers.set(userId, {
      socketId: socket.id,
      userInfo,
      lastSeen: new Date()
    });

    // Track user presence globally
    setUserOnline(userId, { name: userInfo.name }).catch((error) => {
      logger.warn('Failed to store user presence in Redis', { userId, error: error.message });
    });

    // Join user-specific room
    socket.join(`user_${userId}`);

    (async () => {
      try {
        const conversations = await listUserConversations(userId);
        conversations.forEach((conversation) => {
          socket.join(`conversation_${conversation.id}`);
        });
      } catch (error) {
        logger.warn('Failed to preload conversation rooms for user', {
          userId,
          error: error.message
        });
      }
    })();

    // Notify other users about online status
    socket.broadcast.emit('user_online', {
      userId,
      userInfo: { id: userInfo.id, name: userInfo.name }
    });

    // Send current online users (global if Redis available)
    emitOnlineUsers(socket);
    emitOnlineUsers();

    // Handle unified message sending (direct/group/topic)
    socket.on('send_message', async (data = {}) => {
      const {
        conversationId,
        receiverId,
        message,
        messageType = 'text',
        attachments = [],
        gif,
        quotedMessageId,
        mentionedUserIds = [],
        metadata = {}
      } = data;

      const trimmedMessage = typeof message === 'string' ? message.trim() : '';
      const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
      const payloadText = gif || trimmedMessage;

      if (!payloadText && !hasAttachments) {
        socket.emit('message_error', { error: 'Nachricht darf nicht leer sein' });
        return;
      }

      const sanitizedContent = payloadText ? payloadText.replace(/<script[^>]*>.*?<\/script>/gi, '').trim() : null;
      const attachmentPayload = hasAttachments ? attachments : [];
      const messageContent = sanitizedContent || gif || (attachmentPayload.length ? '[attachment]' : null);

      const client = await database.getClient();
      let targetConversationId = conversationId ? parseInt(conversationId, 10) : null;
      let resolvedRecipientId = receiverId ? parseInt(receiverId, 10) : null;

      try {
        await client.query('BEGIN');

        let conversation;
        if (targetConversationId) {
          conversation = await fetchConversationById(client, targetConversationId);
          if (!conversation) {
            throw new Error('Konversation nicht gefunden');
          }

          const membership = await client.query(
            `SELECT role FROM message_conversation_members WHERE conversation_id = $1 AND user_id = $2`,
            [targetConversationId, userId]
          );

          if (membership.rows.length === 0) {
            throw new Error('Kein Zugriff auf diese Konversation');
          }

          if (conversation.conversation_type === CONVERSATION_TYPES.DIRECT && !resolvedRecipientId) {
            const otherMember = await client.query(
              `SELECT user_id FROM message_conversation_members WHERE conversation_id = $1 AND user_id <> $2 LIMIT 1`,
              [targetConversationId, userId]
            );
            resolvedRecipientId = otherMember.rows[0]?.user_id || null;
          }
        } else {
          if (!resolvedRecipientId) {
            throw new Error('Empfänger ist erforderlich');
          }

          const recipientResult = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [resolvedRecipientId]
          );

          if (recipientResult.rows.length === 0) {
            throw new Error('Empfänger nicht gefunden');
          }

          conversation = await ensureDirectConversation(client, userId, resolvedRecipientId);
          targetConversationId = conversation.id;
        }

        socket.join(`conversation_${targetConversationId}`);

        const normalizedQuotedId = quotedMessageId ? parseInt(quotedMessageId, 10) : null;
        const uniqueMentions = Array.from(new Set(
          (Array.isArray(mentionedUserIds) ? mentionedUserIds : [])
            .map((id) => parseInt(id, 10))
            .filter((id) => Number.isInteger(id) && id !== userId)
        ));

        const optimisticMessage = {
          id: `temp_${Date.now()}`,
          conversation_id: targetConversationId,
          sender_id: userId,
          receiver_id: resolvedRecipientId,
          message: messageContent,
          message_type: gif ? 'gif' : messageType,
          attachments: attachmentPayload,
          metadata,
          quote: Number.isInteger(normalizedQuotedId) ? { quoted_message_id: normalizedQuotedId } : null,
          reactions: [],
          mentions: [],
          calendar_refs: [],
          task_refs: [],
          sender_name: userInfo.name,
          created_at: new Date().toISOString(),
          read_status: false,
          delivered_status: false,
          isOptimistic: true
        };

        socket.emit('message_sent', optimisticMessage);
        socket.to(`conversation_${targetConversationId}`).emit('conversation:new_message', {
          conversationId: targetConversationId,
          message: optimisticMessage
        });

        const rawMessage = await createMessageRecord(client, {
          senderId: userId,
          conversationId: targetConversationId,
          receiverId: resolvedRecipientId,
          messageContent,
          messageType: gif ? 'gif' : messageType,
          attachments: attachmentPayload,
          metadata,
          quotedMessageId: Number.isInteger(normalizedQuotedId) ? normalizedQuotedId : null,
          mentionedUserIds: uniqueMentions
        });

        await client.query(
          'UPDATE message_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [targetConversationId]
        );

        if (conversation) {
          conversation.updated_at = new Date().toISOString();
        }

        await client.query(
          `UPDATE message_conversation_members
              SET last_read_at = CURRENT_TIMESTAMP
            WHERE conversation_id = $1 AND user_id = $2`,
          [targetConversationId, userId]
        );

        const messageResult = await client.query(
          `SELECT
              m.*,
              sender.name AS sender_name,
              sender.profile_photo AS sender_photo
            FROM messages m
            LEFT JOIN users sender ON m.sender_id = sender.id
           WHERE m.id = $1`,
          [rawMessage.id]
        );

        const membersResult = await client.query(
          `SELECT user_id FROM message_conversation_members WHERE conversation_id = $1`,
          [targetConversationId]
        );

        await client.query('COMMIT');

        const enriched = await enrichMessages(client, messageResult.rows);
        const enrichedMessage = {
          ...(enriched[0] || normalizeMessageRow(messageResult.rows[0])),
          isOptimistic: false
        };

        const memberIds = membersResult.rows.map((row) => row.user_id);

        socket.emit('message_confirmed', {
          tempId: optimisticMessage.id,
          message: enrichedMessage
        });

        socket.to(`conversation_${targetConversationId}`).emit('conversation:message_confirmed', {
          tempId: optimisticMessage.id,
          message: enrichedMessage
        });

        const payload = {
          conversationId: targetConversationId,
          message: enrichedMessage
        };

        memberIds
          .filter((memberId) => memberId !== userId)
          .forEach((memberId) => {
            io.to(`user_${memberId}`).emit('conversation:new_message', payload);

            const preview = messageContent && messageContent.length > 50
              ? `${messageContent.substring(0, 50)}...`
              : (messageContent || 'Neue Nachricht');

            sendNotificationToUser(memberId, {
              title: `${userInfo.name} hat eine neue Nachricht gesendet`,
              message: preview,
              icon: '/favicon.ico',
              tag: `conversation_${targetConversationId}`,
              data: {
                url: '/messages',
                conversationId: targetConversationId,
                messageId: enrichedMessage.id
              }
            });
          });

        uniqueMentions.forEach((mentionedId) => {
          io.to(`user_${mentionedId}`).emit('message:mentioned', {
            messageId: enrichedMessage.id,
            mentionedBy: {
              id: userId,
              name: userInfo.name
            }
          });
        });

        logger.info('Message saved successfully', {
          messageId: enrichedMessage.id,
          senderId: userId,
          conversationId: targetConversationId
        });
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error handling send_message:', error);
        socket.emit('message_error', { error: 'Nachricht konnte nicht verarbeitet werden' });
      } finally {
        client.release();
      }
    });

    socket.on('conversation:join', async ({ conversationId }) => {
      const targetConversationId = parseInt(conversationId, 10);
      if (!targetConversationId) return;

      try {
        const membership = await database.query(
          `SELECT 1 FROM message_conversation_members WHERE conversation_id = $1 AND user_id = $2`,
          [targetConversationId, userId]
        );

        if (membership.rows.length > 0) {
          socket.join(`conversation_${targetConversationId}`);
        }
      } catch (error) {
        logger.error('Failed to join conversation room', { userId, conversationId: targetConversationId, error: error.message });
      }
    });

    socket.on('conversation:leave', ({ conversationId }) => {
      const targetConversationId = parseInt(conversationId, 10);
      if (!targetConversationId) return;
      socket.leave(`conversation_${targetConversationId}`);
    });

    // Handle message read status
    socket.on('mark_as_read', async (data) => {
      try {
        const { messageId } = data;
        const updateResult = await database.query(
          'UPDATE messages SET read_status = true, read_at = CURRENT_TIMESTAMP WHERE id = $1 AND receiver_id = $2',
          [messageId, userId]
        );

        if (updateResult.rowCount === 0) {
          return;
        }

        const senderResult = await database.query(
          'SELECT sender_id FROM messages WHERE id = $1',
          [messageId]
        );

        if (senderResult.rows.length === 0) {
          return;
        }

        const senderConnection = Array.from(activeUsers.entries())
          .find(([id]) => id == senderResult.rows[0].sender_id);

        if (senderConnection) {
          const [, senderData] = senderConnection;
          io.to(senderData.socketId).emit('message_read', {
            messageId,
            readBy: userId
          });
        }
      } catch (error) {
        logger.error('Error handling mark_as_read:', error);
      }
    });

    // Handle typing indicator (enhanced with conversationId support)
    socket.on('typing_start', (data) => {
      const { receiverId, conversationId } = data;

      // Support both direct (receiverId) and conversation-based typing
      if (conversationId) {
        socket.to(`conversation_${conversationId}`).emit('user_typing', {
          userId,
          userName: userInfo.name,
          conversationId
        });
      } else if (receiverId) {
        const receiverConnection = Array.from(activeUsers.entries())
          .find(([id]) => id == receiverId);

        if (receiverConnection) {
          const [, receiverData] = receiverConnection;
          io.to(receiverData.socketId).emit('user_typing', {
            userId,
            userName: userInfo.name
          });
        }
      }
    });

    socket.on('typing_stop', (data) => {
      const { receiverId, conversationId } = data;

      // Support both direct (receiverId) and conversation-based typing
      if (conversationId) {
        socket.to(`conversation_${conversationId}`).emit('user_stopped_typing', {
          userId,
          conversationId
        });
      } else if (receiverId) {
        const receiverConnection = Array.from(activeUsers.entries())
          .find(([id]) => id == receiverId);

        if (receiverConnection) {
          const [, receiverData] = receiverConnection;
          io.to(receiverData.socketId).emit('user_stopped_typing', {
            userId
          });
        }
      }
    });

    // Enhanced typing indicator with conversationId (modern approach)
    socket.on('typing:start', ({ conversationId, userId: typingUserId, userName }) => {
      if (conversationId) {
        io.to(`conversation_${conversationId}`).emit('user:typing', {
          userId: typingUserId || userId,
          userName: userName || userInfo.name,
          conversationId
        });
      }
    });

    socket.on('typing:stop', ({ conversationId, userId: typingUserId }) => {
      if (conversationId) {
        io.to(`conversation_${conversationId}`).emit('user:typing_stop', {
          userId: typingUserId || userId,
          conversationId
        });
      }
    });

    // Handle task real-time events - Enhanced with optimistic updates
    socket.on('task:editing', (data) => {
      const { taskId } = data;
      socket.broadcast.emit('task:user_editing', {
        taskId,
        user: {
          id: userId,
          name: userInfo.name
        }
      });
    });

    socket.on('task:stop_editing', (data) => {
      const { taskId } = data;
      socket.broadcast.emit('task:user_stopped_editing', {
        taskId,
        user: {
          id: userId,
          name: userInfo.name
        }
      });
    });

    // Task CRUD operations with real-time sync
    socket.on('task:create', (data) => {
      const { task } = data;
      const taskWithUser = {
        ...task,
        createdBy: {
          id: userId,
          name: userInfo.name
        },
        timestamp: new Date().toISOString()
      };
      // Broadcast to all users
      io.emit('task:created', taskWithUser);
      logger.info('Task created', { taskId: task.id, userId });
    });

    socket.on('task:update', (data) => {
      const { task } = data;
      const taskWithUser = {
        ...task,
        updatedBy: {
          id: userId,
          name: userInfo.name
        },
        timestamp: new Date().toISOString()
      };
      // Broadcast to all users except sender
      socket.broadcast.emit('task:updated', taskWithUser);
      logger.info('Task updated', { taskId: task.id, userId });
    });

    socket.on('task:delete', (data) => {
      const { taskId } = data;
      // Broadcast to all users
      io.emit('task:deleted', {
        taskId,
        deletedBy: {
          id: userId,
          name: userInfo.name
        },
        timestamp: new Date().toISOString()
      });
      logger.info('Task deleted', { taskId, userId });
    });

    socket.on('task:move', (data) => {
      const { taskId, fromStatus, toStatus, newIndex } = data;
      // Broadcast to all users for instant sync
      socket.broadcast.emit('task:moved', {
        taskId,
        fromStatus,
        toStatus,
        newIndex,
        movedBy: {
          id: userId,
          name: userInfo.name
        },
        timestamp: new Date().toISOString()
      });
      logger.info('Task moved', { taskId, fromStatus, toStatus, userId });
    });

    // Handle group messages (future feature)
    socket.on('join_group', (groupId) => {
      socket.join(`group_${groupId}`);
      logger.info('User joined group', { userId, groupId });
    });

    socket.on('leave_group', (groupId) => {
      socket.leave(`group_${groupId}`);
      logger.info('User left group', { userId, groupId });
    });

    // Handle heartbeat
    socket.on('heartbeat', () => {
      const userData = activeUsers.get(userId);
      if (userData) {
        userData.lastSeen = new Date();
        activeUsers.set(userId, userData);
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      logger.info('User disconnected from WebSocket', {
        userId,
        username: userInfo.name,
        reason
      });

      // Remove user from active users
      activeUsers.delete(userId);

      // Leave user-specific room
      socket.leave(`user_${userId}`);

      // Notify other users about offline status
      socket.broadcast.emit('user_offline', {
        userId,
        lastSeen: new Date()
      });

      setUserOffline(userId).catch((error) => {
        logger.warn('Failed to clear user presence in Redis', { userId, error: error.message });
      });

      emitOnlineUsers();

      // Clean up all event listeners to prevent memory leaks
      socket.removeAllListeners();
    });

    // Error handling
    socket.on('error', (error) => {
      logger.error('Socket error:', { userId, error });
    });
  });

  // Cleanup inactive connections every 5 minutes
  setInterval(() => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    for (const [userId, userData] of activeUsers.entries()) {
      if (userData.lastSeen < fiveMinutesAgo) {
        activeUsers.delete(userId);
        logger.info('Removed inactive user from active users', { userId });
      }
    }
  }, 5 * 60 * 1000);

  logger.info('WebSocket server initialized');
};

// Helper functions to send notifications from other parts of the app
const sendNotificationToUser = (userId, notification) => {
  const userData = activeUsers.get(userId);
  if (userData && io) {
    io.to(userData.socketId).emit('notification', notification);
    io.to(userData.socketId).emit('notification:new', notification);
  }
};

const sendMessageToUser = (userId, event, data) => {
  const userData = activeUsers.get(userId);
  if (userData && io) {
    io.to(userData.socketId).emit(event, data);
  }
};

const getActiveUsers = () => {
  return Array.from(activeUsers.values()).map(user => ({
    userId: user.userInfo.id,
    name: user.userInfo.name,
    lastSeen: user.lastSeen
  }));
};

const getOnlineUsers = () => {
  return Array.from(activeUsers.keys());
};

module.exports = {
  initializeSocket,
  sendNotificationToUser,
  sendMessageToUser,
  getActiveUsers,
  getOnlineUsers,
  getIO: () => io
};
