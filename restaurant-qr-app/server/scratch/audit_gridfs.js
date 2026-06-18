const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const run = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe';
  await mongoose.connect(uri);
  const conn = mongoose.connection;

  const filesColl = conn.db.collection('uploads.files');
  const files = await filesColl.find({}).toArray();

  if (files.length === 0) {
    console.log(JSON.stringify({
      count: 0,
      totalBytes: 0,
      avgBytes: 0,
      largest: null
    }, null, 2));
    await mongoose.disconnect();
    return;
  }

  let totalBytes = 0;
  let largestFile = null;

  files.forEach(file => {
    totalBytes += file.length;
    if (!largestFile || file.length > largestFile.length) {
      largestFile = file;
    }
  });

  const avgBytes = totalBytes / files.length;
  const atlasFreeLimitBytes = 512 * 1024 * 1024; // 512 MB
  const remainingEstimateBytes = Math.max(0, atlasFreeLimitBytes - totalBytes);

  console.log(JSON.stringify({
    count: files.length,
    totalStorageConsumedMB: (totalBytes / 1024 / 1024).toFixed(3) + ' MB',
    totalStorageConsumedBytes: totalBytes,
    avgImageSizeKB: (avgBytes / 1024).toFixed(1) + ' KB',
    avgImageSizeBytes: Math.round(avgBytes),
    largestFile: largestFile ? {
      filename: largestFile.filename,
      sizeKB: (largestFile.length / 1024).toFixed(1) + ' KB',
      sizeBytes: largestFile.length
    } : null,
    remainingAtlasFreeSpaceMB: (remainingEstimateBytes / 1024 / 1024).toFixed(1) + ' MB'
  }, null, 2));

  await mongoose.disconnect();
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
