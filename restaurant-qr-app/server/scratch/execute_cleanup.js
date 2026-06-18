const fs = require('fs');
const path = require('path');

const run = () => {
  const reportPath = path.join(__dirname, '../cleanup_report.json');
  if (!fs.existsSync(reportPath)) {
    console.error('Cleanup report not found!');
    process.exit(1);
  }

  const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const safeToDelete = reportData.report.SAFE_TO_DELETE || [];
  const uploadsDir = path.join(__dirname, '../public/uploads');

  console.log(`Starting cleanup of ${safeToDelete.length} files...`);
  let deletedCount = 0;
  let errorCount = 0;

  safeToDelete.forEach(filename => {
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Deleted: ${filename}`);
        deletedCount++;
      } catch (err) {
        console.error(`Error deleting ${filename}:`, err);
        errorCount++;
      }
    } else {
      console.log(`File already gone/not found: ${filename}`);
    }
  });

  console.log(`Cleanup execution completed! Deleted: ${deletedCount}, Errors: ${errorCount}. Recovered: ${reportData.spaceRecovered}`);
};

run();
