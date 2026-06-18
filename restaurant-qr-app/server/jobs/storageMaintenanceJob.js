const cron = require('node-cron');
const { runAutoCleanup, generateWeeklyStorageReport } = require('../services/storageCleanupService');

/**
 * Initializes and schedules the storage maintenance jobs
 */
const initStorageMaintenanceJobs = () => {
  console.log('[Storage Maintenance] Initializing jobs...');

  // 1. Daily cleanup at 2:00 AM IST
  cron.schedule('0 2 * * *', async () => {
    console.log('[Storage Maintenance] Running daily cleanup cron job...');
    await runAutoCleanup();
  });

  // 2. Weekly deep audit on Sunday at 3:00 AM IST
  cron.schedule('0 3 * * 0', async () => {
    console.log('[Storage Maintenance] Running weekly deep audit cron job...');
    await generateWeeklyStorageReport();
  });

  // 3. Trigger initial cleanup on startup asynchronously
  setTimeout(async () => {
    console.log('[Storage Maintenance] Running startup storage cleanup & audit checks...');
    try {
      await runAutoCleanup();
      // If sunday, or if weekly report does not exist, trigger weekly report too
      await generateWeeklyStorageReport();
    } catch (err) {
      console.error('[Storage Maintenance] Error during startup execution:', err);
    }
  }, 5000); // Wait 5 seconds after startup to allow database connections to stabilize
};

module.exports = {
  initStorageMaintenanceJobs
};
