import React, { useState, useEffect } from 'react';
import offlineQueue from '../utils/offlineQueue';

const ConnectionStatus = ({ socket }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isConnected, setIsConnected] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Network status listeners
    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setIsConnected(true);
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 2000);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      setShowBanner(true);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Set initial state
    setIsConnected(socket.connected);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  useEffect(() => {
    // Subscribe to queue changes
    const unsubscribe = offlineQueue.subscribe((queue) => {
      setQueueSize(queue.length);
    });

    // Initial queue size
    setQueueSize(offlineQueue.size());

    return unsubscribe;
  }, []);

  // Process queue when coming back online
  useEffect(() => {
    if (isOnline && isConnected && queueSize > 0) {
      // Give socket time to stabilize
      const timer = setTimeout(() => {
        processOfflineQueue();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isOnline, isConnected, queueSize]);

  const processOfflineQueue = async () => {
    if (!socket) return;

    const results = await offlineQueue.processQueue(async (item) => {
      if (item.type === 'message') {
        return new Promise((resolve, reject) => {
          socket.emit('send_message', item.data, (response) => {
            if (response && response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          });
        });
      } else if (item.type === 'task') {
        return new Promise((resolve, reject) => {
          socket.emit(`task:${item.action}`, item.data, (response) => {
            if (response && response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          });
        });
      }
    });

    if (results.success.length > 0) {
      console.log(`✅ Processed ${results.success.length} offline items`);
    }

    if (results.failed.length > 0) {
      console.warn(`⚠️ Failed to process ${results.failed.length} offline items`);
    }
  };

  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: '📴',
        text: 'Keine Internetverbindung',
        bgColor: 'bg-red-500',
        textColor: 'text-white'
      };
    }

    if (!isConnected) {
      return {
        icon: '🔄',
        text: 'Verbindung wird hergestellt...',
        bgColor: 'bg-yellow-500',
        textColor: 'text-white'
      };
    }

    if (queueSize > 0) {
      return {
        icon: '⏳',
        text: `${queueSize} ausstehende Aktionen`,
        bgColor: 'bg-blue-500',
        textColor: 'text-white'
      };
    }

    return {
      icon: '✅',
      text: 'Verbunden',
      bgColor: 'bg-green-500',
      textColor: 'text-white'
    };
  };

  const status = getStatusInfo();

  // Don't show banner if everything is fine and no queue
  if (isOnline && isConnected && queueSize === 0 && !showBanner) {
    return null;
  }

  return (
    <div
      className={`fixed top-16 left-1/2 transform -translate-x-1/2 z-50 ${
        showBanner ? 'animate-slideInDown' : 'animate-slideOutUp'
      }`}
    >
      <div
        className={`${status.bgColor} ${status.textColor} px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium`}
      >
        <span className="text-lg">{status.icon}</span>
        <span>{status.text}</span>
        {queueSize > 0 && (
          <div className="ml-2 bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">
            {queueSize}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionStatus;
