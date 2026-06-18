import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000'
  : window.location.origin;

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    console.log('[SOCKET] Connecting to Socket.IO server:', SOCKET_URL);
    const socket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[SOCKET] Connected to server. Socket ID:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('[SOCKET] Disconnected from server. Reason:', reason);
      setIsConnected(false);
    });

    socket.io.on('reconnect', (attempt) => {
      console.log('[SOCKET] Socket reconnected on attempt:', attempt);
      setReconnectTrigger(prev => prev + 1); // Trigger REST sync on dashboards
    });

    return () => {
      console.log('[SOCKET] Cleaning up socket connection:', socket.id);
      socket.off();
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [user?._id]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected, reconnectTrigger }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;
