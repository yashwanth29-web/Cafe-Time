const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const WorkReport = require('../models/WorkReport');
const Attendance = require('../models/Attendance');
const MenuItem = require('../models/MenuItem');
const Cafe = require('../models/Cafe');
const storageConfig = require('../config/storageConfig');

const statusFilePath = path.join(__dirname, '../storage_maintenance_status.json');

/**
 * Gets persistent storage status (timestamps)
 */
const getStatus = () => {
  try {
    if (fs.existsSync(statusFilePath)) {
      return JSON.parse(fs.readFileSync(statusFilePath, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading storage status file:', e);
  }
  return { lastCleanup: '', lastWeeklyAudit: '' };
};

/**
 * Updates last cleanup timestamp in persistent status
 */
const updateLastCleanupTimestamp = () => {
  const status = getStatus();
  status.lastCleanup = new Date().toISOString();
  try {
    fs.writeFileSync(statusFilePath, JSON.stringify(status, null, 2));
  } catch (e) {
    console.error('Error writing storage status file:', e);
  }
};

/**
 * Updates last weekly audit timestamp in persistent status
 */
const updateLastWeeklyAuditTimestamp = () => {
  const status = getStatus();
  status.lastWeeklyAudit = new Date().toISOString();
  try {
    fs.writeFileSync(statusFilePath, JSON.stringify(status, null, 2));
  } catch (e) {
    console.error('Error writing storage status file:', e);
  }
};

/**
 * Gets GridFS Bucket instance
 */
const getBucket = () => {
  const conn = mongoose.connection;
  if (!conn || !conn.db) {
    throw new Error('Database connection is not active.');
  }
  return new mongoose.mongo.GridFSBucket(conn.db, { bucketName: 'uploads' });
};

/**
 * Utility: extract basename from URLs
 */
const getFilenameFromUrl = (urlStr) => {
  if (!urlStr || typeof urlStr !== 'string') return null;
  if (!urlStr.includes('/')) return urlStr;
  const parts = urlStr.split('/');
  return parts[parts.length - 1];
};

/**
 * Cleanup expired Work Reports images
 */
const cleanupExpiredWorkReports = async () => {
  const conn = mongoose.connection;
  if (!conn || !conn.db) {
    console.warn('DB connection not active, skipping cleanupExpiredWorkReports.');
    return { success: false, count: 0 };
  }

  const retentionDays = storageConfig.WORK_REPORT_RETENTION_DAYS || 1;
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  // Find reports created before cutoffDate that haven't been expired yet and have photos/file references
  const expiredReports = await WorkReport.find({
    createdAt: { $lt: cutoffDate },
    attachmentsExpired: { $ne: true },
    $or: [
      { photos: { $exists: true, $not: { $size: 0 } } },
      { gridFsFileId: { $ne: null } },
      { gridFsFileIds: { $exists: true, $not: { $size: 0 } } }
    ]
  });

  console.log(`[Storage Cleanup] Found ${expiredReports.length} expired work reports to process.`);

  if (expiredReports.length === 0) {
    updateLastCleanupTimestamp();
    return { success: true, count: 0 };
  }

  const dryRunReportPath = path.join(__dirname, '../dry_run_storage_report.json');

  if (storageConfig.DRY_RUN) {
    const reportData = {
      timestamp: new Date().toISOString(),
      dryRun: true,
      expiredWorkReports: expiredReports.map(r => ({
        reportId: r._id,
        staffName: r.staffName,
        createdAt: r.createdAt,
        photos: r.photos,
        gridFsFileIds: r.gridFsFileIds,
        gridFsFileId: r.gridFsFileId
      }))
    };
    fs.writeFileSync(dryRunReportPath, JSON.stringify(reportData, null, 2));
    console.log(`[DRY RUN] Logged ${expiredReports.length} work report cleanups to ${dryRunReportPath}`);
    updateLastCleanupTimestamp();
    return { success: true, count: expiredReports.length, dryRun: true };
  }

  const bucket = getBucket();
  let deletedFilesCount = 0;

  for (const report of expiredReports) {
    const fileIdsToDelete = new Set();
    if (report.gridFsFileIds && report.gridFsFileIds.length > 0) {
      report.gridFsFileIds.forEach(id => {
        if (id) fileIdsToDelete.add(id.toString());
      });
    }
    if (report.gridFsFileId) {
      fileIdsToDelete.add(report.gridFsFileId.toString());
    }

    // Delete files from GridFS using bucket.delete
    for (const fileIdStr of fileIdsToDelete) {
      try {
        const fileId = new mongoose.Types.ObjectId(fileIdStr);
        await bucket.delete(fileId);
        deletedFilesCount++;
        console.log(`Deleted GridFS file ${fileIdStr} for work report ${report._id}`);
      } catch (err) {
        console.error(`Error deleting GridFS file ${fileIdStr} for work report ${report._id}:`, err.message);
      }
    }

    // Archival updates (Keep the document, clear image fields, mark attachmentsExpired = true)
    report.photos = [];
    report.gridFsFileIds = [];
    report.gridFsFilenames = [];
    report.gridFsFileId = null;
    report.gridFsFilename = '';
    report.attachmentsExpired = true;
    report.attachmentsExpiredAt = new Date();

    await report.save();
  }

  updateLastCleanupTimestamp();
  return { success: true, count: expiredReports.length, deletedFilesCount, dryRun: false };
};

/**
 * Cleanup expired Attendance selfie images
 */
const cleanupExpiredAttendanceProofImages = async () => {
  const conn = mongoose.connection;
  if (!conn || !conn.db) {
    console.warn('DB connection not active, skipping cleanupExpiredAttendanceProofImages.');
    return { success: false, count: 0 };
  }

  const retentionDays = storageConfig.ATTENDANCE_RETENTION_DAYS || 30;
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  // Find attendance records older than retention threshold that have active images/file references
  const expiredAttendances = await Attendance.find({
    createdAt: { $lt: cutoffDate },
    imageExpired: { $ne: true },
    $or: [
      { image: { $ne: '' } },
      { gridFsFileId: { $ne: null } }
    ]
  });

  console.log(`[Storage Cleanup] Found ${expiredAttendances.length} expired attendance records to process.`);

  if (expiredAttendances.length === 0) {
    updateLastCleanupTimestamp();
    return { success: true, count: 0 };
  }

  if (storageConfig.DRY_RUN) {
    console.log(`[DRY RUN] Would cleanup ${expiredAttendances.length} attendance selfies.`);
    updateLastCleanupTimestamp();
    return { success: true, count: expiredAttendances.length, dryRun: true };
  }

  const bucket = getBucket();
  let deletedFilesCount = 0;

  for (const att of expiredAttendances) {
    if (att.gridFsFileId) {
      try {
        await bucket.delete(att.gridFsFileId);
        deletedFilesCount++;
        console.log(`Deleted GridFS selfie file ${att.gridFsFileId} for attendance record ${att._id}`);
      } catch (err) {
        console.error(`Error deleting GridFS selfie ${att.gridFsFileId}:`, err.message);
      }
    }

    // Archival updates (Keep the document, clear image fields, mark imageExpired = true)
    att.image = '';
    att.gridFsFileId = null;
    att.gridFsFilename = '';
    att.imageExpired = true;
    att.imageExpiredAt = new Date();

    await att.save();
  }

  updateLastCleanupTimestamp();
  return { success: true, count: expiredAttendances.length, deletedFilesCount, dryRun: false };
};

/**
 * Audits GridFS uploads for orphans
 */
const auditOrphanGridFSFiles = async () => {
  const conn = mongoose.connection;
  if (!conn || !conn.db) {
    console.warn('DB connection not active, skipping auditOrphanGridFSFiles.');
    return { totalFiles: 0, orphans: [], reclaimedSpaceBytes: 0 };
  }

  const files = await conn.db.collection('uploads.files').find({}).toArray();

  const menuItems = await MenuItem.find({}, { image: 1 });
  const menuFilenames = new Set(menuItems.map(m => getFilenameFromUrl(m.image)).filter(Boolean));

  const cafes = await Cafe.find({}, { logoUrl: 1 });
  const logoFilenames = new Set(cafes.map(c => getFilenameFromUrl(c.logoUrl)).filter(Boolean));

  const workReports = await WorkReport.find({}, { gridFsFileIds: 1, gridFsFileId: 1, gridFsFilenames: 1, gridFsFilename: 1 });
  const workReportFileIds = new Set();
  const workReportFilenames = new Set();
  workReports.forEach(w => {
    if (w.gridFsFileIds) w.gridFsFileIds.forEach(id => { if (id) workReportFileIds.add(id.toString()); });
    if (w.gridFsFileId) workReportFileIds.add(w.gridFsFileId.toString());
    if (w.gridFsFilenames) w.gridFsFilenames.forEach(fn => { if (fn) workReportFilenames.add(fn); });
    if (w.gridFsFilename) workReportFilenames.add(w.gridFsFilename);
  });

  const attendances = await Attendance.find({}, { gridFsFileId: 1, gridFsFilename: 1, image: 1 });
  const attendanceFileIds = new Set();
  const attendanceFilenames = new Set();
  attendances.forEach(a => {
    if (a.gridFsFileId) attendanceFileIds.add(a.gridFsFileId.toString());
    if (a.gridFsFilename) attendanceFilenames.add(a.gridFsFilename);
    const fn = getFilenameFromUrl(a.image);
    if (fn) attendanceFilenames.add(fn);
  });

  const orphans = [];
  let reclaimedSpace = 0;

  for (const file of files) {
    const idStr = file._id.toString();
    const filename = file.filename;

    // A file is referenced if it is in menu items, logo, work reports or attendance records
    const isReferenced = menuFilenames.has(filename) ||
                         logoFilenames.has(filename) ||
                         workReportFileIds.has(idStr) ||
                         workReportFilenames.has(filename) ||
                         attendanceFileIds.has(idStr) ||
                         attendanceFilenames.has(filename);

    if (!isReferenced) {
      orphans.push({
        fileId: file._id,
        filename: file.filename,
        uploadDate: file.uploadDate,
        length: file.length
      });
      reclaimedSpace += file.length;
    }
  }

  console.log(`[Storage Audit] Found ${orphans.length} orphaned files out of ${files.length} total GridFS files.`);

  // Delete orphaned files if DRY_RUN is false
  if (!storageConfig.DRY_RUN && orphans.length > 0) {
    const bucket = getBucket();
    for (const orphan of orphans) {
      try {
        await bucket.delete(orphan.fileId);
        console.log(`[Storage Cleanup] Deleted orphaned GridFS file: ${orphan.filename} (${orphan.fileId})`);
      } catch (err) {
        console.error(`Error deleting orphaned GridFS file ${orphan.fileId}:`, err.message);
      }
    }
  }

  return {
    totalFiles: files.length,
    orphans,
    reclaimedSpaceBytes: reclaimedSpace
  };
};

/**
 * Scan chunk collections for missing file metadata
 */
const verifyChunkIntegrity = async () => {
  const conn = mongoose.connection;
  if (!conn || !conn.db) {
    console.warn('DB connection not active, skipping verifyChunkIntegrity.');
    return { totalOrphanedChunks: 0, orphanedChunkFileIds: [] };
  }

  const chunksCollection = conn.db.collection('uploads.chunks');
  const orphans = await chunksCollection.aggregate([
    {
      $group: {
        _id: '$files_id'
      }
    },
    {
      $lookup: {
        from: 'uploads.files',
        localField: '_id',
        foreignField: '_id',
        as: 'file'
      }
    },
    {
      $match: {
        file: { $size: 0 }
      }
    }
  ]).toArray();

  const orphanedChunkFileIds = orphans.map(o => o._id);

  console.log(`[Storage Audit] Chunk Integrity Scan: found ${orphanedChunkFileIds.length} orphaned chunk groups.`);

  // Write standalone chunk integrity report
  const chunkReportPath = path.join(__dirname, '../chunk_integrity_report.json');
  fs.writeFileSync(chunkReportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalOrphanedChunks: orphanedChunkFileIds.length,
    orphanedChunkFileIds
  }, null, 2));

  return {
    totalOrphanedChunks: orphanedChunkFileIds.length,
    orphanedChunkFileIds
  };
};

/**
 * Expose storage health counters and timestamps
 */
const getStorageHealthData = async () => {
  const expiredWorkReportAttachments = await WorkReport.countDocuments({ attachmentsExpired: true });
  const expiredAttendanceImages = await Attendance.countDocuments({ imageExpired: true });
  const status = getStatus();

  return {
    expiredWorkReportAttachments,
    expiredAttendanceImages,
    lastCleanup: status.lastCleanup || '',
    lastWeeklyAudit: status.lastWeeklyAudit || ''
  };
};

/**
 * Generate storage health report JSON
 */
const generateStorageHealthReport = async () => {
  const healthData = await getStorageHealthData();
  const healthReportPath = path.join(__dirname, '../storage_health_report.json');
  fs.writeFileSync(healthReportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    ...healthData
  }, null, 2));
  console.log(`Storage health report written to ${healthReportPath}`);
};

/**
 * Generate weekly deep audit report JSON on Sundays
 */
const generateWeeklyStorageReport = async () => {
  const conn = mongoose.connection;
  if (!conn || !conn.db) {
    return;
  }

  console.log('[Storage Audit] Generating weekly storage audit report...');

  const auditResult = await auditOrphanGridFSFiles();
  const integrityResult = await verifyChunkIntegrity();

  const files = await conn.db.collection('uploads.files').find({}).toArray();
  const totalSize = files.reduce((sum, f) => sum + (f.length || 0), 0);

  const weeklyReportPath = path.join(__dirname, '../weekly_storage_report.json');
  const reportData = {
    timestamp: new Date().toISOString(),
    totalGridFsFiles: auditResult.totalFiles,
    totalGridFsSizeMB: Number((totalSize / (1024 * 1024)).toFixed(3)),
    orphanedFiles: auditResult.orphans.map(o => ({
      fileId: o.fileId,
      filename: o.filename,
      uploadDate: o.uploadDate,
      length: o.length
    })),
    reclaimableSpaceMB: Number((auditResult.reclaimedSpaceBytes / (1024 * 1024)).toFixed(3)),
    chunkIntegrity: integrityResult
  };

  fs.writeFileSync(weeklyReportPath, JSON.stringify(reportData, null, 2));
  console.log(`Weekly storage report written to ${weeklyReportPath}`);

  updateLastWeeklyAuditTimestamp();
};

/**
 * Run automatic daily cleanup
 */
const runAutoCleanup = async () => {
  try {
    console.log('[Storage Cleanup] Starting automatic cleanup process...');
    const wrResult = await cleanupExpiredWorkReports();
    const attResult = await cleanupExpiredAttendanceProofImages();
    await generateStorageHealthReport();
    return { wrResult, attResult };
  } catch (error) {
    console.error('Error in runAutoCleanup:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  cleanupExpiredWorkReports,
  cleanupExpiredAttendanceProofImages,
  auditOrphanGridFSFiles,
  verifyChunkIntegrity,
  getStorageHealthData,
  generateStorageHealthReport,
  generateWeeklyStorageReport,
  runAutoCleanup
};
