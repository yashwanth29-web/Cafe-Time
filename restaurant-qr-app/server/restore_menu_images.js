const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const restore = async () => {
  const backupPath = path.join(__dirname, 'menu_backup_before_update.json');
  if (!fs.existsSync(backupPath)) {
    console.error('Backup file not found at:', backupPath);
    process.exit(1);
  }

  const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe';

  console.log('Connecting to database for restore...');
  await mongoose.connect(uri);
  const conn = mongoose.connection;
  console.log('Connected!');

  console.log(`Starting restore of ${backupData.length} items...`);
  for (const item of backupData) {
    const res = await conn.db.collection('menuitems').updateOne(
      { _id: new mongoose.Types.ObjectId(item._id) },
      { $set: { image: item.image, imageUrl: item.imageUrl } }
    );
    console.log(`Restored "${item.name}": image set back to "${item.image}" (modified: ${res.modifiedCount})`);
  }

  console.log('Database restore completed successfully!');
  await mongoose.disconnect();
};

restore().catch(err => {
  console.error('Error during restore:', err);
  process.exit(1);
});
