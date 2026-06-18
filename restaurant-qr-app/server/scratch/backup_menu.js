const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const run = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe';
  console.log('Connecting to database for backup...');
  await mongoose.connect(uri);
  console.log('Connected!');

  const conn = mongoose.connection;
  const items = await conn.db.collection('menuitems').find({}).toArray();
  
  const backup = items.map(item => ({
    _id: item._id.toString(),
    name: item.name,
    image: item.image || null,
    imageUrl: item.imageUrl || null
  }));

  const backupDir = 'C:\\Users\\LENOVO\\.gemini\\antigravity\\brain\\c2b32519-66bb-4e59-b40c-6d9dd8b89d8e\\scratch';
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupPath = path.join(backupDir, 'menu_backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');
  console.log(`Backup completed successfully! Saved ${backup.length} items to ${backupPath}`);

  await mongoose.disconnect();
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
