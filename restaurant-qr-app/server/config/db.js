const mongoose = require('mongoose');

const connectDB = async () => {
  const primaryUri = process.env.MONGO_URI;
  const fallbackUri = 'mongodb://127.0.0.1:27017/coffeedaycafe';

  let connected = false;

  // If a MONGO_URI is defined and is different from the local fallback, try it first
  if (primaryUri && primaryUri !== fallbackUri) {
    try {
      console.log(`Connecting to primary MongoDB at: ${primaryUri.replace(/:([^@]+)@/, ':****@')}`);
      await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 5000 });
      console.log('MongoDB Connected Successfully (Primary)');
      connected = true;
    } catch (error) {
      console.error(`Primary database connection failed: ${error.message}`);
      console.log('Attempting connection to local fallback MongoDB...');
    }
  }

  // Fallback to local MongoDB if not connected
  if (!connected) {
    try {
      console.log(`Connecting to fallback MongoDB at: ${fallbackUri}`);
      await mongoose.connect(fallbackUri, { serverSelectionTimeoutMS: 5000 });
      console.log('MongoDB Connected Successfully (Fallback)');
      connected = true;
    } catch (error) {
      console.error(`====================================================================`);
      console.error(`DATABASE WARNING: MongoDB connection failed: ${error.message}`);
      console.error(`Please ensure a local MongoDB service is running or check MONGO_URI.`);
      console.error(`The server will continue to run, but order operations will fail.`);
      console.error(`====================================================================`);
    }
  }

};

module.exports = connectDB;
