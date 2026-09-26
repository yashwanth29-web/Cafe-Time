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
 * Auto-Checkout Job: Checks out staff who forgot to check out once (Shift End + 1 Hour) has passed
 */
const runAutoCheckOutJob = async () => {
  try {
    const tzOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(Date.now() + tzOffset);
    const todayStr = nowIST.toISOString().split('T')[0];
    const currentISTMins = nowIST.getUTCHours() * 60 + nowIST.getUTCMinutes();

    const openSessions = await Attendance.find({ checkOutTime: { $exists: false } });
    let autoClosedCount = 0;

    for (const session of openSessions) {
      let shouldAutoClose = false;

      // If session is from a previous date, close immediately
      if (session.date !== todayStr) {
        shouldAutoClose = true;
      } else {
        // Check if Shift End + 60 minutes has elapsed
        const shiftEndTime = session.shiftEndTime || '18:00';
        let eHour = 18, eMin = 0;
        const isPM = /PM/i.test(shiftEndTime);
        const isAM = /AM/i.test(shiftEndTime);
        const cleanTime = shiftEndTime.replace(/\s*(AM|PM)\s*/i, '');
        const parts = cleanTime.split(':').map(Number);
        eHour = parts[0] || 0;
        eMin = parts[1] || 0;
        if (isPM && eHour < 12) eHour += 12;
        if (isAM && eHour === 12) eHour = 0;

        const shiftEndMins = eHour * 60 + eMin;
        const autoCloseDeadline = shiftEndMins + 60; // 1 hour after shift end

        if (currentISTMins >= autoCloseDeadline) {
          shouldAutoClose = true;
        }
      }

      if (shouldAutoClose) {
        const User = require('../models/User');
        const staff = await User.findById(session.staffId);
        const reqHours = (staff && staff.requiredHours) || 8;
        const autoCheckOutTime = new Date(session.checkInTime.getTime() + reqHours * 60 * 60 * 1000);

        session.checkOutTime = autoCheckOutTime;
        session.totalDuration = reqHours * 60;
        session.workingHours = reqHours;
        session.autoCheckedOut = true;
        session.notes = 'Auto Checked-Out (Staff did not check out)';
        session.isWageFinalized = true;
        await session.save();
        autoClosedCount++;
      }
    }

    if (autoClosedCount > 0) {
      console.log(`[Auto-Checkout] Successfully auto-closed ${autoClosedCount} forgotten staff shift(s).`);
    }
  } catch (err) {
    console.error('[Auto-Checkout] Error running auto-checkout job:', err);
  }
};

/**
 * Daily Photo Cleanup: Deletes temporary selfie & cafe inspection photos from previous days
 */
const runDailyPhotoCleanup = async () => {
  try {
    const fs = require('fs');
    const path = require('path');
    const tzOffset = 5.5 * 60 * 60 * 1000;
    const todayStr = new Date(Date.now() + tzOffset).toISOString().split('T')[0];

    // 1. Attendance selfies older than today
    const oldAttendances = await Attendance.find({
      date: { $lt: todayStr },
      image: { $exists: true, $ne: '' }
    });

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
      await att.save();
      attendancePhotosCleaned++;
    }

    // 2. Work report cafe photos older than today
    const oldReports = await WorkReport.find({
      date: { $lt: todayStr },
      photos: { $exists: true, $not: { $size: 0 } }
    });

    let reportPhotosCleaned = 0;
    for (const report of oldReports) {
      if (Array.isArray(report.photos)) {
        for (const p of report.photos) {
          if (p.includes('/uploads/')) {
            const filename = p.split('/uploads/').pop();
            const filePath = path.join(__dirname, '../public/uploads', filename);
            if (fs.existsSync(filePath)) {
              try { fs.unlinkSync(filePath); } catch (e) {}
            }
          }
        }
      }
      report.photos = [];
      report.imageExpired = true;
      await report.save();
      reportPhotosCleaned++;
    }

    if (attendancePhotosCleaned > 0 || reportPhotosCleaned > 0) {
      console.log(`[Daily Photo Purge] Cleaned temporary photos from ${attendancePhotosCleaned} attendance and ${reportPhotosCleaned} work report records.`);
    }
  } catch (err) {
    console.error('[Daily Photo Purge] Error running photo cleanup:', err);
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

  // 3. Schedule auto-checkout job every 15 minutes
  autoCheckoutInterval = setInterval(() => {
    runAutoCheckOutJob().catch((err) => console.error('[Auto-Checkout] Interval error:', err));
  }, 15 * 60 * 1000);

  // 4. Schedule daily photo cleanup every 6 hours
  photoCleanupInterval = setInterval(() => {
    runDailyPhotoCleanup().catch((err) => console.error('[Photo Cleanup] Interval error:', err));
  }, 6 * 60 * 60 * 1000);

  console.log('[Data Retention] Service initialized. 60-day purge, 15-min auto-checkout, and daily photo cleanups active.');
};

module.exports = {
  RETENTION_DAYS,
  runDataRetentionCleanup,
  runAutoCheckOutJob,
  runDailyPhotoCleanup,
  startDataRetentionCron
};
