const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

// Detailed target mapping for the 28 menu items
const activeMappings = {
  'Chocolate Coffee': 'dish-1781538489823-67122816.jpg',
  'Classic Coffee': 'dish-1781538504134-261896466.jpg',
  'Cold Coffee': 'dish-1781538532243-319866540.jpg',
  'Large Fries': 'dish-1781538572428-867716580.jpg',
  'Medium Fries': 'dish-1781538583872-991399356.jpg',
  'Small Fries': 'dish-1781538551607-692596989.jpg',
  'Badam Milk': 'dish-1781538596912-619275300.jpg',
  'Goli Soda': 'dish-1781538609444-803534232.jpg',
  'Lassi': 'dish-1781538623899-829667631.jpg',
  'Mango Juice': 'dish-1781538636193-67419414.jpg',
  'Musk Melon Juice': 'dish-1781538653229-393732266.jpg',
  'Watermelon Juice': 'dish-1781538666666-290059000.jpg',
  'Allam Bellam Tea': 'dish-1781538685869-84331898.jpg',
  'Black Tea': 'dish-1781538698287-868401230.jpg',
  'Elaichi Tea': 'dish-1781538709856-569433373.jpg',
  'Ginger Tea': 'dish-1781538724411-761824673.jpg',
  'Regular Tea': 'dish-1781538724411-761824673.jpg', // Map to retained Ginger Tea image
  'Chicken Puff': 'dish-1781538753797-477396917.jpg',
  'Egg Puff': 'dish-1781538785540-199900804.jpg',
  'Muska Bun': 'dish-1781538799714-892715440.jpg',
  'Osmaniya Biscuit': 'dish-1781538814093-704947995.jpg',
  'Samosa': 'dish-1781538826877-17461220.jpg',
  'Veg Puff': 'dish-1781538851249-109081348.jpg',
  'Veg Sandwich': 'dish-1781538799714-892715440.jpg', // Map to retained Muska Bun image
  'Chocolate Milkshake': 'dish-1781538878545-434709465.jpg',
  'Strawberry Milkshake': 'dish-1781538932366-308263508.jpg',
  'Vanilla Milkshake': 'dish-1781538961827-222484261.jpg',
  'Hazelnut Milkshake': '/images/default-food.png' // Default fallback
};

// Files that are duplicates and should be cleaned up
const duplicatesMap = {
  'dish-1781538740093-126250201.jpg': 'dish-1781538724411-761824673.jpg',  // Regular Tea -> Ginger Tea
  'dish-1781538778167-209363155.jpg': 'dish-1781538753797-477396917.jpg',  // Chicken Puff duplicate
  'dish-1781538864111-249160901.jpg': 'dish-1781538851249-109081348.jpg',  // Veg Puff duplicate
  'dish-1781538899526-739507786.jpg': 'dish-1781538814093-704947995.jpg',  // Osmaniya Biscuit duplicate
  'dish-1781538914181-286771489.jpg': 'dish-1781538799714-892715440.jpg'   // Veg Sandwich -> Muska Bun
};

const run = async () => {
  const uploadsDir = path.join(__dirname, '../public/uploads');
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe';

  console.log('Connecting to database...');
  await mongoose.connect(uri);
  const conn = mongoose.connection;
  console.log('Connected!');

  const bucket = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: 'uploads' });

  // 1. Upload unique active images to GridFS
  const uniqueImagesToUpload = new Set(
    Object.values(activeMappings).filter(file => file.startsWith('dish-'))
  );
  
  // Also add logo
  uniqueImagesToUpload.add('CD001_logo.jpg');

  console.log(`Uploading ${uniqueImagesToUpload.size} assets to GridFS...`);
  for (const filename of uniqueImagesToUpload) {
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) {
      console.error(`ERROR: File not found locally: ${filename}`);
      continue;
    }

    const fileStream = fs.createReadStream(filePath);
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: filename.endsWith('.png') ? 'image/png' : 'image/jpeg'
    });

    await new Promise((resolve, reject) => {
      fileStream.pipe(uploadStream)
        .on('finish', resolve)
        .on('error', reject);
    });
    console.log(`Synced: ${filename}`);
  }

  // 2. Update database menu items
  console.log('Updating database menu items...');
  for (const [name, targetVal] of Object.entries(activeMappings)) {
    let finalPath = targetVal;
    if (targetVal.startsWith('dish-')) {
      finalPath = `/uploads/${targetVal}`;
    }
    
    const res = await conn.db.collection('menuitems').updateOne(
      { name: name },
      { $set: { image: finalPath } }
    );
    console.log(`Updated item "${name}" -> "${finalPath}" (modified: ${res.modifiedCount})`);
  }

  // 3. Scan directory and generate cleanup report
  console.log('Scanning directory for cleanup classification...');
  const files = fs.readdirSync(uploadsDir);
  const report = {
    SAFE_TO_DELETE: [],
    DUPLICATE: [],
    UNREFERENCED: [],
    SYSTEM_FILES_KEEP: []
  };

  let totalSpaceRecovered = 0;

  files.forEach(f => {
    const filePath = path.join(uploadsDir, f);
    const stat = fs.statSync(filePath);
    const sizeBytes = stat.size;

    if (f === 'CD001_logo.jpg') {
      report.SYSTEM_FILES_KEEP.push({ filename: f, size: sizeBytes, reason: 'Active Cafe Logo' });
      return;
    }

    if (uniqueImagesToUpload.has(f)) {
      report.SYSTEM_FILES_KEEP.push({ filename: f, size: sizeBytes, reason: 'Active Menu Item Image (GridFS Synced)' });
      return;
    }

    if (duplicatesMap[f]) {
      report.DUPLICATE.push({
        filename: f,
        size: sizeBytes,
        duplicateOf: duplicatesMap[f]
      });
      totalSpaceRecovered += sizeBytes;
      return;
    }

    if (f.startsWith('report-')) {
      report.UNREFERENCED.push({ filename: f, size: sizeBytes, reason: 'Expired attendance/work reports' });
      totalSpaceRecovered += sizeBytes;
      return;
    }

    if (f.startsWith('dish-1781200240485') || f.startsWith('dish-1781323185641') || f.startsWith('dish-1781347') || f.startsWith('dish-1781348')) {
      report.UNREFERENCED.push({ filename: f, size: sizeBytes, reason: 'Unused setup screenshot, logo, or burger image' });
      totalSpaceRecovered += sizeBytes;
      return;
    }

    // Default catch-all unreferenced files
    report.UNREFERENCED.push({ filename: f, size: sizeBytes, reason: 'Unknown unreferenced file' });
    totalSpaceRecovered += sizeBytes;
  });

  report.SAFE_TO_DELETE = [...report.DUPLICATE.map(x => x.filename), ...report.UNREFERENCED.map(x => x.filename)];
  
  const reportPath = path.join(__dirname, '../cleanup_report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    spaceRecovered: (totalSpaceRecovered / 1024 / 1024).toFixed(2) + ' MB',
    spaceRecoveredBytes: totalSpaceRecovered,
    report
  }, null, 2));

  console.log(`Saved cleanup report to: ${reportPath}`);
  console.log(`Total space that can be recovered: ${(totalSpaceRecovered / 1024 / 1024).toFixed(2)} MB`);

  await mongoose.disconnect();
};

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
