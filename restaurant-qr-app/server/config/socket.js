const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io = null;

const parseCookies = (cookieHeader) => {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return list;
};

const initializeSocket = (server) => {
  const isDev = process.env.NODE_ENV === 'development';

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // Allow all origins dynamically to support local network devices (tablets, mobiles)
        callback(null, true);
      },
      credentials: true
    },
    transports: ['websocket', 'polling'], // Support standard websocket upgrades
    pingInterval: 10000,                  // Heartbeat every 10s to keep cloud proxies (Railway/Render) alive
    pingTimeout: 5000                     // Close connection if no reply within 5s
  });

  // Socket.IO Handshake Authentication Middleware
  io.use(async (socket, next) => {
    let token = null;

    // 1. Check handshake authorization header
    if (socket.handshake.headers.authorization) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      } else {
        token = authHeader;
      }
    }

    // 2. Check cookies
    if (!token && socket.handshake.headers.cookie) {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      token = cookies.token;
    }

    // 3. Check auth object
    if (!token && socket.handshake.auth && socket.handshake.auth.token) {
      token = socket.handshake.auth.token;
    }

    // 4. Check query parameters
    if (!token && socket.handshake.query && socket.handshake.query.token) {
      token = socket.handshake.query.token;
    }

    if (!token) {
      // Connect as customer (anonymous) - don't fail handshake
      if (isDev) {
        console.log(`[SOCKET] Anonymous customer connection: ${socket.id}`);
      }
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_cafe_key_12345');
      const user = await User.findById(decoded.id).lean();
      
      if (!user) {
        console.warn(`[SOCKET] User in token not found: ${decoded.id}`);
        return next();
      }

      if (!user.isActive) {
        console.warn(`[SOCKET] Inactive user tried to connect: ${user.name}`);
        return next();
      }

      // Attach verified user to socket
      socket.user = user;
      if (isDev) {
        console.log(`[SOCKET] Authenticated user connected: ${user.name} (${user.role}) - Socket: ${socket.id}`);
      }
      next();
    } catch (err) {
      console.error('[SOCKET] Token verification failed:', err.message);
      // Fallback to anonymous customer
      next();
    }
  });

  io.on('connection', async (socket) => {
    if (isDev) {
      console.log(`[SOCKET] Connection established: ${socket.id}`);
    }

    // If authenticated, join authorized rooms based on DB user profile (Never trust client input)
    if (socket.user) {
      const cafeId = socket.user.cafeId || 'CD001';
      const branchId = socket.user.assignedBranch ? String(socket.user.assignedBranch) : '';
      const role = (socket.user.role || '').toLowerCase();

      // Join Cafe Room
      socket.join(`cafe:${cafeId}`);
      if (isDev) {
        console.log(`[SOCKET] Socket ${socket.id} joined room cafe:${cafeId} | Cafe: ${cafeId}`);
      }

      // Join Branch Room (strictly isolated with cafeId context)
      if (branchId) {
        try {
          const Branch = require('../models/Branch');
          const mongoose = require('mongoose');
          
          let branchCode = branchId;
          // If the branchId is a Mongoose ObjectId, resolve it to the string code
          if (mongoose.isValidObjectId(branchId)) {
            const resolvedBranch = await Branch.findById(branchId).lean();
            if (resolvedBranch) {
              branchCode = resolvedBranch.branchId;
            }
          }
          
          if (branchCode) {
            socket.join(`cafe:${cafeId}:branch:${branchCode}`);
            socket.join(`branch_${cafeId}_${branchCode}`);
            if (isDev) {
              console.log(`[SOCKET] Socket ${socket.id} joined rooms cafe:${cafeId}:branch:${branchCode} and branch_${cafeId}_${branchCode}`);
            }
          }
        } catch (branchErr) {
          console.error('[SOCKET] Error resolving branch room code:', branchErr.message);
          // Fallback to isolated raw string join
          socket.join(`cafe:${cafeId}:branch:${branchId}`);
          socket.join(`branch_${cafeId}_${branchId}`);
        }
      }

      // Join Role Room
      if (role) {
        socket.join(`role:${role}`);
        if (isDev) {
          console.log(`[SOCKET] Socket ${socket.id} joined room role:${role} | Role: ${role}`);
        }
      }

      // Join Cafe Owner Room
      if (role === 'owner') {
        socket.join(`cafe:${cafeId}:owner`);
        socket.join(`cafe_${cafeId}_owner`);
        if (isDev) {
          console.log(`[SOCKET] Socket ${socket.id} joined room cafe:${cafeId}:owner`);
        }
      }
    }

    // Support client join_room event for anonymous customers and staff switches
    socket.on('join_room', async ({ cafeId, branchId }) => {
      try {
        if (!cafeId) return;
        const targetCafe = cafeId || 'CD001';
        const targetBranch = branchId || 'default';

        // Join Cafe Rooms
        socket.join(`cafe:${targetCafe}`);
        socket.join(`cafe_${targetCafe}`);

        // Join Branch Rooms (strictly isolated with cafeId)
        socket.join(`cafe:${targetCafe}:branch:${targetBranch}`);
        socket.join(`branch_${targetCafe}_${targetBranch}`);

        if (isDev) {
          console.log(`[SOCKET] Socket ${socket.id} joined rooms cafe:${targetCafe}:branch:${targetBranch} and branch_${targetCafe}_${targetBranch}`);
        }
      } catch (err) {
        console.error('[SOCKET] join_room error:', err.message);
      }
    });

    // Support client leave_branch_rooms event on branch switches
    socket.on('leave_branch_rooms', async ({ cafeId, branchId }) => {
      try {
        const targetCafe = cafeId || 'CD001';
        if (branchId) {
          socket.leave(`cafe:${targetCafe}:branch:${branchId}`);
          socket.leave(`branch_${targetCafe}_${branchId}`);
          if (isDev) {
            console.log(`[SOCKET] Socket ${socket.id} left rooms for branch:${targetCafe}:${branchId}`);
          }
        }
      } catch (err) {
        console.error('[SOCKET] leave_branch_rooms error:', err.message);
      }
    });

    // Allow customers to request tracking for a specific order.
    socket.on('trackOrder', async ({ orderId }) => {
      try {
        const Order = require('../models/Order');
        const mongoose = require('mongoose');

        if (!orderId || !mongoose.isValidObjectId(orderId)) {
          console.warn(`[SOCKET] Socket ${socket.id} requested invalid orderId: ${orderId}`);
          return socket.emit('error_message', { message: 'Invalid order ID' });
        }

        const order = await Order.findById(orderId).lean();
        if (!order) {
          console.warn(`[SOCKET] Socket ${socket.id} requested non-existent order: ${orderId}`);
          return socket.emit('error_message', { message: 'Order not found' });
        }

        socket.join(`order:${orderId}`);
        socket.join(`order_${orderId}`);
        if (isDev) {
          console.log(`[SOCKET] Socket ${socket.id} joined room order:${orderId} (Customer tracking)`);
        }
        socket.emit('tracking_confirmed', { orderId });
      } catch (err) {
        console.error('[SOCKET] Error joining order room:', err);
      }
    });

    socket.on('disconnect', (reason) => {
      if (isDev) {
        console.log(`[SOCKET] Socket disconnected: ${socket.id} | Reason: ${reason}`);
      }
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call initializeSocket(server) first.');
  }
  return io;
};

module.exports = {
  initializeSocket,
  getIO
};
