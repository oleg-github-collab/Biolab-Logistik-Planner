const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('./database');
const logger = require('./utils/logger');

let io;

// Active users tracking
const activeUsers = new Map(); // userId -> {socketId, userInfo, lastSeen}

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: ["http://localhost:3000", "http://localhost:5000"],
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'biolab-logistik-secret-key');

      // Get user info from database
      db.get(
        "SELECT id, name, email, role FROM users WHERE id = ?",
        [decoded.user.id],
        (err, user) => {
          if (err || !user) {
            return next(new Error('User not found'));
          }

          socket.userId = user.id;
          socket.userInfo = user;
          next();
        }
      );
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

    // Join user-specific room
    socket.join(`user_${userId}`);

    // Notify other users about online status
    socket.broadcast.emit('user_online', {
      userId,
      userInfo: { id: userInfo.id, name: userInfo.name }
    });

    // Send current online users
    socket.emit('online_users', Array.from(activeUsers.values()).map(user => ({
      userId: user.userInfo.id,
      name: user.userInfo.name,
      lastSeen: user.lastSeen
    })));

    // Handle private message - Optimized for instant delivery
    socket.on('send_message', async (data) => {
      try {
        const { receiverId, message, messageType = 'text' } = data;

        if (!message || message.trim().length === 0) {
          socket.emit('message_error', { error: 'Message cannot be empty' });
          return;
        }

        const receiverConnection = Array.from(activeUsers.entries())
          .find(([id]) => id == receiverId);

        // Prepare optimistic message for instant UI update
        const optimisticMessage = {
          id: 'temp_' + Date.now(),
          sender_id: userId,
          receiver_id: receiverId,
          message: message.trim(),
          message_type: messageType,
          sender_name: userInfo.name,
          created_at: new Date().toISOString(),
          read_status: 0,
          delivered_status: receiverConnection ? 1 : 0,
          isOptimistic: true
        };

        // Send immediate confirmation to sender (optimistic update)
        socket.emit('message_sent', optimisticMessage);

        // Send to receiver instantly if online (before DB save)
        if (receiverConnection) {
          const [, receiverData] = receiverConnection;
          io.to(receiverData.socketId).emit('new_message', optimisticMessage);
        }

        // Save to database asynchronously
        db.run(
          `INSERT INTO messages (sender_id, receiver_id, message, message_type, is_group, read_status, delivered_status)
           VALUES (?, ?, ?, ?, 0, 0, ?)`,
          [userId, receiverId, message.trim(), messageType, receiverConnection ? 1 : 0],
          function(err) {
            if (err) {
              logger.error('Error saving message:', err);
              socket.emit('message_error', {
                error: 'Failed to send message',
                tempId: optimisticMessage.id
              });
              // Notify receiver to remove optimistic message
              if (receiverConnection) {
                const [, receiverData] = receiverConnection;
                io.to(receiverData.socketId).emit('message_failed', {
                  tempId: optimisticMessage.id
                });
              }
              return;
            }

            const messageId = this.lastID;

            // Update with real ID
            const confirmedMessage = {
              ...optimisticMessage,
              id: messageId,
              isOptimistic: false
            };

            // Send real ID update to both parties
            socket.emit('message_confirmed', {
              tempId: optimisticMessage.id,
              message: confirmedMessage
            });

            if (receiverConnection) {
              const [, receiverData] = receiverConnection;
              io.to(receiverData.socketId).emit('message_confirmed', {
                tempId: optimisticMessage.id,
                message: confirmedMessage
              });

              // Send enhanced browser notification to receiver
              const messagePreview = message.length > 50 ? message.substring(0, 50) + '...' : message;
              io.to(receiverData.socketId).emit('notification', {
                type: 'new_message',
                title: `Neue Nachricht von ${userInfo.name}`,
                body: messagePreview,
                icon: '/favicon.ico',
                tag: `message_${messageId}`,
                timestamp: new Date().toISOString(),
                data: {
                  messageId,
                  senderId: userId,
                  senderName: userInfo.name,
                  messagePreview,
                  messageType,
                  url: '/messages'
                }
              });
            }

            logger.info('Message saved successfully', {
              messageId,
              senderId: userId,
              receiverId,
              deliveryTime: Date.now() - new Date(optimisticMessage.created_at).getTime()
            });
          }
        );
      } catch (error) {
        logger.error('Error handling send_message:', error);
        socket.emit('message_error', { error: 'Failed to send message' });
      }
    });

    // Handle message read status
    socket.on('mark_as_read', async (data) => {
      try {
        const { messageId } = data;

        db.run(
          "UPDATE messages SET read_status = 1 WHERE id = ? AND receiver_id = ?",
          [messageId, userId],
          function(err) {
            if (err) {
              logger.error('Error marking message as read:', err);
              return;
            }

            // Notify sender that message was read
            db.get(
              "SELECT sender_id FROM messages WHERE id = ?",
              [messageId],
              (err, result) => {
                if (!err && result) {
                  const senderConnection = Array.from(activeUsers.entries())
                    .find(([id]) => id == result.sender_id);

                  if (senderConnection) {
                    const [, senderData] = senderConnection;
                    io.to(senderData.socketId).emit('message_read', {
                      messageId,
                      readBy: userId
                    });
                  }
                }
              }
            );
          }
        );
      } catch (error) {
        logger.error('Error handling mark_as_read:', error);
      }
    });

    // Handle typing indicator
    socket.on('typing_start', (data) => {
      const { receiverId } = data;
      const receiverConnection = Array.from(activeUsers.entries())
        .find(([id]) => id == receiverId);

      if (receiverConnection) {
        const [, receiverData] = receiverConnection;
        io.to(receiverData.socketId).emit('user_typing', {
          userId,
          userName: userInfo.name
        });
      }
    });

    socket.on('typing_stop', (data) => {
      const { receiverId } = data;
      const receiverConnection = Array.from(activeUsers.entries())
        .find(([id]) => id == receiverId);

      if (receiverConnection) {
        const [, receiverData] = receiverConnection;
        io.to(receiverData.socketId).emit('user_stopped_typing', {
          userId
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

      // Notify other users about offline status
      socket.broadcast.emit('user_offline', {
        userId,
        lastSeen: new Date()
      });
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