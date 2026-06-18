const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const run = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe';
  await mongoose.connect(uri);
  const conn = mongoose.connection;

  // 1. Fetch all GridFS files
  const filesColl = conn.db.collection('uploads.files');
  const gfsFiles = await filesColl.find({}).toArray();
  const gfsFilenames = gfsFiles.map(f => f.filename);

  // 2. Fetch references
  const menuItems = await conn.db.collection('menuitems').find({}).toArray();
  const cafes = await conn.db.collection('cafes').find({}).toArray();
  
  // Try work reports (may or may not exist yet)
  let workReports = [];
  try {
    workReports = await conn.db.collection('workreports').find({}).toArray();
  } catch (e) {
    // collection might not exist yet
  }

  const referencedFiles = new Set();

  // Extract from menu items
  menuItems.forEach(item => {
    if (item.image && item.image.startsWith('/uploads/')) {
      referencedFiles.add(item.image.replace('/uploads/', ''));
    }
  });

  // Extract from cafe logos
  cafes.forEach(cafe => {
    if (cafe.logoUrl && cafe.logoUrl.includes('/uploads/')) {
      const parts = cafe.logoUrl.split('/uploads/');
      referencedFiles.add(parts[parts.length - 1]);
    }
    if (cafe.logo && cafe.logo.includes('/uploads/')) {
      const parts = cafe.logo.split('/uploads/');
      referencedFiles.add(parts[parts.length - 1]);
    }
  });
  
  // Also add default logo filename just in case
  referencedFiles.add('CD001_logo.jpg');

  // Extract from work reports
  workReports.forEach(report => {
    if (Array.isArray(report.photos)) {
      report.photos.forEach(photo => {
        if (photo.includes('/uploads/')) {
          const parts = photo.split('/uploads/');
          referencedFiles.add(parts[parts.length - 1]);
        }
      });
    }
  });

  // 3. Find orphans
  const orphans = [];
  let reclaimableSpaceBytes = 0;

  gfsFiles.forEach(file => {
    if (!referencedFiles.has(file.filename)) {
      orphans.push({
        filename: file.filename,
        sizeBytes: file.length,
        uploadDate: file.uploadDate
      });
      reclaimableSpaceBytes += file.length;
    }
  });

  const reportData = {
    reclaimableSpace: (reclaimableSpaceBytes / 1024).toFixed(1) + ' KB',
    reclaimableSpaceBytes,
    orphanedFilesCount: orphans.length,
    orphanedFiles: orphans
  };

  const reportPath = path.join(__dirname, '../orphan_gridfs_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

  console.log(`Saved orphaned GridFS files report to: ${reportPath}`);
  console.log(`Orphaned files count: ${orphans.length}, Reclaimable space: ${reportData.reclaimableSpace}`);

  await mongoose.disconnect();
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
