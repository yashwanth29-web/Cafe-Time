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

// Create Express instance
const app = express();

// Middlewares
app.use(cors({
  origin: (origin, callback) => {
    // Dynamically mirror the request origin to support credential sharing across local networks/IPs
    if (!origin) return callback(null, true);
    callback(null, true);
  },
  credentials: true
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


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running perfectly' });
});

// Serve Static Assets in Production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static(path.join(__dirname, '../client/dist')));

  // Direct all other unmatched requests to index.html (React Router)
  app.use((req, res) => {
    res.sendFile(path.resolve(__dirname, '../client', 'dist', 'index.html'));
  });
}

// Configure Port
const PORT = process.env.PORT || 5000;

// Start Listening
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
