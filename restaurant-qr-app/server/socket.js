const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Branch = require('./models/Branch');

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
      socket.on('join_room', async ({ cafeId, branchId }) => {
        try {
          if (!cafeId) return;

          // 1. Get token from handshake auth
          const token = socket.handshake.auth?.token;
          let user = null;

          if (token) {
            try {
              const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_cafe_key_12345');
              user = await User.findById(decoded.id);
            } catch (e) {
              // Token invalid or expired
            }
          }

          // 2. Verify target branch status and authorization
          if (branchId) {
            const branch = await Branch.findOne({ branchId, cafeId });
            if (!branch) {
              console.warn(`[SOCKET AUTH] Socket ${socket.id} blocked: branch ${branchId} does not exist under cafe ${cafeId}`);
              return;
            }
            if (!branch.isActive) {
              console.warn(`[SOCKET AUTH] Socket ${socket.id} blocked: branch ${branchId} is inactive`);
              return;
            }

            // If user is authenticated, check branch level permissions
            if (user) {
              const role = (user.role || '').toLowerCase();
              if (role === 'super_admin') {
                // Allowed
              } else if (['manager', 'chef', 'waiter', 'cashier', 'staff'].includes(role)) {
                if (branchId !== user.assignedBranch) {
                  console.warn(`[SOCKET AUTH] Socket ${socket.id} blocked: staff assigned to ${user.assignedBranch} tried to join ${branchId}`);
                  return;
                }
              } else if (['owner', 'admin'].includes(role)) {
                if (cafeId !== user.cafeId) {
                  console.warn(`[SOCKET AUTH] Socket ${socket.id} blocked: owner of ${user.cafeId} tried to join branch for ${cafeId}`);
                  return;
                }
              }
            }

            // Leave any previous branch rooms the socket has joined to prevent data leakage
            const currentRooms = Array.from(socket.rooms);
            currentRooms.forEach(r => {
              if (r.startsWith('branch_') && r !== `branch_${cafeId}_${branchId}`) {
                socket.leave(r);
                console.log(`Socket ${socket.id} left room ${r}`);
              }
            });

            const branchRoom = `branch_${cafeId}_${branchId}`;
            socket.join(branchRoom);
            console.log(`Socket ${socket.id} joined room ${branchRoom}`);
          }

          // 3. Verify cafe-level access permissions
          if (user) {
            const role = (user.role || '').toLowerCase();
            if (role !== 'super_admin' && cafeId !== user.cafeId) {
              console.warn(`[SOCKET AUTH] Socket ${socket.id} blocked: user cafeId ${user.cafeId} does not match requested ${cafeId}`);
              return;
            }
          }

          const cafeRoom = `cafe_${cafeId}`;
          socket.join(cafeRoom);
          console.log(`Socket ${socket.id} joined room ${cafeRoom}`);
        } catch (err) {
          console.error('[SOCKET AUTH] Error handling join_room:', err);
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
