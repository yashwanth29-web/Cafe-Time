const Cafe = require('../models/Cafe');
const Branch = require('../models/Branch');
const MenuItem = require('../models/MenuItem');
const Category = require('../models/Category');
const Inventory = require('../models/Inventory');
const InventoryCategory = require('../models/InventoryCategory');
const InventoryLog = require('../models/InventoryLog');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const OperationalConfig = require('../models/OperationalConfig');
const Review = require('../models/Review');
const User = require('../models/User');
const PaymentConfig = require('../models/PaymentConfig');

const migrateData = async () => {
  try {
    console.log('Starting data migration to Multi-Branch architecture...');

    // 1. Drop old unique indexes to prevent conflict
    try {
      await Category.collection.dropIndex('name_1_cafeId_1');
      console.log('Dropped Category unique index name_1_cafeId_1');
    } catch (e) {}

    try {
      await InventoryCategory.collection.dropIndex('name_1_cafeId_1');
      console.log('Dropped InventoryCategory unique index name_1_cafeId_1');
    } catch (e) {}

    try {
      await OperationalConfig.collection.dropIndex('cafeId_1');
      console.log('Dropped OperationalConfig unique index cafeId_1');
    } catch (e) {}

    try {
      await PaymentConfig.collection.dropIndex('cafeId_1');
      console.log('Dropped PaymentConfig unique index cafeId_1');
    } catch (e) {}

    // Drop old Inventory compound indexes that may conflict
    try {
      await Inventory.collection.dropIndex('cafeId_1_branch_1_name_1');
      console.log('Dropped Inventory unique index cafeId_1_branch_1_name_1');
    } catch (e) {}
    try {
      await Inventory.collection.dropIndex('cafeId_1_name_1');
      console.log('Dropped Inventory index cafeId_1_name_1');
    } catch (e) {}
    try {
      await Inventory.collection.dropIndex('cafeId_1_category_1');
      console.log('Dropped Inventory index cafeId_1_category_1');
    } catch (e) {}
    try {
      await Inventory.collection.dropIndex('cafeId_1_branch_1_status_1');
      console.log('Dropped Inventory index cafeId_1_branch_1_status_1');
    } catch (e) {}


    // 2. Fetch all cafes
    const cafes = await Cafe.find({});
    
    // Ensure at least one cafe exists (e.g. CD001)
    if (cafes.length === 0) {
      console.log('No cafes found. Creating default cafe CD001...');
      await Cafe.create({
        cafeId: 'CD001',
        name: 'Dr. Chai Cafe',
        ownerEmail: 'yashwanthbevara0@gmail.com',
        setupCompleted: true
      });
      cafes.push({ cafeId: 'CD001' });
    }

    // 3. For the default demo cafe 'CD001', ensure default branch exists
    const defaultBranch = await Branch.findOne({ branchId: 'default', cafeId: 'CD001' });
    if (!defaultBranch) {
      console.log(`Creating default branch for cafe CD001...`);
      await Branch.create({
        branchId: 'default',
        branchName: 'Main Branch',
        cafeId: 'CD001',
        address: 'Main Location Address',
        latitude: 16.5062,
        longitude: 80.6480,
        isActive: true
      });
    }

    // 4. Migrate operational collections
    // Migrate each collection, each wrapped in its own try/catch so one failure doesn't block others

    // MenuItem
    try {
      const menuResult = await MenuItem.updateMany(
        { branchId: { $exists: false } },
        { $set: { cafeId: 'CD001', branchId: 'default' } }
      );
      console.log(`Migrated MenuItem: ${menuResult.modifiedCount} records updated.`);
    } catch (e) { console.warn('MenuItem migration skipped:', e.message); }

    // Category
    try {
      const catResult = await Category.updateMany(
        { branchId: { $exists: false } },
        { $set: { cafeId: 'CD001', branchId: 'default' } }
      );
      console.log(`Migrated Category: ${catResult.modifiedCount} records updated.`);
    } catch (e) { console.warn('Category migration skipped:', e.message); }

    // Inventory
    try {
      const invResult = await Inventory.updateMany(
        { branchId: { $exists: false } },
        { $set: { cafeId: 'CD001', branchId: 'default' } }
      );
      console.log(`Migrated Inventory: ${invResult.modifiedCount} records updated.`);
    } catch (e) { console.warn('Inventory migration skipped:', e.message); }

    // InventoryCategory
    try {
      const invCatResult = await InventoryCategory.updateMany(
        { branchId: { $exists: false } },
        { $set: { cafeId: 'CD001', branchId: 'default' } }
      );
      console.log(`Migrated InventoryCategory: ${invCatResult.modifiedCount} records updated.`);
    } catch (e) { console.warn('InventoryCategory migration skipped:', e.message); }

    // InventoryLog
    try {
      const invLogResult = await InventoryLog.updateMany(
        { branchId: { $exists: false } },
        { $set: { cafeId: 'CD001', branchId: 'default' } }
      );
      console.log(`Migrated InventoryLog: ${invLogResult.modifiedCount} records updated.`);
    } catch (e) { console.warn('InventoryLog migration skipped:', e.message); }

    // Order
    try {
      const orderResult = await Order.updateMany(
        { branchId: { $exists: false } },
        { $set: { cafeId: 'CD001', branchId: 'default' } }
      );
      console.log(`Migrated Order: ${orderResult.modifiedCount} records updated.`);
    } catch (e) { console.warn('Order migration skipped:', e.message); }

    // Notification
    try {
      const notifResult = await Notification.updateMany(
        { branchId: { $exists: false } },
        { $set: { cafeId: 'CD001', branchId: 'default' } }
      );
      console.log(`Migrated Notification: ${notifResult.modifiedCount} records updated.`);
    } catch (e) { console.warn('Notification migration skipped:', e.message); }

    // OperationalConfig
    try {
      const opConfigResult = await OperationalConfig.updateMany(
        { branchId: { $exists: false } },
        { $set: { cafeId: 'CD001', branchId: 'default' } }
      );
      console.log(`Migrated OperationalConfig: ${opConfigResult.modifiedCount} records updated.`);
    } catch (e) { console.warn('OperationalConfig migration skipped:', e.message); }

    // Review
    try {
      const reviewResult = await Review.updateMany(
        { branchId: { $exists: false } },
        { $set: { cafeId: 'CD001', branchId: 'default' } }
      );
      console.log(`Migrated Review: ${reviewResult.modifiedCount} records updated.`);
    } catch (e) { console.warn('Review migration skipped:', e.message); }

    // PaymentConfig
    try {
      const paymentConfigResult = await PaymentConfig.updateMany(
        { branchId: { $exists: false } },
        { $set: { cafeId: 'CD001', branchId: 'default' } }
      );
      console.log(`Migrated PaymentConfig: ${paymentConfigResult.modifiedCount} records updated.`);
    } catch (e) { console.warn('PaymentConfig migration skipped:', e.message); }

    // User (Assigned branch for staff)
    try {
      const staffResult = await User.updateMany(
        { 
          role: { $in: ['manager', 'chef', 'waiter', 'cashier', 'staff'] }, 
          $or: [{ assignedBranch: { $exists: false } }, { assignedBranch: '' }] 
        },
        { $set: { assignedBranch: 'default' } }
      );
      console.log(`Migrated User (Staff branches): ${staffResult.modifiedCount} records updated.`);
    } catch (e) { console.warn('User migration skipped:', e.message); }

    // Ensure all existing branches have coordinates and allowed geofence radius configured (default to 100m)
    try {
      const branches = await Branch.find({});
      for (const branch of branches) {
        let updated = false;
        if (branch.latitude === undefined || branch.latitude === 0) {
          branch.latitude = 16.5062;
          updated = true;
        }
        if (branch.longitude === undefined || branch.longitude === 0) {
          branch.longitude = 80.6480;
          updated = true;
        }
        if (branch.allowedRadius === undefined || branch.allowedRadius === 30) {
          branch.allowedRadius = 100;
          updated = true;
        }
        if (!branch.openingTime) {
          branch.openingTime = '09:00 AM';
          updated = true;
        }
        if (!branch.closingTime) {
          branch.closingTime = '10:00 PM';
          updated = true;
        }
        if (updated) {
          await branch.save();
          console.log(`Updated coordinates/radius/business hours for branch: ${branch.branchId}`);
        }

        // Ensure PaymentConfig exists for the branch
        const payConf = await PaymentConfig.findOne({ cafeId: branch.cafeId, branchId: branch.branchId });
        if (!payConf) {
          await PaymentConfig.create({
            cafeId: branch.cafeId,
            branchId: branch.branchId,
            acceptCash: true,
            enableUpi: true,
            upiId: '9346540919@ybl',
            taxRate: 5,
            platformCharge: 0
          });
          console.log(`Created default PaymentConfig for branch: ${branch.branchId}`);
        }

        // Ensure OperationalConfig exists for the branch
        const opConf = await OperationalConfig.findOne({ cafeId: branch.cafeId, branchId: branch.branchId });
        if (!opConf) {
          await OperationalConfig.create({
            cafeId: branch.cafeId,
            branchId: branch.branchId,
            tables: [{ id: 'T1', seats: 4 }, { id: 'T2', seats: 4 }, { id: 'T3', seats: 4 }],
            printerEnabled: false,
            kitchenDisplayEnabled: true,
            inventoryEnabled: true
          });
          console.log(`Created default OperationalConfig for branch: ${branch.branchId}`);
        }
      }
    } catch (e) {
      console.warn('Branch configurations seeding skipped:', e.message);
    }

    console.log('Multi-branch data migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  }
};

module.exports = migrateData;
