const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const uploadsDir = path.join(__dirname, '../public/uploads');

const getMd5 = (filePath) => {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
};

const run = () => {
  const files = fs.readdirSync(uploadsDir).filter(f => f.startsWith('dish-'));
  
  const groups = {};
  files.forEach(f => {
    const p = path.join(uploadsDir, f);
    const hash = getMd5(p);
    const size = fs.statSync(p).size;
    const key = `${size}-${hash}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(f);
  });

  console.log('--- UNIQUE IMAGES ---');
  Object.keys(groups).forEach(key => {
    console.log(`Key ${key}: count ${groups[key].length} files: ${groups[key].join(', ')}`);
  });
};

run();
