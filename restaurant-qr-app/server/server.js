process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message, err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

const express = require('express');
const http = require('http');
const dotenv = require('dotenv');
const path = require('path');
const { initializeSocket } = require('./config/socket');

// Trigger nodemon restart 4
// Load environment variables immediately before routing imports
dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });

const mongoose = require('mongoose');
const multiBranchPlugin = require('./utils/multiBranchPlugin');
mongoose.plugin(multiBranchPlugin);

const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const orderRoutes = require('./routes/orderRoutes');
const menuRoutes = require('./routes/menuRoutes');
const authRoutes = require('./routes/authRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const adminRoutes = require('./routes/adminRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const workReportRoutes = require('./routes/workReportRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const cafeRoutes = require('./routes/cafeRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const payrollRoutes = require('./routes/payrollRoutes');

// Create Express instance
const app = express();

// Enable compression and profiling middleware
const compression = require('compression');
const { AsyncLocalStorage } = require('async_hooks');

const requestStore = new AsyncLocalStorage();

// Monkeypatch mongoose Query execution to measure DB read time
const originalExec = mongoose.Query.prototype.exec;
mongoose.Query.prototype.exec = async function(...args) {
  const store = requestStore.getStore();
  if (!store) return originalExec.apply(this, args);
  
  const start = process.hrtime();
  try {
    return await originalExec.apply(this, args);
  } finally {
    const diff = process.hrtime(start);
    const ms = diff[0] * 1000 + diff[1] / 1e6;
    store.dbTime += ms;
  }
};

// Monkeypatch mongoose Model save execution to measure DB write time
const originalSave = mongoose.Model.prototype.save;
mongoose.Model.prototype.save = async function(...args) {
  const store = requestStore.getStore();
  if (!store) return originalSave.apply(this, args);
  
  const start = process.hrtime();
  try {
    return await originalSave.apply(this, args);
  } finally {
    const diff = process.hrtime(start);
    const ms = diff[0] * 1000 + diff[1] / 1e6;
    store.dbTime += ms;
  }
};

// Enable Gzip Compression for API responses (excludes static assets/images)
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// API Response Profiler Middleware
app.use((req, res, next) => {
  const start = process.hrtime();
  const store = { dbTime: 0 };
  
  requestStore.run(store, () => {
    res.on('finish', () => {
      const duration = process.hrtime(start);
      const totalMs = duration[0] * 1000 + duration[1] / 1e6;
      const dbMs = store.dbTime;
      const controllerMs = Math.max(0, totalMs - dbMs);
      
      if (totalMs > 200) {
        console.warn(`[SLOW API] ${req.method} ${req.originalUrl} - Total: ${totalMs.toFixed(2)}ms | DB: ${dbMs.toFixed(2)}ms | Controller: ${controllerMs.toFixed(2)}ms`);
      }
    });
    next();
  });
});


// Middlewares
app.use(cors({
  origin: [
    "http://localhost:5173", // Vite local
    "http://localhost:3000", // Optional React local
    process.env.CLIENT_URL, // Main frontend URL
    "https://cafe-time-xi.vercel.app",
    "https://cafe-time-d1ffjmio8-yashwanth29-webs-projects.vercel.app",
    "https://cafe-time-git-main-yashwanth29-webs-projects.vercel.app"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-branch-id", "x-cafe-id"]
}));
app.use(cookieParser());
app.use(express.json()); // Body parser

// Connect to Database
connectDB().then(() => {
  const migrateData = require('./utils/migrate');
  migrateData();
});

// Initialize Storage Maintenance Scheduled Jobs
const { initStorageMaintenanceJobs } = require('./jobs/storageMaintenanceJob');
initStorageMaintenanceJobs();

const fs = require('fs');

// Ensure uploads folder exists on startup
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve upload static assets (GridFS persistent storage with local filesystem fallback)
const { serveFromGridFS } = require('./utils/gridfs');
app.get('/uploads/:filename', (req, res) => {
  serveFromGridFS(req.params.filename, req, res);
});
app.use('/uploads', express.static(uploadsDir));

// Attach branch context globally for all /api endpoints
const { attachCafeAndBranch } = require('./middleware/branchMiddleware');
app.use('/api', attachCafeAndBranch);

// Mount Routes
app.use('/api/orders', orderRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/work-reports', workReportRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/cafe', cafeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payroll', payrollRoutes);


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running perfectly' });
});

// Serve Static Assets in Production
const clientDistPath = path.join(__dirname, '../client/dist');
const indexPath = path.join(clientDistPath, 'index.html');
if (process.env.NODE_ENV === 'production' && fs.existsSync(indexPath)) {
  // Set static folder
  app.use(express.static(clientDistPath));

  // Direct all other unmatched requests to index.html (React Router)
  app.use((req, res) => {
    res.sendFile(indexPath);
  });
} else {
  // Catch-all route for backend-only deployment
  app.get('/', (req, res) => {
    res.status(200).json({ success: true, message: 'Cafe-Time Backend API is running successfully' });
  });
}

// Global Error Handling Middleware
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Configure Port
const PORT = process.env.PORT || 5000;

// Start background interval for purging expired daily reports (runs every 1 hour)
const { runAutoCleanup } = require('./controllers/workReportController');
setInterval(() => {
  console.log('[CRON-JOB] Triggering expired work reports cleanup...');
  runAutoCleanup();
}, 3600000);

// Create HTTP Server and Initialize Socket.IO
const server = http.createServer(app);
initializeSocket(server);

// Start Listening
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
