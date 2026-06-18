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
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // Allow all origins dynamically to support local network devices (tablets, mobiles)
        callback(null, true);
      },
      credentials: true
    }
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
      console.log(`[SOCKET] Anonymous customer connection: ${socket.id}`);
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
      console.log(`[SOCKET] Authenticated user connected: ${user.name} (${user.role}) - Socket: ${socket.id}`);
      next();
    } catch (err) {
      console.error('[SOCKET] Token verification failed:', err.message);
      // Fallback to anonymous customer
      next();
    }
  });

  io.on('connection', async (socket) => {
    console.log(`[SOCKET] Connection established: ${socket.id}`);

    // If authenticated, join authorized rooms based on DB user profile (Never trust client input)
    if (socket.user) {
      const cafeId = socket.user.cafeId || 'CD001';
      const branchId = socket.user.assignedBranch ? String(socket.user.assignedBranch) : '';
      const role = (socket.user.role || '').toLowerCase();

      // Join Cafe Room
      socket.join(`cafe:${cafeId}`);
      console.log(`[SOCKET] Socket ${socket.id} joined room cafe:${cafeId} | Cafe: ${cafeId}`);

      // Join Branch Room (standardized on Branch Code string, e.g. branch:BR002)
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
            socket.join(`branch:${branchCode}`);
            console.log(`[SOCKET] Socket ${socket.id} joined room branch:${branchCode} | Standardized Branch Code: ${branchCode}`);
          }
        } catch (branchErr) {
          console.error('[SOCKET] Error resolving branch room code:', branchErr.message);
          // Fallback to raw string join
          socket.join(`branch:${branchId}`);
        }
      }

      // Join Role Room
      if (role) {
        socket.join(`role:${role}`);
        console.log(`[SOCKET] Socket ${socket.id} joined room role:${role} | Role: ${role}`);
      }

      // Join Cafe Owner Room
      if (role === 'owner') {
        socket.join(`cafe:${cafeId}:owner`);
        console.log(`[SOCKET] Socket ${socket.id} joined room cafe:${cafeId}:owner`);
      }
    }

    // Allow customers to request tracking for a specific order.
    // The server verifies the order exists in the DB before joining to prevent arbitrary room selection.
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
        console.log(`[SOCKET] Socket ${socket.id} joined room order:${orderId} (Customer tracking)`);
        socket.emit('tracking_confirmed', { orderId });
      } catch (err) {
        console.error('[SOCKET] Error joining order room:', err);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[SOCKET] Socket disconnected: ${socket.id} | Reason: ${reason}`);
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
