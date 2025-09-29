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

    // Handle private message
    socket.on('send_message', async (data) => {
      try {
        const { receiverId, message, messageType = 'text' } = data;

        if (!message || message.trim().length === 0) {
          socket.emit('message_error', { error: 'Message cannot be empty' });
          return;
        }

        // Save message to database
        db.run(
          `INSERT INTO messages (sender_id, receiver_id, message, message_type, is_group, read_status, delivered_status)
           VALUES (?, ?, ?, ?, 0, 0, 1)`,
          [userId, receiverId, message.trim(), messageType],
          function(err) {
            if (err) {
              logger.error('Error saving message:', err);
              socket.emit('message_error', { error: 'Failed to send message' });
              return;
            }

            // Get the complete message with sender info
            db.get(
              `SELECT
                m.id, m.sender_id, m.receiver_id, m.message, m.message_type,
                m.is_group, m.read_status, m.delivered_status, m.created_at,
                sender.name as sender_name, receiver.name as receiver_name
               FROM messages m
               JOIN users sender ON m.sender_id = sender.id
               LEFT JOIN users receiver ON m.receiver_id = receiver.id
               WHERE m.id = ?`,
              [this.lastID],
              (err, messageData) => {
                if (err) {
                  logger.error('Error fetching message:', err);
                  return;
                }

                const formattedMessage = {
                  ...messageData,
                  timestamp: new Date(messageData.created_at).toISOString()
                };

                // Send to sender (confirmation)
                socket.emit('message_sent', formattedMessage);

                // Send to receiver if online
                const receiverConnection = Array.from(activeUsers.entries())
                  .find(([id]) => id == receiverId);

                if (receiverConnection) {
                  const [, receiverData] = receiverConnection;
                  io.to(receiverData.socketId).emit('new_message', formattedMessage);

                  // Send browser notification to receiver if supported
                  io.to(receiverData.socketId).emit('notification', {
                    title: `New message from ${userInfo.name}`,
                    body: message.length > 50 ? message.substring(0, 50) + '...' : message,
                    icon: '/favicon.ico',
                    tag: `message_${this.lastID}`
                  });
                }

                logger.info('Message sent successfully', {
                  messageId: this.lastID,
                  senderId: userId,
                  receiverId
                });
              }
            );
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

module.exports = {
  initializeSocket,
  sendNotificationToUser,
  sendMessageToUser,
  getActiveUsers,
  getIO: () => io
};