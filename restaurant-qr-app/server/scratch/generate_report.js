const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

// Category order of the 28 menu items
const categoryOrderedItems = [
  'Regular Tea',
  'Black Tea',
  'Elaichi Tea',
  'Ginger Tea',
  'Allam Bellam Tea',
  'Classic Coffee',
  'Chocolate Coffee',
  'Cold Coffee',
  'Goli Soda',
  'Badam Milk',
  'Watermelon Juice',
  'Musk Melon Juice',
  'Lassi',
  'Mango Juice',
  'Chocolate Milkshake',
  'Vanilla Milkshake',
  'Strawberry Milkshake',
  'Hazelnut Milkshake',
  'Osmaniya Biscuit',
  'Veg Puff',
  'Egg Puff',
  'Chicken Puff',
  'Muska Bun',
  'Samosa',
  'Veg Sandwich',
  'Small Fries',
  'Medium Fries',
  'Large Fries'
];

const run = async () => {
  const uploadsDir = path.join(__dirname, '../public/uploads');

  // 1. Scan directory
  console.log('Scanning uploads directory...');
  const files = fs.readdirSync(uploadsDir);
  const scannedFiles = files.map(f => {
    const p = path.join(uploadsDir, f);
    const stat = fs.statSync(p);
    return {
      filename: f,
      createdAt: stat.mtime.toISOString(),
      size: (stat.size / 1024).toFixed(1) + ' KB'
    };
  });

  // Sort dish- files chronologically from June 15
  const dishFiles = scannedFiles
    .filter(f => f.filename.startsWith('dish-') && f.filename.includes('1781538'))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  console.log(`Found ${scannedFiles.length} total files, and ${dishFiles.length} dish- files from June 15.`);

  // 2. Fetch DB menu items
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe';
  console.log('Connecting to database...');
  await mongoose.connect(uri);
  const conn = mongoose.connection;
  const dbItems = await conn.db.collection('menuitems').find({}).toArray();
  console.log(`Retrieved ${dbItems.length} menu items from DB.`);

  // Create lookup map
  const dbItemsMap = {};
  dbItems.forEach(item => {
    dbItemsMap[item.name] = item;
  });

  // 3. Generate Mapping Report
  const mappingReport = {};
  let missingFilesCount = 0;
  let brokenPathsCount = 0;

  categoryOrderedItems.forEach((name, index) => {
    const dbItem = dbItemsMap[name];
    if (!dbItem) {
      console.warn(`Menu item "${name}" not found in database.`);
      return;
    }

    const currentImage = dbItem.image;
    // Map chronologically to the dish files from June 15
    const suggestedFile = dishFiles[index] ? `/uploads/${dishFiles[index].filename}` : null;
    
    // Check if current image exists on disk
    let currentImageExists = false;
    if (currentImage) {
      // Resolve path
      const resolvedPath = path.join(__dirname, '../public', currentImage);
      currentImageExists = fs.existsSync(resolvedPath);
    }

    if (!currentImageExists) {
      brokenPathsCount++;
    }

    mappingReport[name] = {
      oldPath: currentImage,
      currentFileExists: currentImageExists,
      suggestedPath: suggestedFile,
      suggestedFileExists: suggestedFile ? fs.existsSync(path.join(__dirname, '../public', suggestedFile)) : false,
      isPathWrong: !currentImageExists || currentImage.includes('goli_soda') || currentImage.includes('regular_tea'),
      isFilenameGeneric: currentImage ? !currentImage.includes('dish-') : true
    };
  });

  console.log('--- SCAN AND DATABASE COMPARISON COMPLETED ---');
  console.log(JSON.stringify({
    totalScannedFiles: scannedFiles.length,
    dishFilesFromJune15: dishFiles.length,
    brokenPathsCount,
    mappingReport
  }, null, 2));

  await mongoose.disconnect();
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
