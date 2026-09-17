import { io } from 'socket.io-client';

// Determine Socket URL dynamically based on environment or window location
const getSocketUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  
  // If we are in production or accessed via non-localhost, dynamically match the window origin
  // and ignore localhost-bound compile-time configurations
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl.replace(/\/api\/?$/, '');
    }
    return window.location.origin;
  }

  if (envUrl) return envUrl.replace(/\/api\/?$/, '');
  return `http://${window.location.hostname}:5000`;
};

const SOCKET_URL = getSocketUrl();
const isDev = import.meta.env.DEV;

const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
  reconnectionAttempts: Infinity,
  timeout: 10000,
  transports: ['websocket', 'polling'] // Instant WebSocket first for sub-millisecond sync
});

// Cache for room tracking
let currentRoomContext = { cafeId: null, branchId: null };

// Auto re-join rooms on reconnect
socket.on('connect', () => {
  if (isDev) {
    console.log('[SOCKET] Connected to real-time sync layer. Socket ID:', socket.id);
  }
  if (currentRoomContext.cafeId) {
    socket.emit('join_room', currentRoomContext);
  }
});

socket.on('disconnect', (reason) => {
  // Only log unexpected server-initiated drops, ignore expected transport closes during dev reload
  if (isDev && reason !== 'transport close') {
    console.warn('[SOCKET] Disconnected:', reason);
  }
  if (reason === 'io server disconnect') {
    socket.connect();
  }
});

socket.on('connect_error', (error) => {
  // Suppress dev-mode console spam for transient reconnections
  if (isDev && error.message !== 'xhr poll error' && error.message !== 'websocket error') {
    console.warn('[SOCKET] Reconnecting real-time sync:', error.message);
  }
});

export const connectSocket = (cafeId, branchId = null) => {
  if (!cafeId) return;

  const token = localStorage.getItem('token');
  socket.auth = { token };

  const normBranch = (branchId === 'all' || !branchId) ? null : branchId;
  const previousBranch = currentRoomContext.branchId;
  const isSameContext = currentRoomContext.cafeId === cafeId && currentRoomContext.branchId === normBranch;
  currentRoomContext = { cafeId, branchId: normBranch };

  if (socket.connected) {
    if (!isSameContext) {
      if (previousBranch && previousBranch !== normBranch) {
        if (isDev) {
          console.log(`[SOCKET] Branch changed from ${previousBranch} to ${normBranch}. Leaving old rooms...`);
        }
        socket.emit('leave_branch_rooms', { cafeId, branchId: previousBranch });
      }
      socket.emit('join_room', currentRoomContext);
    }
  } else if (!socket.active) {
    // Only connect if not already connected or in an active reconnect loop
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected || socket.active) {
    socket.disconnect();
  }
  currentRoomContext = { cafeId: null, branchId: null };
};

export default socket;

