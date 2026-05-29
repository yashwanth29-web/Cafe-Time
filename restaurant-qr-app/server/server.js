const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const orderRoutes = require('./routes/orderRoutes');
const menuRoutes = require('./routes/menuRoutes');

// Load environment variables
dotenv.config();

// Create Express instance
const app = express();

// Middlewares
app.use(cors()); // Allow all cross-origins for MVP testing
app.use(express.json()); // Body parser

// Connect to Database
connectDB();

const path = require('path');

// Mount Routes
app.use('/api/orders', orderRoutes);
app.use('/api/menu', menuRoutes);

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
