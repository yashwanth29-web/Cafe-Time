import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const socket = io(SOCKET_URL, {
  autoConnect: false, // Don't connect until we have cafeId/branchId
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity
});

export const connectSocket = (cafeId, branchId = null) => {
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
