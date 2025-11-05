import React, { createContext, useContext, useMemo } from 'react';
import useWebSocket from '../hooks/useWebSocket';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const socketValue = useWebSocket();

  const memoizedValue = useMemo(() => socketValue, [socketValue]);

  return (
    <WebSocketContext.Provider value={memoizedValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};

export default WebSocketContext;
