import { io } from 'socket.io-client';

// VITE_API_URL includes '/api' for Axios; Socket.IO needs the server root
const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');

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
