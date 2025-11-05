import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import io from 'socket.io-client';

const useWebSocket = () => {
  const auth = useAuth();
  const token = auth?.token;
  const isAuthenticated = auth?.isAuthenticated;
  const socketRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [taskEvents, setTaskEvents] = useState([]);
  const [adminEvents, setAdminEvents] = useState([]);
  const taskEventHandlersRef = useRef(new Map());
  const conversationEventHandlersRef = useRef(new Map());
  const adminEventHandlersRef = useRef(new Map());

  // Initialize WebSocket connection with auto-reconnect
  useEffect(() => {
    if (!isAuthenticated || !token) {
      return;
    }

    const connectWebSocket = () => {
      try {
        const wsUrl = process.env.NODE_ENV === 'development'
          ? 'http://localhost:5000'
          : window.location.origin;

        // Create socket.io connection
        const socket = io(wsUrl, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000
        });

        // Connection successful
        socket.on('connect', () => {
          console.log('WebSocket connected successfully');
          setIsConnected(true);
          reconnectAttemptsRef.current = 0;

          // Send heartbeat every 30 seconds
          const heartbeatInterval = setInterval(() => {
            if (socket.connected) {
              socket.emit('heartbeat');
            }
          }, 30000);

          socket.heartbeatInterval = heartbeatInterval;
        });

        // Connection error
        socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          setIsConnected(false);
          reconnectAttemptsRef.current++;

          // Exponential backoff for reconnection
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
        });

        // Disconnection
        socket.on('disconnect', (reason) => {
          console.log('WebSocket disconnected:', reason);
          setIsConnected(false);

          if (socket.heartbeatInterval) {
            clearInterval(socket.heartbeatInterval);
          }
        });

        // Online users list
        socket.on('online_users', (users) => {
          setOnlineUsers(users);
        });

        // User online notification
        socket.on('user_online', (data) => {
          setOnlineUsers(prev => [...prev.filter(u => u.userId !== data.userId), data]);
        });

        // User offline notification
        socket.on('user_offline', (data) => {
          setOnlineUsers(prev => prev.filter(u => u.userId !== data.userId));
        });

        // New message received
        socket.on('new_message', (message) => {
          setMessages(prev => {
            // Avoid duplicates
            if (prev.find(m => m.id === message.id)) {
              return prev;
            }
            return [...prev, message];
          });
        });

        // Message sent confirmation
        socket.on('message_sent', (message) => {
          setMessages(prev => {
            // Avoid duplicates
            if (prev.find(m => m.id === message.id)) {
              return prev;
            }
            return [...prev, message];
          });
        });

        // Message read notification
        socket.on('message_read', ({ messageId, readBy }) => {
          setMessages(prev => prev.map(msg =>
            msg.id === messageId ? { ...msg, read_status: 1 } : msg
          ));
        });

        // Browser notification
        socket.on('notification', (notification) => {
          setNotifications(prev => [...prev, { ...notification, timestamp: Date.now() }]);
        });

        socket.on('admin:broadcast', (payload) => {
          const enriched = {
            type: 'broadcast',
            timestamp: new Date().toISOString(),
            ...payload
          };
          setAdminEvents(prev => [...prev, enriched]);
          const handlers = adminEventHandlersRef.current.get('broadcast');
          if (handlers) {
            handlers.forEach(handler => handler(enriched));
          }
        });

        socket.on('admin:audit_log', (payload) => {
          const entry = {
            ...payload,
            type: 'audit_log'
          };
          setAdminEvents(prev => [...prev, entry]);
          const handlers = adminEventHandlersRef.current.get('audit_log');
          if (handlers) {
            handlers.forEach(handler => handler(entry));
          }
        });

        // Typing indicators
        socket.on('user_typing', (data) => {
          console.log(`${data.userName} is typing...`);
        });

        socket.on('user_stopped_typing', (data) => {
          console.log(`User ${data.userId} stopped typing`);
        });

        // Task events
        socket.on('task:created', (data) => {
          setTaskEvents(prev => [...prev, { type: 'created', ...data, timestamp: Date.now() }]);
          // Trigger registered handlers
          const handlers = taskEventHandlersRef.current.get('task:created');
          if (handlers) {
            handlers.forEach(handler => handler(data));
          }
        });

        socket.on('task:updated', (data) => {
          setTaskEvents(prev => [...prev, { type: 'updated', ...data, timestamp: Date.now() }]);
          // Trigger registered handlers
          const handlers = taskEventHandlersRef.current.get('task:updated');
          if (handlers) {
            handlers.forEach(handler => handler(data));
          }
        });

        socket.on('task:moved', (data) => {
          setTaskEvents(prev => [...prev, { type: 'moved', ...data, timestamp: Date.now() }]);
          // Trigger registered handlers
          const handlers = taskEventHandlersRef.current.get('task:moved');
          if (handlers) {
            handlers.forEach(handler => handler(data));
          }
        });

        socket.on('task:deleted', (data) => {
          setTaskEvents(prev => [...prev, { type: 'deleted', ...data, timestamp: Date.now() }]);
          // Trigger registered handlers
          const handlers = taskEventHandlersRef.current.get('task:deleted');
          if (handlers) {
            handlers.forEach(handler => handler(data));
          }
        });

        socket.on('task:user_editing', (data) => {
          // Trigger registered handlers
          const handlers = taskEventHandlersRef.current.get('task:user_editing');
          if (handlers) {
            handlers.forEach(handler => handler(data));
          }
        });

        socket.on('task:user_stopped_editing', (data) => {
          // Trigger registered handlers
          const handlers = taskEventHandlersRef.current.get('task:user_stopped_editing');
          if (handlers) {
            handlers.forEach(handler => handler(data));
          }
        });

        const emitConversationEvent = (eventType, payload) => {
          const handlers = conversationEventHandlersRef.current.get(eventType);
          if (handlers) {
            handlers.forEach(handler => handler(payload));
          }
        };

        socket.on('conversation:new_message', (payload) => {
          emitConversationEvent('conversation:new_message', payload);
        });

        socket.on('conversation:message_confirmed', (payload) => {
          emitConversationEvent('conversation:message_confirmed', payload);
        });

        socket.on('conversation:members_updated', (payload) => {
          emitConversationEvent('conversation:members_updated', payload);
        });

        socket.on('conversation:created', (payload) => {
          emitConversationEvent('conversation:created', payload);
        });

        socket.on('conversation:removed', (payload) => {
          emitConversationEvent('conversation:removed', payload);
        });

        socket.on('message:reaction', (payload) => {
          emitConversationEvent('message:reaction', payload);
        });

        socket.on('message:mentioned', (payload) => {
          emitConversationEvent('message:mentioned', payload);
        });

        socketRef.current = socket;
      } catch (error) {
        console.error('WebSocket setup error:', error);
        setIsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      if (socketRef.current) {
        if (socketRef.current.heartbeatInterval) {
          clearInterval(socketRef.current.heartbeatInterval);
        }
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, [isAuthenticated, token]);

  // Fallback HTTP message sending
  const sendMessageHttp = useCallback(async (receiverId, message) => {
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receiverId,
          message,
          isGroup: false
        })
      });

      if (response.ok) {
        const messageData = await response.json();
        setMessages(prev => [...prev, messageData]);
        return true;
      }
      return false;
    } catch (error) {
      console.error('HTTP message send error:', error);
      return false;
    }
  }, [token]);

  // Send message
  const sendMessage = useCallback((receiverId, message, messageType = 'text') => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('send_message', {
        receiverId,
        message,
        messageType
      });
      return true;
    }

    console.warn('WebSocket not connected, falling back to HTTP');
    return sendMessageHttp(receiverId, message);
  }, [sendMessageHttp]);

  // Mark message as read
  const markAsRead = useCallback((messageId) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('mark_as_read', { messageId });
    }
  }, []);

  // Start typing
  const startTyping = useCallback((receiverId) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('typing_start', { receiverId });
    }
  }, []);

  // Stop typing
  const stopTyping = useCallback((receiverId) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('typing_stop', { receiverId });
    }
  }, []);

  // Show browser notification with enhanced styling and functionality
  const showNotification = useCallback(async (title, body, options = {}) => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    let permission = Notification.permission;

    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: options.tag || 'biolab-notification',
        renotify: true,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
        vibrate: [200, 100, 200],
        data: options.data || {},
        ...options
      });

      // Add click handler
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        notification.close();

        // Navigate to relevant page if data provided
        if (options.data?.url) {
          window.location.href = options.data.url;
        }
      };

      // Auto-close after specified time (default 7 seconds)
      const closeDelay = options.autoClose !== false ? (options.autoCloseDelay || 7000) : null;
      if (closeDelay) {
        setTimeout(() => {
          notification.close();
        }, closeDelay);
      }

      return true;
    }

    return false;
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, []);

  // Register task event handler
  const onTaskEvent = useCallback((eventType, handler) => {
    if (!taskEventHandlersRef.current.has(eventType)) {
      taskEventHandlersRef.current.set(eventType, new Set());
    }
    taskEventHandlersRef.current.get(eventType).add(handler);

    // Return cleanup function
    return () => {
      const handlers = taskEventHandlersRef.current.get(eventType);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }, []);

  const onConversationEvent = useCallback((eventType, handler) => {
    if (!conversationEventHandlersRef.current.has(eventType)) {
      conversationEventHandlersRef.current.set(eventType, new Set());
    }
    conversationEventHandlersRef.current.get(eventType).add(handler);

    return () => {
      const handlers = conversationEventHandlersRef.current.get(eventType);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }, []);

  const onAdminEvent = useCallback((eventType, handler) => {
    if (!adminEventHandlersRef.current.has(eventType)) {
      adminEventHandlersRef.current.set(eventType, new Set());
    }
    adminEventHandlersRef.current.get(eventType).add(handler);

    return () => {
      const handlers = adminEventHandlersRef.current.get(eventType);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }, []);

  const joinConversationRoom = useCallback((conversationId) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('conversation:join', { conversationId });
    }
  }, []);

  const leaveConversationRoom = useCallback((conversationId) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('conversation:leave', { conversationId });
    }
  }, []);

  const sendConversationMessage = useCallback((payload) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('send_message', payload);
      return true;
    }
    return false;
  }, []);

  // Emit task editing status
  const emitTaskEditing = useCallback((taskId) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('task:editing', { taskId });
    }
  }, []);

  const emitTaskStopEditing = useCallback((taskId) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('task:stop_editing', { taskId });
    }
  }, []);

  return {
    isConnected,
    messages,
    onlineUsers,
    notifications,
    taskEvents,
    adminEvents,
    sendMessage,
    markAsRead,
    startTyping,
    stopTyping,
    showNotification,
    requestNotificationPermission,
    onTaskEvent,
    onConversationEvent,
    onAdminEvent,
    emitTaskEditing,
    emitTaskStopEditing,
    joinConversationRoom,
    leaveConversationRoom,
    sendConversationMessage
  };
};

export default useWebSocket;
