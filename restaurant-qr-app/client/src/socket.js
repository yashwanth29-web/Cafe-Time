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
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
  transports: ['websocket', 'polling'] // Support both transports to allow graceful fallback when WebSocket drops
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
  if (isDev) {
    console.warn('[SOCKET] Disconnected:', reason);
  }
  if (reason === 'io server disconnect') {
    // If the server disconnected us, connect again manually
    socket.connect();
  }
});

socket.on('connect_error', (error) => {
  if (isDev) {
    console.error('[SOCKET] Connection Error:', error.message);
  }
});

export const connectSocket = (cafeId, branchId = null) => {
  const token = localStorage.getItem('token');
  socket.auth = { token };

  const previousBranch = currentRoomContext.branchId;
  const isSameContext = currentRoomContext.cafeId === cafeId && currentRoomContext.branchId === branchId;
  currentRoomContext = { cafeId, branchId };

  if (!socket.connected) {
    socket.connect();
  } else if (!isSameContext) {
    // If already connected and the branch has switched, tell the server to leave the previous branch rooms
    if (previousBranch && previousBranch !== branchId) {
      if (isDev) {
        console.log(`[SOCKET] Branch changed from ${previousBranch} to ${branchId}. Leaving old rooms...`);
      }
      socket.emit('leave_branch_rooms', { cafeId, branchId: previousBranch });
    }
    socket.emit('join_room', currentRoomContext);
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
  currentRoomContext = { cafeId: null, branchId: null };
};

export default socket;

