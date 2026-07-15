const cron = require('node-cron');
const mongoose = require('mongoose');
const Cafe = require('../models/Cafe');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Attendance = require('../models/Attendance');
const Payroll = require('../models/Payroll');
const Inventory = require('../models/Inventory');
const InventoryLog = require('../models/InventoryLog');
const MenuItem = require('../models/MenuItem');
const Category = require('../models/Category');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const Review = require('../models/Review');
const WorkReport = require('../models/WorkReport');
const SalaryHistory = require('../models/SalaryHistory');
const SupportTicket = require('../models/SupportTicket');
const SystemHealth = require('../models/SystemHealth');
const OperationalConfig = require('../models/OperationalConfig');
const PaymentConfig = require('../models/PaymentConfig');
const OtpVerification = require('../models/OtpVerification');
const InventoryCategory = require('../models/InventoryCategory');

const runPermanentDeletion = async () => {
  console.log('[Cafe Deletion Job] Scanning for cafes scheduled for permanent deletion...');
  try {
    const now = new Date();
    // Find all cafes soft-deleted where scheduledPermanentDeletionAt <= now
    const cafesToDelete = await Cafe.find({
      isDeleted: true,
      scheduledPermanentDeletionAt: { $lte: now }
    });

    if (cafesToDelete.length === 0) {
      console.log('[Cafe Deletion Job] No cafes scheduled for permanent deletion at this time.');
      return;
    }

    console.log(`[Cafe Deletion Job] Found ${cafesToDelete.length} cafe(s) to permanently delete.`);

    for (const cafe of cafesToDelete) {
      const cafeId = cafe.cafeId;
      console.log(`[Cafe Deletion Job] Starting permanent deletion for cafe: ${cafe.name} (${cafeId})...`);

      // Get user emails for cleaning up OTP
      const users = await User.find({ cafeId });
      const userEmails = users.map(u => u.email).filter(Boolean);

      // Get order IDs for cleaning up payments
      const orders = await Order.find({ cafeId });
      const orderIds = orders.map(o => o._id);

      // Try transaction
      let useTransaction = true;
      const session = await mongoose.startSession();
      try {
        session.startTransaction();
      } catch (e) {
        useTransaction = false;
      }

      try {
        const options = useTransaction ? { session } : {};

        // Delete from all collections
        await Cafe.deleteMany({ cafeId }, options);
        await Branch.deleteMany({ cafeId }, options);
        await User.deleteMany({ cafeId }, options);
        await Attendance.deleteMany({ cafeId }, options);
        await Payroll.deleteMany({ cafeId }, options);
        await Inventory.deleteMany({ cafeId }, options);
        await InventoryLog.deleteMany({ cafeId }, options);
        await MenuItem.deleteMany({ cafeId }, options);
        await Category.deleteMany({ cafeId }, options);
        await Order.deleteMany({ cafeId }, options);
        if (orderIds.length > 0) {
          await Payment.deleteMany({ appOrderId: { $in: orderIds } }, options);
        }
        await Notification.deleteMany({ cafeId }, options);
        await Review.deleteMany({ cafeId }, options);
        await WorkReport.deleteMany({ cafeId }, options);
        await SalaryHistory.deleteMany({ cafeId }, options);
        await SupportTicket.deleteMany({ cafeId }, options);
        await SystemHealth.deleteMany({ cafeId }, options);
        await OperationalConfig.deleteMany({ cafeId }, options);
        await PaymentConfig.deleteMany({ cafeId }, options);
        await InventoryCategory.deleteMany({ cafeId }, options);
        if (userEmails.length > 0) {
          await OtpVerification.deleteMany({ email: { $in: userEmails } }, options);
        }

        if (useTransaction) {
          await session.commitTransaction();
          console.log(`[Cafe Deletion Job] Successfully permanently deleted cafe ${cafeId} using transaction.`);
        } else {
          console.log(`[Cafe Deletion Job] Successfully permanently deleted cafe ${cafeId} (non-transaction fallback).`);
        }
      } catch (err) {
        if (useTransaction) {
          await session.abortTransaction();
        }
        console.error(`[Cafe Deletion Job] Transaction failed for cafe ${cafeId}. Rolled back. Error:`, err);
      } finally {
        session.endSession();
      }
    }
  } catch (error) {
    console.error('[Cafe Deletion Job] Error scanning/deleting cafes:', error);
  }
};

const initCafeDeletionJob = () => {
  console.log('[Cafe Deletion Job] Initializing scheduled job (every hour)...');
  
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    await runPermanentDeletion();
  });

  // Run on startup (after 10s to let server settle)
  setTimeout(async () => {
    await runPermanentDeletion();
  }, 10000);
};

module.exports = {
  initCafeDeletionJob,
  runPermanentDeletion
};
