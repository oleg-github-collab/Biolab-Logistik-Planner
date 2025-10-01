import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import io from 'socket.io-client';

const useWebSocket = () => {
  const { token, isAuthenticated } = useAuth();
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);

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

        // Typing indicators
        socket.on('user_typing', (data) => {
          console.log(`${data.userName} is typing...`);
        });

        socket.on('user_stopped_typing', (data) => {
          console.log(`User ${data.userId} stopped typing`);
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
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      setIsConnected(false);
    };
  }, [isAuthenticated, token]);

  // Send message
  const sendMessage = useCallback((receiverId, message, messageType = 'text') => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('send_message', {
        receiverId,
        message,
        messageType
      });
      return true;
    } else {
      console.warn('WebSocket not connected, falling back to HTTP');
      // Fallback to HTTP API
      return sendMessageHttp(receiverId, message);
    }
  }, []);

  // Fallback HTTP message sending
  const sendMessageHttp = async (receiverId, message) => {
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
        // Add to local messages
        setMessages(prev => [...prev, messageData]);
        return true;
      }
      return false;
    } catch (error) {
      console.error('HTTP message send error:', error);
      return false;
    }
  };

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

  return {
    isConnected,
    messages,
    onlineUsers,
    notifications,
    sendMessage,
    markAsRead,
    startTyping,
    stopTyping,
    showNotification,
    requestNotificationPermission
  };
};

export default useWebSocket;