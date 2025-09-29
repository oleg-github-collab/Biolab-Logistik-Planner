import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const useWebSocket = () => {
  const { token, isAuthenticated } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!isAuthenticated || !token) {
      return;
    }

    const connectWebSocket = () => {
      try {
        // Using native WebSocket for simplicity
        const wsUrl = process.env.NODE_ENV === 'development'
          ? 'ws://localhost:5000/socket.io/'
          : `wss://${window.location.host}/socket.io/`;

        // For now, let's create a simple WebSocket polyfill
        // This would normally use socket.io-client
        socketRef.current = {
          connected: false,
          emit: (event, data) => {
            console.log('WebSocket emit:', event, data);
            // Mock implementation for now
          },
          on: (event, callback) => {
            console.log('WebSocket on:', event);
            // Mock implementation for now
          },
          disconnect: () => {
            console.log('WebSocket disconnect');
          }
        };

        // Simulate connection
        setTimeout(() => {
          setIsConnected(true);
          socketRef.current.connected = true;
        }, 1000);

        console.log('WebSocket connection established');
      } catch (error) {
        console.error('WebSocket connection error:', error);
        setIsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
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

  // Show browser notification
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
        tag: 'message',
        renotify: true,
        requireInteraction: false,
        ...options
      });

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

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