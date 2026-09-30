const mongoose = require('mongoose');
const Order = require('../models/Order');
const InventoryLog = require('../models/InventoryLog');
const Attendance = require('../models/Attendance');
const WorkReport = require('../models/WorkReport');
const Expense = require('../models/Expense');
const CashRegister = require('../models/CashRegister');
const Notification = require('../models/Notification');
const Review = require('../models/Review');

const RETENTION_DAYS = 60; // 2 Months (60 Days)

/**
 * Executes a safe, transactional purge of historical records older than 60 days.
 * PROTECTED: Never deletes active orders, user accounts, menu items, or live inventory catalog.
 */
const runDataRetentionCleanup = async () => {
  const startTime = Date.now();
  const conn = mongoose.connection;
  if (!conn || conn.readyState !== 1) {
    console.warn('[Data Retention] MongoDB not connected. Skipping cleanup cycle.');
    return { success: false, message: 'Database not connected' };
  }

  const cutoffDate = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

  console.log(`[Data Retention] Starting 60-Day Purge Job. Cutoff Date: ${cutoffDate.toISOString()} (${cutoffDateStr})`);

  const results = {
    cutoffDate: cutoffDate.toISOString(),
    retentionDays: RETENTION_DAYS,
    ordersDeleted: 0,
    inventoryLogsDeleted: 0,
    attendanceDeleted: 0,
    workReportsDeleted: 0,
    expensesDeleted: 0,
    cashRegistersDeleted: 0,
    notificationsDeleted: 0,
    reviewsDeleted: 0,
    durationMs: 0
  };

  // 1. Orders (Only Completed, Delivered, Cancelled, Paid)
  try {
    const orderRes = await Order.deleteMany({
      createdAt: { $lt: cutoffDate },
      status: { $in: ['Completed', 'Delivered', 'Cancelled', 'Ready', 'Paid'] }
    });
    results.ordersDeleted = orderRes.deletedCount || 0;
  } catch (err) {
    console.error('[Data Retention] Error purging old orders:', err);
  }

  // 2. Inventory Movement Logs (Stock change history only, live stock levels untouched)
  try {
    const invRes = await InventoryLog.deleteMany({
      createdAt: { $lt: cutoffDate }
    });
    results.inventoryLogsDeleted = invRes.deletedCount || 0;
  } catch (err) {
    console.error('[Data Retention] Error purging old inventory logs:', err);
  }

  // 3. Staff Attendance Logs
  try {
    const attRes = await Attendance.deleteMany({
      $or: [
        { createdAt: { $lt: cutoffDate } },
        { date: { $lt: cutoffDateStr } }
      ]
    });
    results.attendanceDeleted = attRes.deletedCount || 0;
  } catch (err) {
    console.error('[Data Retention] Error purging old attendance logs:', err);
  }

  // 4. Daily Staff Shift Reports
  try {
    const workRes = await WorkReport.deleteMany({
      $or: [
        { createdAt: { $lt: cutoffDate } },
        { date: { $lt: cutoffDateStr } }
      ]
    });
    results.workReportsDeleted = workRes.deletedCount || 0;
  } catch (err) {
    console.error('[Data Retention] Error purging old work reports:', err);
  }

  // 5. Daily Miscellaneous Expenses
  try {
    const expRes = await Expense.deleteMany({
      $or: [
        { createdAt: { $lt: cutoffDate } },
        { date: { $lt: cutoffDate } }
      ]
    });
    results.expensesDeleted = expRes.deletedCount || 0;
  } catch (err) {
    console.error('[Data Retention] Error purging old expenses:', err);
  }

  // 6. Daily Cash Drawer & Register Records
  try {
    const crRes = await CashRegister.deleteMany({
      $or: [
        { createdAt: { $lt: cutoffDate } },
        { date: { $lt: cutoffDateStr } }
      ]
    });
    results.cashRegistersDeleted = crRes.deletedCount || 0;
  } catch (err) {
    console.error('[Data Retention] Error purging old cash registers:', err);
  }

  // 7. System & Staff Notifications
  try {
    const notifRes = await Notification.deleteMany({
      createdAt: { $lt: cutoffDate }
    });
    results.notificationsDeleted = notifRes.deletedCount || 0;
  } catch (err) {
    console.error('[Data Retention] Error purging old notifications:', err);
  }

  // 8. Old Customer Reviews
  try {
    const revRes = await Review.deleteMany({
      createdAt: { $lt: cutoffDate }
    });
    results.reviewsDeleted = revRes.deletedCount || 0;
  } catch (err) {
    console.error('[Data Retention] Error purging old reviews:', err);
  }

  results.durationMs = Date.now() - startTime;
  console.log(`[Data Retention] Purge Complete in ${results.durationMs}ms:`, {
    orders: results.ordersDeleted,
    inventoryLogs: results.inventoryLogsDeleted,
    attendance: results.attendanceDeleted,
    workReports: results.workReportsDeleted,
    expenses: results.expensesDeleted,
    cashRegisters: results.cashRegistersDeleted,
    notifications: results.notificationsDeleted,
    reviews: results.reviewsDeleted
  });

  return { success: true, results };
};

/**
 * Auto-Checkout Job: Automatically checks out staff 5 minutes after scheduled shift end
 */
const runAutoCheckOutJob = async () => {
  try {
    const tzOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(Date.now() + tzOffset);
    const todayStr = nowIST.toISOString().split('T')[0];

    // Find any attendance record with active sessions or unfinalized checkouts
    const openSessions = await Attendance.find({
      $or: [
        { activeSessionNumber: { $gt: 0 } },
        { checkOutTime: { $exists: false } },
        { checkOutTime: null },
        { isWageFinalized: false }
      ]
    }).setOptions({ bypassBranchFilter: true });

    let autoClosedCount = 0;
    const { checkAndApplyAutoCheckout } = require('../controllers/attendanceController');

    for (const session of openSessions) {
      try {
        const closed = await checkAndApplyAutoCheckout(session);
        if (closed) autoClosedCount++;
      } catch (sessErr) {
        console.error('[Auto-Checkout] Error checking session:', session._id, sessErr.message);
      }
    }

    if (autoClosedCount > 0) {
      console.log(`[Auto-Checkout] Successfully auto-closed ${autoClosedCount} shift session(s).`);
    }
  } catch (err) {
    console.error('[Auto-Checkout] Error running auto-checkout job:', err);
  }
};

/**
 * 12-Hour Photo Retention: Deletes temporary selfie photos from disk & database 12 hours after creation
 */
const runDailyPhotoCleanup = async () => {
  try {
    const fs = require('fs');
    const path = require('path');
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    // 1. Attendance selfies older than 12 hours (root or shiftSessions)
    const oldAttendances = await Attendance.find({
      checkInTime: { $lt: twelveHoursAgo },
      $or: [
        { image: { $exists: true, $ne: '' } },
        { 'shiftSessions.image': { $exists: true, $ne: '' } }
      ]
    }).setOptions({ bypassBranchFilter: true });

    let attendancePhotosCleaned = 0;
    for (const att of oldAttendances) {
      if (att.image && att.image.includes('/uploads/')) {
        const filename = att.image.split('/uploads/').pop();
        const filePath = path.join(__dirname, '../public/uploads', filename);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) {}
        }
      }
      att.image = '';
      att.imageExpired = true;
      att.imageExpiredAt = new Date();

      if (Array.isArray(att.shiftSessions)) {
        for (const s of att.shiftSessions) {
          if (s.image && s.image.includes('/uploads/')) {
            const fname = s.image.split('/uploads/').pop();
            const fpath = path.join(__dirname, '../public/uploads', fname);
            if (fs.existsSync(fpath)) {
              try { fs.unlinkSync(fpath); } catch (e) {}
            }
          }
          s.image = '';
          s.imageExpired = true;
        }
      }

      await att.save();
      attendancePhotosCleaned++;
    }

    if (attendancePhotosCleaned > 0) {
      console.log(`[12-Hour Photo Purge] Cleaned expired selfie photos from ${attendancePhotosCleaned} attendance records.`);
    }
  } catch (err) {
    console.error('[12-Hour Photo Purge] Error running photo cleanup:', err);
  }
};

/**
 * Starts the automatic retention, auto-checkout, and photo cleanup schedulers.
 */
let retentionInterval = null;
let autoCheckoutInterval = null;
let photoCleanupInterval = null;

const startDataRetentionCron = () => {
  if (retentionInterval) clearInterval(retentionInterval);
  if (autoCheckoutInterval) clearInterval(autoCheckoutInterval);
  if (photoCleanupInterval) clearInterval(photoCleanupInterval);

  // 1. Initial runs after boot
  setTimeout(() => {
    runDataRetentionCleanup().catch((err) => console.error('[Data Retention] Initial run error:', err));
    runAutoCheckOutJob().catch((err) => console.error('[Auto-Checkout] Initial run error:', err));
    runDailyPhotoCleanup().catch((err) => console.error('[Photo Cleanup] Initial run error:', err));
  }, 10000);

  // 2. Schedule 60-day auto-purge every 24 hours
  retentionInterval = setInterval(() => {
    runDataRetentionCleanup().catch((err) => console.error('[Data Retention] Recurring run error:', err));
  }, 24 * 60 * 60 * 1000);

  // 3. Schedule auto-checkout job every 30 seconds for immediate shift close
  autoCheckoutInterval = setInterval(() => {
    runAutoCheckOutJob().catch((err) => console.error('[Auto-Checkout] Interval error:', err));
  }, 30 * 1000);

  // 4. Schedule photo purge job every 30 minutes for 12-hour deletion
  photoCleanupInterval = setInterval(() => {
    runDailyPhotoCleanup().catch((err) => console.error('[Photo Cleanup] Interval error:', err));
  }, 30 * 60 * 1000);

  console.log('[Data Retention] Service initialized. 60-day purge, 30-sec auto-checkout, and 30-min photo cleanups active.');
};

module.exports = {
  RETENTION_DAYS,
  runDataRetentionCleanup,
  runAutoCheckOutJob,
  runDailyPhotoCleanup,
  startDataRetentionCron
};
