const Inventory = require('../models/Inventory');
const InventoryLog = require('../models/InventoryLog');
const OperationalConfig = require('../models/OperationalConfig');

const Branch = require('../models/Branch');

const emitInventoryUpdated = async (cafeId, branchId, itemsList) => {
  try {
    const { getIO } = require('../config/socket');
    const io = getIO();
    const mongoose = require('mongoose');
    
    let branchStr = String(branchId || 'Main');
    
    // Resolve database ObjectId to string code (e.g. BR002) if needed
    if (mongoose.isValidObjectId(branchStr)) {
      const Branch = require('../models/Branch');
      const branchDoc = await Branch.findById(branchStr).lean();
      if (branchDoc) {
        branchStr = branchDoc.branchId;
      }
    }
    
    const arr = Array.isArray(itemsList) ? itemsList : [itemsList];
    const payload = arr.map(item => ({
      _id: String(item._id),
      name: item.name,
      quantity: item.quantity,
      reorderLevel: item.reorderLevel,
      unit: item.unit,
      branch: item.branch,
      updatedAt: item.updatedAt || new Date().toISOString()
    }));
    
    io.to(`branch:${branchStr}`).emit('inventoryUpdated', payload);
    io.to(`cafe:${cafeId}:owner`).emit('inventoryUpdated', payload);
    
    console.log(`[SOCKET] Broadcasted inventoryUpdated for ${payload.length} items to branch:${branchStr} and cafe:${cafeId}:owner`);
  } catch (err) {
    console.error('[SOCKET] Error emitting inventoryUpdated:', err.message);
  }
};

const menuCache = require('../utils/menuCache');

// Helper to seed default inventory items for a cafe if empty (using updated fields)
const seedDefaultInventory = async (cafeId, branchId = 'default', createdBy = 'system', options = {}) => {
  const defaults = [
    // Tea Ingredients
    { name: 'Tea Leaves', quantity: 5000, reorderLevel: 1000, unit: 'g', costPrice: 0.5, category: 'Tea Ingredients', supplier: 'Dr. Chai Wholesale', branch: branchId },
    { name: 'Milk', quantity: 20000, reorderLevel: 5000, unit: 'ml', costPrice: 0.06, category: 'Tea Ingredients', supplier: 'Local Dairy', branch: branchId },
    { name: 'Sugar', quantity: 10000, reorderLevel: 2000, unit: 'g', costPrice: 0.04, category: 'Tea Ingredients', supplier: 'Local Grocery', branch: branchId },
    { name: 'Cardamom', quantity: 500, reorderLevel: 100, unit: 'g', costPrice: 2.5, category: 'Tea Ingredients', supplier: 'Spices Emporium', branch: branchId },
    { name: 'Ginger', quantity: 1000, reorderLevel: 200, unit: 'g', costPrice: 0.15, category: 'Tea Ingredients', supplier: 'Spices Emporium', branch: branchId },
    { name: 'Jaggery', quantity: 2000, reorderLevel: 500, unit: 'g', costPrice: 0.08, category: 'Tea Ingredients', supplier: 'Local Grocery', branch: branchId },

    // Coffee Ingredients
    { name: 'Coffee Powder', quantity: 3000, reorderLevel: 500, unit: 'g', costPrice: 0.8, category: 'Coffee Ingredients', supplier: 'Dr. Chai Wholesale', branch: branchId },
    { name: 'Chocolate Syrup', quantity: 2000, reorderLevel: 500, unit: 'ml', costPrice: 0.3, category: 'Coffee Ingredients', supplier: 'Baker Premium', branch: branchId },
    { name: 'Hazelnut Syrup', quantity: 1000, reorderLevel: 250, unit: 'ml', costPrice: 0.4, category: 'Coffee Ingredients', supplier: 'Baker Premium', branch: branchId },

    // Juice Ingredients
    { name: 'Lemon Juice', quantity: 2000, reorderLevel: 500, unit: 'ml', costPrice: 0.1, category: 'Juice Ingredients', supplier: 'Fresh Fruits Ltd', branch: branchId },
    { name: 'Soda Water', quantity: 15000, reorderLevel: 3000, unit: 'ml', costPrice: 0.02, category: 'Juice Ingredients', supplier: 'SodaHub', branch: branchId },
    { name: 'Sugar Syrup', quantity: 5000, reorderLevel: 1000, unit: 'ml', costPrice: 0.03, category: 'Juice Ingredients', supplier: 'Local Grocery', branch: branchId },
    { name: 'Watermelon Fruit', quantity: 10000, reorderLevel: 2000, unit: 'g', costPrice: 0.05, category: 'Juice Ingredients', supplier: 'Fresh Fruits Ltd', branch: branchId },
    { name: 'Musk Melon Fruit', quantity: 10000, reorderLevel: 2000, unit: 'g', costPrice: 0.06, category: 'Juice Ingredients', supplier: 'Fresh Fruits Ltd', branch: branchId },
    { name: 'Curd', quantity: 8000, reorderLevel: 2000, unit: 'g', costPrice: 0.08, category: 'Juice Ingredients', supplier: 'Local Dairy', branch: branchId },
    { name: 'Mango Pulp', quantity: 5000, reorderLevel: 1000, unit: 'ml', costPrice: 0.15, category: 'Juice Ingredients', supplier: 'Fresh Fruits Ltd', branch: branchId },

    // Milkshake Ingredients
    { name: 'Vanilla Essence', quantity: 500, reorderLevel: 100, unit: 'ml', costPrice: 0.5, category: 'Milkshake Ingredients', supplier: 'Baker Premium', branch: branchId },
    { name: 'Strawberry Syrup', quantity: 2000, reorderLevel: 500, unit: 'ml', costPrice: 0.3, category: 'Milkshake Ingredients', supplier: 'Baker Premium', branch: branchId },
    { name: 'Ice Cream', quantity: 5000, reorderLevel: 1000, unit: 'g', costPrice: 0.25, category: 'Milkshake Ingredients', supplier: 'Local Dairy', branch: branchId },

    // Bakery Items
    { name: 'Biscuit Pack', quantity: 100, reorderLevel: 20, unit: 'pc', costPrice: 5, category: 'Bakery Items', supplier: 'Baker Premium', branch: branchId },
    { name: 'Veg Puff Raw', quantity: 50, reorderLevel: 10, unit: 'pc', costPrice: 10, category: 'Bakery Items', supplier: 'Baker Premium', branch: branchId },
    { name: 'Egg Puff Raw', quantity: 50, reorderLevel: 10, unit: 'pc', costPrice: 12, category: 'Bakery Items', supplier: 'Baker Premium', branch: branchId },
    { name: 'Chicken Puff Raw', quantity: 50, reorderLevel: 10, unit: 'pc', costPrice: 15, category: 'Bakery Items', supplier: 'Baker Premium', branch: branchId },
    { name: 'Bun', quantity: 60, reorderLevel: 15, unit: 'pc', costPrice: 8, category: 'Bakery Items', supplier: 'Baker Premium', branch: branchId },
    { name: 'Butter', quantity: 2000, reorderLevel: 500, unit: 'g', costPrice: 0.45, category: 'Bakery Items', supplier: 'Local Dairy', branch: branchId },

    // Snacks
    { name: 'Samosa Raw', quantity: 100, reorderLevel: 20, unit: 'pc', costPrice: 6, category: 'Snacks', supplier: 'Baker Premium', branch: branchId },
    { name: 'Bread Slices', quantity: 120, reorderLevel: 30, unit: 'pc', costPrice: 1.5, category: 'Snacks', supplier: 'Baker Premium', branch: branchId },
    { name: 'Cucumber', quantity: 3000, reorderLevel: 500, unit: 'g', costPrice: 0.05, category: 'Snacks', supplier: 'Fresh Fruits Ltd', branch: branchId },
    { name: 'Tomato', quantity: 3000, reorderLevel: 500, unit: 'g', costPrice: 0.06, category: 'Snacks', supplier: 'Fresh Fruits Ltd', branch: branchId },
    { name: 'Potato Fries Raw', quantity: 10000, reorderLevel: 2000, unit: 'g', costPrice: 0.12, category: 'Snacks', supplier: 'Dr. Chai Wholesale', branch: branchId },
    { name: 'Salt', quantity: 5000, reorderLevel: 1000, unit: 'g', costPrice: 0.02, category: 'Snacks', supplier: 'Local Grocery', branch: branchId },

    // Packaging Materials
    { name: 'Tea Cups', quantity: 500, reorderLevel: 100, unit: 'pc', costPrice: 1.2, category: 'Packaging Materials', supplier: 'PackSource', branch: branchId },
    { name: 'Coffee Cups', quantity: 400, reorderLevel: 100, unit: 'pc', costPrice: 1.5, category: 'Packaging Materials', supplier: 'PackSource', branch: branchId },
    { name: 'Paper Bags', quantity: 300, reorderLevel: 50, unit: 'pc', costPrice: 2.0, category: 'Packaging Materials', supplier: 'PackSource', branch: branchId },
    { name: 'Straws', quantity: 1000, reorderLevel: 200, unit: 'pc', costPrice: 0.2, category: 'Packaging Materials', supplier: 'PackSource', branch: branchId },

    // Cleaning Supplies
    { name: 'Dish Soap', quantity: 5000, reorderLevel: 1000, unit: 'ml', costPrice: 0.08, category: 'Cleaning Supplies', supplier: 'Local Grocery', branch: branchId },
    { name: 'Hand Sanitizer', quantity: 2000, reorderLevel: 500, unit: 'ml', costPrice: 0.15, category: 'Cleaning Supplies', supplier: 'Local Grocery', branch: branchId },
    { name: 'Floor Cleaner', quantity: 3000, reorderLevel: 500, unit: 'ml', costPrice: 0.10, category: 'Cleaning Supplies', supplier: 'Local Grocery', branch: branchId }
  ];

  const existingItems = await Inventory.find({
    cafeId,
    $or: [{ branch: branchId }, { branchId: branchId }]
  }).session(options.session || null).lean();

  const existingNames = new Set(existingItems.map(i => i.name.toLowerCase().trim()));

  const itemsToCreate = defaults
    .filter(item => !existingNames.has(item.name.toLowerCase().trim()))
    .map(item => {
      const qty = item.quantity || 0;
      const reorder = item.reorderLevel || 0;
      const status = qty <= 0 ? 'OUT_OF_STOCK' : (qty <= reorder ? 'LOW_STOCK' : 'IN_STOCK');
      return {
        ...item,
        cafeId,
        branch: branchId,
        branchId: branchId,
        stock: qty,
        minStock: reorder,
        cost: item.costPrice || 0,
        sellingPrice: 0,
        createdBy,
        status
      };
    });

  if (itemsToCreate.length > 0) {
    return await Inventory.insertMany(itemsToCreate, options);
  }
  return [];
};

const getInventory = async (req, res, next) => {
  try {
    const cafeId = req.user.cafeId || 'CD001';
    const reqBranchId = req.query.branchId || req.headers['x-branch-id'];
    const query = { cafeId };
    
    const isStaff = ['manager', 'chef', 'waiter', 'cashier', 'staff'].includes((req.user.role || '').toLowerCase());
    if (isStaff && req.user.assignedBranch) {
      query.$or = [{ branch: req.user.assignedBranch }, { branchId: req.user.assignedBranch }];
    } else if (reqBranchId) {
      query.$or = [{ branch: reqBranchId }, { branchId: reqBranchId }];
    }
    
    const totalItemsCount = await Inventory.countDocuments(query);
    const hasDemo = await Inventory.exists({ cafeId, name: { $in: ['Burger Buns', 'Chicken Patties', 'Coffee Beans'] } });

    const seedBranch = reqBranchId || (isStaff ? req.user.assignedBranch : 'default');

    // Auto-seed if database contains no inventory for this branch or contains old demo data
    if (totalItemsCount === 0 || hasDemo) {
      console.log(`Clearing old demo inventory items and seeding actual Dr. Chai Cafe inventory for branch: ${seedBranch}...`);
      await Inventory.deleteMany({ cafeId, $or: [{ branch: seedBranch }, { branchId: seedBranch }] });
      await seedDefaultInventory(cafeId, seedBranch);
    }

    // Reuse the exact same branch-aware query to find items, sorting them alphabetically
    const items = await Inventory.find(query).sort({ name: 1 });

    return res.status(200).json({ success: true, count: items.length, data: items });
  } catch (error) {
    error.controllerName = 'inventoryController';
    error.serviceName = 'getInventory';
    next(error);
  }
};

// @desc    Create inventory item
// @route   POST /api/inventory
// @access  Protected (Owner/Admin)
const createInventoryItem = async (req, res, next) => {
  try {
    const cafeId = req.user.cafeId || 'CD001';
    const branchId = req.branchId || 'default';
    const { name, itemName, stock, quantity, minStock, reorderLevel, unit, cost, costPrice, sellingPrice, supplier, branch, category } = req.body;

    const finalName = (name || itemName || '').trim();
    const finalQuantity = Number(quantity !== undefined ? quantity : (stock !== undefined ? stock : 0));
    const finalReorderLevel = Number(reorderLevel !== undefined ? reorderLevel : (minStock !== undefined ? minStock : 0));
    const finalCostPrice = Number(costPrice !== undefined ? costPrice : (cost !== undefined ? cost : 0));
    const finalSellingPrice = Number(sellingPrice || 0);

    if (!finalName || !unit) {
      return res.status(400).json({ success: false, message: 'Item name and unit are required' });
    }

    const newItem = new Inventory({
      cafeId,
      branchId,
      name: finalName,
      quantity: finalQuantity,
      unit: unit.trim(),
      costPrice: finalCostPrice,
      sellingPrice: finalSellingPrice,
      supplier: (supplier || '').trim(),
      branch: (branch || 'Main').trim(),
      reorderLevel: finalReorderLevel,
      category: (category || 'Ingredients').trim()
    });

    const savedItem = await newItem.save();

    // Create Initial Log
    await InventoryLog.create({
      cafeId,
      branchId,
      itemId: savedItem._id,
      itemName: savedItem.name,
      type: 'Initial',
      quantityChanged: finalQuantity,
      cost: finalCostPrice * finalQuantity,
      reason: 'Initial stock setup',
      userEmail: req.user?.email || 'admin@cafe.com'
    });

    emitInventoryUpdated(cafeId, savedItem.branchId || savedItem.branch || 'default', savedItem);
    await updateMenuItemAvailabilityFromInventory(cafeId, null, savedItem.branchId || 'default');
    return res.status(201).json({ success: true, data: savedItem });
  } catch (error) {
    error.controllerName = 'inventoryController';
    error.serviceName = 'createInventoryItem';
    next(error);
  }
};

// @desc    Update inventory item
// @route   PATCH /api/inventory/:id
// @access  Protected (Owner, Manager)
const updateInventoryItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cafeId = req.user.cafeId || 'CD001';
    const branchId = req.branchId || 'default';
    
    const item = await Inventory.findOne({ _id: id, cafeId }, null, { bypassBranchFilter: true });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found or unauthorized' });
    }

    const { name, itemName, quantity, stock, reorderLevel, minStock, unit, cost, costPrice, sellingPrice, supplier, branch, category, status } = req.body;

    const oldQuantity = item.quantity;

    if (name !== undefined) item.name = name.trim();
    if (itemName !== undefined) item.name = itemName.trim();
    if (quantity !== undefined) item.quantity = Number(quantity);
    else if (stock !== undefined) item.quantity = Number(stock);
    
    if (reorderLevel !== undefined) item.reorderLevel = Number(reorderLevel);
    else if (minStock !== undefined) item.reorderLevel = Number(minStock);

    if (unit !== undefined) item.unit = unit.trim();
    
    if (costPrice !== undefined) item.costPrice = Number(costPrice);
    else if (cost !== undefined) item.costPrice = Number(cost);

    if (sellingPrice !== undefined) item.sellingPrice = Number(sellingPrice);
    if (supplier !== undefined) item.supplier = supplier.trim();
    if (branch !== undefined) item.branch = branch.trim();
    if (category !== undefined) item.category = category.trim();
    if (status !== undefined) item.status = status;

    const savedItem = await item.save();
    emitInventoryUpdated(cafeId, savedItem.branch || 'Main', savedItem);

    // Record adjustment log if quantity changed
    if (oldQuantity !== savedItem.quantity) {
      const difference = savedItem.quantity - oldQuantity;
      await InventoryLog.create({
        cafeId,
        branchId,
        itemId: savedItem._id,
        itemName: savedItem.name,
        type: 'Adjustment',
        quantityChanged: difference,
        cost: savedItem.costPrice * difference,
        reason: 'Manual quantity adjustment',
        userEmail: req.user?.email || 'admin@cafe.com'
      });
    }

    // Auto-update menu availability
    await updateMenuItemAvailabilityFromInventory(cafeId, null, branchId);

    return res.status(200).json({ success: true, data: savedItem });
  } catch (error) {
    error.controllerName = 'inventoryController';
    error.serviceName = 'updateInventoryItem';
    next(error);
  }
};

// @desc    Delete inventory item
// @route   DELETE /api/inventory/:id
// @access  Protected (Owner/Admin)
const deleteInventoryItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cafeId = req.user.cafeId || 'CD001';
    const branchId = req.branchId || 'default';

    const deletedItem = await Inventory.findOneAndDelete({ _id: id, cafeId }, { bypassBranchFilter: true });
    if (!deletedItem) {
      return res.status(404).json({ success: false, message: 'Inventory item not found or unauthorized' });
    }

    return res.status(200).json({ success: true, message: 'Inventory item deleted successfully' });
  } catch (error) {
    error.controllerName = 'inventoryController';
    error.serviceName = 'deleteInventoryItem';
    next(error);
  }
};

// @desc    Get all inventory movement logs
// @route   GET /api/inventory/logs
// @access  Protected (Owner, Manager)
const getInventoryLogs = async (req, res, next) => {
  try {
    const cafeId = req.user.cafeId || 'CD001';
    const isStaff = ['manager', 'chef', 'waiter', 'cashier', 'staff'].includes((req.user?.role || '').toLowerCase());
    const queryBranch = req.query.branchId || req.headers['x-branch-id'];
    
    const query = { cafeId };
    if (isStaff && req.user?.assignedBranch) {
      query.branchId = req.user.assignedBranch;
    } else if (queryBranch) {
      query.branchId = queryBranch;
    }

    const logs = await InventoryLog.find(query).sort({ createdAt: -1 }).limit(200).lean();
    return res.status(200).json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    error.controllerName = 'inventoryController';
    error.serviceName = 'getInventoryLogs';
    next(error);
  }
};

// @desc    Add Purchase Entry (Increments stock & records log)
// @route   POST /api/inventory/purchase
// @access  Protected (Owner, Manager)
const recordPurchase = async (req, res, next) => {
  try {
    const cafeId = req.user.cafeId || 'CD001';
    const branchId = req.branchId || 'default';
    const { itemId, quantityAdded, costPrice, supplier, notes } = req.body;

    if (!itemId || !quantityAdded || quantityAdded <= 0) {
      return res.status(400).json({ success: false, message: 'Item ID and valid Quantity Added are required' });
    }

    const item = await Inventory.findOne({ _id: itemId, cafeId }, null, { bypassBranchFilter: true });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    item.quantity += Number(quantityAdded);
    if (costPrice !== undefined) {
      item.costPrice = Number(costPrice);
    }
    if (supplier) {
      item.supplier = supplier.trim();
    }
    await item.save();
    emitInventoryUpdated(cafeId, item.branch || 'Main', item);

    const newLog = await InventoryLog.create({
      cafeId,
      branchId,
      itemId: item._id,
      itemName: item.name,
      type: 'Purchase',
      quantityChanged: Number(quantityAdded),
      cost: Number(costPrice || item.costPrice) * Number(quantityAdded),
      reason: notes || 'Purchase entry added by manager',
      userEmail: req.user.email || 'manager@cafe.com'
    });

    // Auto-update menu availability
    await updateMenuItemAvailabilityFromInventory(cafeId, null, branchId);

    return res.status(200).json({ success: true, message: 'Purchase entry added successfully', data: item, log: newLog });
  } catch (error) {
    error.controllerName = 'inventoryController';
    error.serviceName = 'recordPurchase';
    next(error);
  }
};

// @desc    Record Wastage / Damaged items (Decrements stock & records log)
// @route   POST /api/inventory/wastage
// @access  Protected (Owner, Manager)
const recordWastage = async (req, res, next) => {
  try {
    const cafeId = req.user.cafeId || 'CD001';
    const branchId = req.branchId || 'default';
    const { itemId, quantityWasted, type, reason } = req.body;

    if (!itemId || !quantityWasted || quantityWasted <= 0 || !type) {
      return res.status(400).json({ success: false, message: 'Item ID, valid Quantity Wasted, and Type (Wastage/Damaged) are required' });
    }

    const item = await Inventory.findOne({ _id: itemId, cafeId }, null, { bypassBranchFilter: true });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    if (item.quantity < quantityWasted) {
      return res.status(400).json({ success: false, message: `Insufficient stock. Current stock is ${item.quantity}` });
    }

    item.quantity -= Number(quantityWasted);
    await item.save();
    emitInventoryUpdated(cafeId, item.branch || 'Main', item);

    const newLog = await InventoryLog.create({
      cafeId,
      branchId,
      itemId: item._id,
      itemName: item.name,
      type: type === 'Damaged' ? 'Damaged' : 'Wastage',
      quantityChanged: -Number(quantityWasted),
      cost: item.costPrice * Number(quantityWasted),
      reason: reason || `${type} recorded by manager`,
      userEmail: req.user.email || 'manager@cafe.com'
    });

    // Auto-update menu availability
    await updateMenuItemAvailabilityFromInventory(cafeId, null, branchId);

    return res.status(200).json({ success: true, message: 'Wastage recorded successfully', data: item, log: newLog });
  } catch (error) {
    error.controllerName = 'inventoryController';
    error.serviceName = 'recordWastage';
    next(error);
  }
};

// @desc    Report Shortage (Chef flags stock issue)
// @route   POST /api/inventory/shortage
// @access  Protected (Owner, Manager, Chef)
const reportShortage = async (req, res, next) => {
  try {
    const cafeId = req.user.cafeId || 'CD001';
    const branchId = req.branchId || 'default';
    const { itemId, reason } = req.body;

    if (!itemId) {
      return res.status(400).json({ success: false, message: 'Item ID is required' });
    }

    const item = await Inventory.findOne({ _id: itemId, cafeId }, null, { bypassBranchFilter: true });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    if (item.status === 'IN_STOCK') {
      item.status = 'LOW_STOCK';
      await item.save();
    }

    const newLog = await InventoryLog.create({
      cafeId,
      branchId,
      itemId: item._id,
      itemName: item.name,
      type: 'Shortage',
      quantityChanged: 0,
      cost: 0,
      reason: reason || 'Chef reported stock shortage',
      userEmail: req.user.email || 'chef@cafe.com'
    });

    return res.status(200).json({ success: true, message: 'Shortage reported successfully', data: item, log: newLog });
  } catch (error) {
    error.controllerName = 'inventoryController';
    error.serviceName = 'reportShortage';
    next(error);
  }
};

// @desc    Get Wastage reports
// @route   GET /api/inventory/reports/wastage
// @access  Protected (Owner Only)
const getWastageReport = async (req, res, next) => {
  try {
    const cafeId = req.user.cafeId || 'CD001';
    const isStaff = ['manager', 'chef', 'waiter', 'cashier', 'staff'].includes((req.user?.role || '').toLowerCase());
    const queryBranch = req.query.branchId || req.headers['x-branch-id'];
    
    const query = { cafeId, type: { $in: ['Wastage', 'Damaged'] } };
    if (isStaff && req.user?.assignedBranch) {
      query.branchId = req.user.assignedBranch;
    } else if (queryBranch && queryBranch !== 'all') {
      query.branchId = queryBranch;
    }

    const logs = await InventoryLog.find(query).sort({ createdAt: -1 });
    const totalCost = logs.reduce((sum, log) => sum + (log.cost || 0), 0);
    const count = logs.length;

    return res.status(200).json({ success: true, totalCost, count, data: logs });
  } catch (error) {
    error.controllerName = 'inventoryController';
    error.serviceName = 'getWastageReport';
    next(error);
  }
};

// @desc    Get Consumption reports
// @route   GET /api/inventory/reports/consumption
// @access  Protected (Owner Only)
const getConsumptionReport = async (req, res, next) => {
  try {
    const cafeId = req.user.cafeId || 'CD001';
    const isStaff = ['manager', 'chef', 'waiter', 'cashier', 'staff'].includes((req.user?.role || '').toLowerCase());
    const queryBranch = req.query.branchId || req.headers['x-branch-id'];
    
    const query = { cafeId, type: 'Deduction' };
    if (isStaff && req.user?.assignedBranch) {
      query.branchId = req.user.assignedBranch;
    } else if (queryBranch && queryBranch !== 'all') {
      query.branchId = queryBranch;
    }

    const logs = await InventoryLog.find(query).sort({ createdAt: -1 });
    const totalCost = logs.reduce((sum, log) => sum + (log.cost || 0), 0);
    const count = logs.length;

    return res.status(200).json({ success: true, totalCost, count, data: logs });
  } catch (error) {
    error.controllerName = 'inventoryController';
    error.serviceName = 'getConsumptionReport';
    next(error);
  }
};

// Recipe Mapping configurations for Auto-Deductions
const RECIPES = {
  'burger': [
    { name: 'Burger Buns', quantity: 1 },
    { name: 'Chicken Patties', quantity: 1 },
    { name: 'Burger Sauce', quantity: 10 } // 10 grams
  ],
  'coffee': [
    { name: 'Coffee Beans', quantity: 0.02 }, // 0.02 kg
    { name: 'Milk Carton', quantity: 0.2 } // 0.2 Liters
  ],
  'cappuccino': [
    { name: 'Coffee Beans', quantity: 0.02 },
    { name: 'Milk Carton', quantity: 0.25 }
  ],
  'latte': [
    { name: 'Coffee Beans', quantity: 0.02 },
    { name: 'Milk Carton', quantity: 0.3 }
  ],
  'espresso': [
    { name: 'Coffee Beans', quantity: 0.015 }
  ],
  'tea': [
    { name: 'Tea Leaves', quantity: 10 }, // 10 grams
    { name: 'Milk Carton', quantity: 0.1 }
  ],
  'sandwich': [
    { name: 'Bread Slices', quantity: 2 },
    { name: 'Cheese Slice', quantity: 1 }
  ]
};

const updateMenuItemAvailabilityFromInventory = async (cafeId, itemId = null, branchId = 'default') => {
  try {
    const MenuItem = require('../models/MenuItem');
    const query = itemId ? { _id: itemId, cafeId } : { cafeId, branchId };
    const menuItems = await MenuItem.find(query);
    if (menuItems.length === 0) return;

    const ingredientNamesSet = new Set();
    for (const item of menuItems) {
      if (item.recipe && item.recipe.length > 0) {
        for (const ing of item.recipe) {
          if (ing.name) {
            ingredientNamesSet.add(ing.name);
          }
        }
      }
    }

    if (ingredientNamesSet.size === 0) return;

    const relevantInventory = await Inventory.find({
      cafeId,
      branchId,
      name: { $in: Array.from(ingredientNamesSet) }
    }).lean();

    const invMap = {};
    for (const inv of relevantInventory) {
      const key = `${inv.branchId || inv.branch || 'default'}_${inv.name.toLowerCase()}`;
      invMap[key] = inv.quantity !== undefined ? inv.quantity : inv.stock;
    }

    const updatePromises = [];
    for (const item of menuItems) {
      const activeBId = item.branchId || branchId || 'default';
      if (item.recipe && item.recipe.length > 0) {
        let shouldBeAvailable = true;
        for (const ing of item.recipe) {
          const key = `${activeBId}_${ing.name.toLowerCase()}`;
          const currentQty = invMap[key] || 0;
          if (currentQty < ing.quantity) {
            shouldBeAvailable = false;
            break;
          }
        }
        
        if (item.available !== shouldBeAvailable) {
          item.available = shouldBeAvailable;
          const savePromise = MenuItem.updateOne(
            { _id: item._id },
            { $set: { available: shouldBeAvailable } }
          ).then(() => {
            console.log(`Auto-updated menu item "${item.name}" availability to ${shouldBeAvailable} based on inventory levels.`);
            try {
              const { getIO } = require('../config/socket');
              const io = getIO();
              if (io) {
                const payload = {
                  _id: String(item._id),
                  name: item.name,
                  available: shouldBeAvailable,
                  updatedAt: new Date().toISOString()
                };
                io.to(`cafe:${cafeId}`).emit('menuAvailabilityUpdated', payload);
                io.to(`cafe_${cafeId}`).emit('menuAvailabilityUpdated', payload);
              }
            } catch (socketErr) {
              console.error('[SOCKET] Error emitting menuAvailabilityUpdated:', socketErr.message);
            }
          });
          updatePromises.push(savePromise);
        }
      }
    }
    
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }
    
    menuCache.clearMenu(cafeId, branchId);
  } catch (err) {
    console.error('Error auto-updating menu item availability:', err);
  }
};

// Centralized, transaction-safe dynamic inventory deduction service
const deductInventoryForOrder = async (orderId, cafeId, items) => {
  const Order = require('../models/Order');
  const MenuItem = require('../models/MenuItem');
  const mongoose = require('mongoose');

  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    // 1. Atomically mark the order as deducted to prevent concurrent race conditions
    // and verify paymentStatus is Paid and not cancelled/failed/expired
    const order = await Order.findOneAndUpdate(
      { 
        _id: orderId, 
        inventoryDeducted: { $ne: true },
        paymentStatus: 'Paid',
        status: { $nin: ['Cancelled', 'Failed', 'Expired'] }
      },
      { $set: { inventoryDeducted: true } },
      { session, returnDocument: 'after', bypassBranchFilter: true }
    );

    if (!order) {
      console.log(`[INVENTORY] Order ${orderId} already processed, unpaid, or cancelled. Skipping deduction.`);
      await session.abortTransaction();
      session.endSession();
      return;
    }

    const branchId = order.branchId || 'default';
    const opConfig = await OperationalConfig.findOne({ cafeId, branchId }).session(session);
    const isEnabled = opConfig ? opConfig.inventoryEnabled : true;
    if (!isEnabled) {
      console.log(`[INVENTORY] Inventory tracking is disabled for branch ${branchId}. Committing and exiting.`);
      await session.commitTransaction();
      session.endSession();
      return;
    }

    // 2. Batch fetch MenuItem details matching itemIds or names, strictly scoped to this cafe and branch to prevent recipe leakages
    const itemIds = items.map(item => item.id).filter(id => mongoose.isValidObjectId(id));
    const itemNames = items.map(item => item.name);
    
    const menuItems = await MenuItem.find({
      $or: [
        { _id: { $in: itemIds } },
        { name: { $in: itemNames } }
      ],
      cafeId,
      branchId
    }).session(session).lean();

    const menuItemMap = new Map();
    menuItems.forEach(mi => {
      menuItemMap.set(String(mi._id), mi);
      menuItemMap.set(mi.name, mi);
    });

    const ingredientDeductionList = [];
    const ingredientNamesSet = new Set();

    for (const item of items) {
      const orderQty = item.quantity || 0;
      if (orderQty <= 0) continue;

      const menuItem = menuItemMap.get(String(item.id)) || menuItemMap.get(item.name);
      if (!menuItem || !menuItem.recipe || menuItem.recipe.length === 0) {
        // Skip deduction when recipe is missing (Req 10)
        console.log(`[INVENTORY] Recipe missing for item "${item.name}". Skipping deduction for this item.`);
        continue;
      }

      for (const ing of menuItem.recipe) {
        const qtyToDeduct = ing.quantity * orderQty;
        ingredientNamesSet.add(ing.name);
        ingredientDeductionList.push({
          name: ing.name,
          deductionQty: qtyToDeduct,
          orderQty,
          itemName: item.name,
          menuItemId: menuItem._id,
          recipeUnit: ing.unit || ''
        });
      }
    }

    if (ingredientDeductionList.length === 0) {
      console.log(`[INVENTORY] No recipes or ingredients to deduct for order ${orderId}. Committing.`);
      await session.commitTransaction();
      session.endSession();
      // Auto-update availability for the branch
      await updateMenuItemAvailabilityFromInventory(cafeId, null, branchId);
      return;
    }

    // 3. Batch fetch current inventory stock levels and acquire transaction-level write lock
    const ingredientNames = Array.from(ingredientNamesSet);
    const inventoryItems = await Inventory.find({
      cafeId,
      branchId,
      name: { $in: ingredientNames }
    }).session(session);

    const inventoryMap = new Map();
    inventoryItems.forEach(inv => {
      inventoryMap.set(inv.name, inv);
    });

    const bulkOps = [];
    const logsToCreate = [];
    const affectedIngredients = [];

    // Structured unit conversion helper (handles mass, volume, piece, unit, packet)
    const convertUnits = (quantity, fromUnit, toUnit) => {
      if (!fromUnit || !toUnit) return quantity;
      const f = fromUnit.toLowerCase().trim();
      const t = toUnit.toLowerCase().trim();
      if (f === t) return quantity;

      // Mass (kg <-> g)
      if ((f === 'kg' || f === 'kilogram') && (t === 'g' || t === 'gram')) return quantity * 1000;
      if ((f === 'g' || f === 'gram') && (t === 'kg' || t === 'kilogram')) return quantity / 1000;

      // Volume (litre <-> ml)
      if ((f === 'l' || f === 'litre' || f === 'liter') && (t === 'ml' || t === 'milliliter')) return quantity * 1000;
      if ((f === 'ml' || f === 'milliliter') && (t === 'l' || t === 'litre' || t === 'liter')) return quantity / 1000;

      return quantity; // Fallback for piece, unit, packet
    };

    for (const ded of ingredientDeductionList) {
      const invItem = inventoryMap.get(ded.name);
      if (!invItem) {
        // Skip deduction when ingredient is missing (Req 10)
        console.warn(`[INVENTORY] Ingredient "${ded.name}" missing in inventory. Skipping deduction for this ingredient.`);
        continue;
      }

      // Skip deduction when inventory item is inactive (Req 10)
      if (invItem.status === 'INACTIVE') {
        console.warn(`[INVENTORY] Ingredient "${ded.name}" is INACTIVE. Skipping deduction.`);
        continue;
      }

      // Convert quantity from recipe unit to inventory unit
      let convertedDeductionQty = ded.deductionQty;
      if (ded.recipeUnit && invItem.unit) {
        convertedDeductionQty = convertUnits(ded.deductionQty, ded.recipeUnit, invItem.unit);
      }

      const oldQty = invItem.quantity;
      const newQty = oldQty - convertedDeductionQty;

      // Prevent negative inventory under every circumstance (Req 13)
      if (newQty < 0) {
        throw new Error(`Insufficient stock for ingredient "${invItem.name}" in branch ${branchId}. Required: ${convertedDeductionQty} ${invItem.unit}, Available: ${oldQty} ${invItem.unit}`);
      }

      let newStatus = 'IN_STOCK';
      if (newQty <= 0) {
        newStatus = 'OUT_OF_STOCK';
      } else if (newQty <= invItem.reorderLevel) {
        newStatus = 'LOW_STOCK';
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: invItem._id },
          update: {
            $set: {
              quantity: newQty,
              stock: newQty,
              status: newStatus
            }
          }
        }
      });

      // Save complete log with detailed audit info (Req 11 & 12)
      logsToCreate.push({
        cafeId,
        branchId,
        itemId: invItem._id,
        itemName: invItem.name,
        orderId: order._id,
        type: 'Deduction',
        quantityChanged: -convertedDeductionQty,
        cost: Number(((invItem.costPrice || invItem.cost || 0) * convertedDeductionQty).toFixed(4)),
        reason: `Sold ${ded.orderQty} x ${ded.itemName}`,
        userEmail: 'system-auto-deduct',
        paymentId: order.razorpayPaymentId || `UPI-${order._id}`,
        menuItemId: ded.menuItemId,
        ingredientId: invItem._id,
        oldQuantity: oldQty,
        remainingQuantity: newQty,
        performedBy: 'system-auto-deduct'
      });

      affectedIngredients.push(invItem.name);
      invItem.quantity = newQty; // Update local cached quantity to handle multiple recipe occurrences in same order
    }

    if (bulkOps.length > 0) {
      await Inventory.bulkWrite(bulkOps, { session });
      await InventoryLog.insertMany(logsToCreate, { session });
    }

    await session.commitTransaction();
    session.endSession();

    console.log(`[INVENTORY] Successfully completed and committed transaction-safe stock deduction for order: ${orderId}`);

    // 4. Emit real-time Socket.IO events to update Owner Dashboard and Cashier UI immediately (Req 15 & 20)
    emitInventoryUpdated(cafeId, branchId, inventoryItems);

    // Auto-update availability only for menu items containing the affected ingredients
    if (affectedIngredients.length > 0) {
      await updateMenuItemAvailabilityFromInventory(cafeId, null, branchId);
    }
  } catch (err) {
    console.error(`[INVENTORY] Transaction failed for order ${orderId} and was rolled back:`, err.message);
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        console.error('[INVENTORY] Error during transaction abort:', abortErr.message);
      }
      session.endSession();
    }
    throw err;
  }
};

module.exports = {
  getInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getInventoryLogs,
  recordPurchase,
  recordWastage,
  reportShortage,
  getWastageReport,
  getConsumptionReport,
  deductInventoryForOrder,
  updateMenuItemAvailabilityFromInventory,
  seedDefaultInventory
};
