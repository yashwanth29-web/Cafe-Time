const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, '../public/uploads');

const run = () => {
  if (!fs.existsSync(uploadsDir)) {
    console.log('Uploads directory does not exist');
    return;
  }
  const files = fs.readdirSync(uploadsDir);
  console.log(`Total files: ${files.length}`);

  const details = files
    .filter(f => f.startsWith('dish-'))
    .map(f => {
      const p = path.join(uploadsDir, f);
      const stat = fs.statSync(p);
      return {
        name: f,
        size: stat.size,
        mtime: stat.mtime
      };
    })
    .sort((a, b) => a.mtime - b.mtime);

  console.log(JSON.stringify(details, null, 2));
};

run();
