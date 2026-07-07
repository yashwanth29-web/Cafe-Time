import { io } from 'socket.io-client';

// Determine Socket URL dynamically based on environment or window location
const getSocketUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl.replace(/\/api\/?$/, '');
  
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return window.location.origin;
  }
  return `http://${window.location.hostname}:5000`;
};

const SOCKET_URL = getSocketUrl();

const socket = io(SOCKET_URL, {
  autoConnect: false, // Don't connect until we have cafeId/branchId
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity
});

export const connectSocket = (cafeId, branchId = null) => {
  const token = localStorage.getItem('token');
  socket.auth = { token };
  if (!socket.connected) {
    socket.connect();
  }
  socket.emit('join_room', { cafeId, branchId });
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

export default socket;
