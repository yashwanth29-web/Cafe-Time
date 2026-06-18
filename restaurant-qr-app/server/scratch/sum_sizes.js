const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, '../public/uploads');

const run = () => {
  const files = fs.readdirSync(uploadsDir);
  let totalSize = 0;
  let dishSize = 0;
  let dishCount = 0;

  files.forEach(f => {
    const stat = fs.statSync(path.join(uploadsDir, f));
    totalSize += stat.size;
    if (f.startsWith('dish-')) {
      dishSize += stat.size;
      dishCount++;
    }
  });

  console.log('--- STORAGE SUM ---');
  console.log(`Total Files: ${files.length}`);
  console.log(`Total Size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Dish Files Count: ${dishCount}`);
  console.log(`Dish Files Size: ${(dishSize / (1024 * 1024)).toFixed(2)} MB`);
};

run();
