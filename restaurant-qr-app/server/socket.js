const { Server } = require('socket.io');

let io;

module.exports = {
  init: (httpServer) => {
    io = new Server(httpServer, {
      cors: {
        origin: [
          "http://localhost:5173", 
          "http://localhost:3000",
          process.env.CLIENT_URL,
          "https://cafe-time-xi.vercel.app",
          "https://cafe-time-d1ffjmio8-yashwanth29-webs-projects.vercel.app",
          "https://cafe-time-git-main-yashwanth29-webs-projects.vercel.app"
        ],
        methods: ["GET", "POST"]
      }
    });

    io.on('connection', (socket) => {
      console.log('New client connected:', socket.id);

      // Clients join rooms based on cafeId and branchId
      socket.on('join_room', ({ cafeId, branchId }) => {
        if (cafeId) {
          const cafeRoom = `cafe_${cafeId}`;
          socket.join(cafeRoom);
          console.log(`Socket ${socket.id} joined room ${cafeRoom}`);
        }
        if (branchId && cafeId) {
          const branchRoom = `branch_${cafeId}_${branchId}`;
          socket.join(branchRoom);
          console.log(`Socket ${socket.id} joined room ${branchRoom}`);
        }
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    return io;
  },
  getIO: () => {
    if (!io) {
      console.warn('Socket.io not initialized. Skipping emission.');
      return null;
    }
    return io;
  }
};
