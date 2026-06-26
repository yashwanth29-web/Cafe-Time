const express = require('express');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables immediately before routing imports
dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });

const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const orderRoutes = require('./routes/orderRoutes');
const menuRoutes = require('./routes/menuRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const authRoutes = require('./routes/authRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const adminRoutes = require('./routes/adminRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const workReportRoutes = require('./routes/workReportRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const cafeRoutes = require('./routes/cafeRoutes');

// Create Express instance
const app = express();

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
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(cookieParser());
app.use(express.json()); // Body parser

// Connect to Database
connectDB();

const fs = require('fs');

// Ensure uploads folder exists on startup
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve upload static assets
app.use('/uploads', express.static(uploadsDir));

// Mount Routes
app.use('/api/orders', orderRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/work-reports', workReportRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/cafe', cafeRoutes);


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running perfectly' });
});

// Serve Static Assets in Production
const clientDistPath = path.join(__dirname, '../client/dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(clientDistPath)) {
  // Set static folder
  app.use(express.static(clientDistPath));

  // Direct all other unmatched requests to index.html (React Router)
  app.use((req, res) => {
    res.sendFile(path.resolve(clientDistPath, 'index.html'));
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

// Start Listening
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
