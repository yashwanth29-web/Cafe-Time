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

// Helper to seed default inventory items for a cafe if empty (using updated fields)
const seedDefaultInventory = async (cafeId) => {
  const defaults = [
    // Tea Ingredients
    { name: 'Tea Leaves', quantity: 5000, reorderLevel: 1000, unit: 'g', costPrice: 0.5, category: 'Tea Ingredients', supplier: 'Dr. Chai Wholesale', branch: 'Main' },
    { name: 'Milk', quantity: 20000, reorderLevel: 5000, unit: 'ml', costPrice: 0.06, category: 'Tea Ingredients', supplier: 'Local Dairy', branch: 'Main' },
    { name: 'Sugar', quantity: 10000, reorderLevel: 2000, unit: 'g', costPrice: 0.04, category: 'Tea Ingredients', supplier: 'Local Grocery', branch: 'Main' },
    { name: 'Cardamom', quantity: 500, reorderLevel: 100, unit: 'g', costPrice: 2.5, category: 'Tea Ingredients', supplier: 'Spices Emporium', branch: 'Main' },
    { name: 'Ginger', quantity: 1000, reorderLevel: 200, unit: 'g', costPrice: 0.15, category: 'Tea Ingredients', supplier: 'Spices Emporium', branch: 'Main' },
    { name: 'Jaggery', quantity: 2000, reorderLevel: 500, unit: 'g', costPrice: 0.08, category: 'Tea Ingredients', supplier: 'Local Grocery', branch: 'Main' },

    // Coffee Ingredients
    { name: 'Coffee Powder', quantity: 3000, reorderLevel: 500, unit: 'g', costPrice: 0.8, category: 'Coffee Ingredients', supplier: 'Dr. Chai Wholesale', branch: 'Main' },
    { name: 'Chocolate Syrup', quantity: 2000, reorderLevel: 500, unit: 'ml', costPrice: 0.3, category: 'Coffee Ingredients', supplier: 'Baker Premium', branch: 'Main' },
    { name: 'Hazelnut Syrup', quantity: 1000, reorderLevel: 250, unit: 'ml', costPrice: 0.4, category: 'Coffee Ingredients', supplier: 'Baker Premium', branch: 'Main' },

    // Juice Ingredients
    { name: 'Lemon Juice', quantity: 2000, reorderLevel: 500, unit: 'ml', costPrice: 0.1, category: 'Juice Ingredients', supplier: 'Fresh Fruits Ltd', branch: 'Main' },
    { name: 'Soda Water', quantity: 15000, reorderLevel: 3000, unit: 'ml', costPrice: 0.02, category: 'Juice Ingredients', supplier: 'SodaHub', branch: 'Main' },
    { name: 'Sugar Syrup', quantity: 5000, reorderLevel: 1000, unit: 'ml', costPrice: 0.03, category: 'Juice Ingredients', supplier: 'Local Grocery', branch: 'Main' },
    { name: 'Watermelon Fruit', quantity: 10000, reorderLevel: 2000, unit: 'g', costPrice: 0.05, category: 'Juice Ingredients', supplier: 'Fresh Fruits Ltd', branch: 'Main' },
    { name: 'Musk Melon Fruit', quantity: 10000, reorderLevel: 2000, unit: 'g', costPrice: 0.06, category: 'Juice Ingredients', supplier: 'Fresh Fruits Ltd', branch: 'Main' },
    { name: 'Curd', quantity: 8000, reorderLevel: 2000, unit: 'g', costPrice: 0.08, category: 'Juice Ingredients', supplier: 'Local Dairy', branch: 'Main' },
    { name: 'Mango Pulp', quantity: 5000, reorderLevel: 1000, unit: 'ml', costPrice: 0.15, category: 'Juice Ingredients', supplier: 'Fresh Fruits Ltd', branch: 'Main' },

    // Milkshake Ingredients
    { name: 'Vanilla Essence', quantity: 500, reorderLevel: 100, unit: 'ml', costPrice: 0.5, category: 'Milkshake Ingredients', supplier: 'Baker Premium', branch: 'Main' },
    { name: 'Strawberry Syrup', quantity: 2000, reorderLevel: 500, unit: 'ml', costPrice: 0.3, category: 'Milkshake Ingredients', supplier: 'Baker Premium', branch: 'Main' },
    { name: 'Ice Cream', quantity: 5000, reorderLevel: 1000, unit: 'g', costPrice: 0.25, category: 'Milkshake Ingredients', supplier: 'Local Dairy', branch: 'Main' },

    // Bakery Items
    { name: 'Biscuit Pack', quantity: 100, reorderLevel: 20, unit: 'pc', costPrice: 5, category: 'Bakery Items', supplier: 'Baker Premium', branch: 'Main' },
    { name: 'Veg Puff Raw', quantity: 50, reorderLevel: 10, unit: 'pc', costPrice: 10, category: 'Bakery Items', supplier: 'Baker Premium', branch: 'Main' },
    { name: 'Egg Puff Raw', quantity: 50, reorderLevel: 10, unit: 'pc', costPrice: 12, category: 'Bakery Items', supplier: 'Baker Premium', branch: 'Main' },
    { name: 'Chicken Puff Raw', quantity: 50, reorderLevel: 10, unit: 'pc', costPrice: 15, category: 'Bakery Items', supplier: 'Baker Premium', branch: 'Main' },
    { name: 'Bun', quantity: 60, reorderLevel: 15, unit: 'pc', costPrice: 8, category: 'Bakery Items', supplier: 'Baker Premium', branch: 'Main' },
    { name: 'Butter', quantity: 2000, reorderLevel: 500, unit: 'g', costPrice: 0.45, category: 'Bakery Items', supplier: 'Local Dairy', branch: 'Main' },

    // Snacks
    { name: 'Samosa Raw', quantity: 100, reorderLevel: 20, unit: 'pc', costPrice: 6, category: 'Snacks', supplier: 'Baker Premium', branch: 'Main' },
    { name: 'Bread Slices', quantity: 120, reorderLevel: 30, unit: 'pc', costPrice: 1.5, category: 'Snacks', supplier: 'Baker Premium', branch: 'Main' },
    { name: 'Cucumber', quantity: 3000, reorderLevel: 500, unit: 'g', costPrice: 0.05, category: 'Snacks', supplier: 'Fresh Fruits Ltd', branch: 'Main' },
    { name: 'Tomato', quantity: 3000, reorderLevel: 500, unit: 'g', costPrice: 0.06, category: 'Snacks', supplier: 'Fresh Fruits Ltd', branch: 'Main' },
    { name: 'Potato Fries Raw', quantity: 10000, reorderLevel: 2000, unit: 'g', costPrice: 0.12, category: 'Snacks', supplier: 'Dr. Chai Wholesale', branch: 'Main' },
    { name: 'Salt', quantity: 5000, reorderLevel: 1000, unit: 'g', costPrice: 0.02, category: 'Snacks', supplier: 'Local Grocery', branch: 'Main' },

    // Packaging Materials
    { name: 'Tea Cups', quantity: 500, reorderLevel: 100, unit: 'pc', costPrice: 1.2, category: 'Packaging Materials', supplier: 'PackSource', branch: 'Main' },
    { name: 'Coffee Cups', quantity: 400, reorderLevel: 100, unit: 'pc', costPrice: 1.5, category: 'Packaging Materials', supplier: 'PackSource', branch: 'Main' },
    { name: 'Paper Bags', quantity: 300, reorderLevel: 50, unit: 'pc', costPrice: 2.0, category: 'Packaging Materials', supplier: 'PackSource', branch: 'Main' },
    { name: 'Straws', quantity: 1000, reorderLevel: 200, unit: 'pc', costPrice: 0.2, category: 'Packaging Materials', supplier: 'PackSource', branch: 'Main' },

    // Cleaning Supplies
    { name: 'Dish Soap', quantity: 5000, reorderLevel: 1000, unit: 'ml', costPrice: 0.08, category: 'Cleaning Supplies', supplier: 'Local Grocery', branch: 'Main' },
    { name: 'Hand Sanitizer', quantity: 2000, reorderLevel: 500, unit: 'ml', costPrice: 0.15, category: 'Cleaning Supplies', supplier: 'Local Grocery', branch: 'Main' },
    { name: 'Floor Cleaner', quantity: 3000, reorderLevel: 500, unit: 'ml', costPrice: 0.10, category: 'Cleaning Supplies', supplier: 'Local Grocery', branch: 'Main' }
  ];

  const branches = await Branch.find({ cafeId });
  const itemsToCreate = [];
  
  if (branches.length > 0) {
    for (const b of branches) {
      for (const item of defaults) {
        itemsToCreate.push({
          ...item,
          cafeId,
          branch: b.branchId
        });
      }
    }
  } else {
    for (const item of defaults) {
      itemsToCreate.push({
        ...item,
        cafeId,
        branch: 'Main'
      });
    }
  }

  return await Inventory.insertMany(itemsToCreate);
};

const getInventory = async (req, res) => {
  try {
    const cafeId = req.user.cafeId || 'CD001';
    const totalItemsCount = await Inventory.countDocuments({ cafeId });
    const hasDemo = await Inventory.exists({ cafeId, name: { $in: ['Burger Buns', 'Chicken Patties', 'Coffee Beans'] } });

    // Auto-seed if database contains no inventory or contains old demo data
    if (totalItemsCount === 0 || hasDemo) {
      console.log('Clearing old demo inventory items and seeding actual Dr. Chai Cafe inventory...');
      await Inventory.deleteMany({ cafeId });
      await seedDefaultInventory(cafeId);
    }

    // Now query the items
    const query = { cafeId };
    const isStaff = ['manager', 'chef', 'waiter', 'cashier', 'staff'].includes((req.user.role || '').toLowerCase());
    if (isStaff && req.user.assignedBranch) {
      query.branch = req.user.assignedBranch;
    }

    const items = await Inventory.find(query).sort({ name: 1 });

    return res.status(200).json({ success: true, count: items.length, data: items });
  } catch (error) {
    console.error('getInventory error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving inventory items', error: error.message });
  }
};

// @desc    Create inventory item
// @route   POST /api/inventory
// @access  Protected (Owner/Admin)
const createInventoryItem = async (req, res) => {
  try {
    const cafeId = req.user.cafeId || 'CD001';
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
      itemId: savedItem._id,
      itemName: savedItem.name,
      type: 'Initial',
      quantityChanged: finalQuantity,
      cost: finalCostPrice * finalQuantity,
      reason: 'Initial stock setup',
      userEmail: req.user?.email || 'admin@cafe.com'
    });

    emitInventoryUpdated(cafeId, savedItem.branch || 'Main', savedItem);
    return res.status(201).json({ success: true, data: savedItem });
  } catch (error) {
    console.error('createInventoryItem error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating inventory item', error: error.message });
  }
};

// @desc    Update inventory item
// @route   PATCH /api/inventory/:id
// @access  Protected (Owner, Manager)
const updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const cafeId = req.user.cafeId || 'CD001';
    
    const item = await Inventory.findOne({ _id: id, cafeId });
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
    await updateMenuItemAvailabilityFromInventory(cafeId);

    return res.status(200).json({ success: true, data: savedItem });
  } catch (error) {
    console.error('updateInventoryItem error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating inventory item', error: error.message });
  }
};

// @desc    Delete inventory item
// @route   DELETE /api/inventory/:id
// @access  Protected (Owner/Admin)
const deleteInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const cafeId = req.user.cafeId || 'CD001';

    const deletedItem = await Inventory.findOneAndDelete({ _id: id, cafeId });
    if (!deletedItem) {
      return res.status(404).json({ success: false, message: 'Inventory item not found or unauthorized' });
    }

    return res.status(200).json({ success: true, message: 'Inventory item deleted successfully' });
  } catch (error) {
    console.error('deleteInventoryItem error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting inventory item', error: error.message });
  }
};

// @desc    Get all inventory movement logs
// @route   GET /api/inventory/logs
// @access  Protected (Owner, Manager)
const getInventoryLogs = async (req, res) => {
  try {
    const cafeId = req.user.cafeId || 'CD001';
    const logs = await InventoryLog.find({ cafeId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    console.error('getInventoryLogs error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving logs', error: error.message });
  }
};

// @desc    Add Purchase Entry (Increments stock & records log)
// @route   POST /api/inventory/purchase
// @access  Protected (Owner, Manager)
const recordPurchase = async (req, res) => {
  try {
    const cafeId = req.user.cafeId || 'CD001';
    const { itemId, quantityAdded, costPrice, supplier, notes } = req.body;

    if (!itemId || !quantityAdded || quantityAdded <= 0) {
      return res.status(400).json({ success: false, message: 'Item ID and valid Quantity Added are required' });
    }

    const item = await Inventory.findOne({ _id: itemId, cafeId });
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
      itemId: item._id,
      itemName: item.name,
      type: 'Purchase',
      quantityChanged: Number(quantityAdded),
      cost: Number(costPrice || item.costPrice) * Number(quantityAdded),
      reason: notes || 'Purchase entry added by manager',
      userEmail: req.user.email || 'manager@cafe.com'
    });

    // Auto-update menu availability
    await updateMenuItemAvailabilityFromInventory(cafeId);

    return res.status(200).json({ success: true, message: 'Purchase entry added successfully', data: item, log: newLog });
  } catch (error) {
    console.error('recordPurchase error:', error);
    return res.status(500).json({ success: false, message: 'Server error recording purchase', error: error.message });
  }
};

// @desc    Record Wastage / Damaged items (Decrements stock & records log)
// @route   POST /api/inventory/wastage
// @access  Protected (Owner, Manager)
const recordWastage = async (req, res) => {
  try {
    const cafeId = req.user.cafeId || 'CD001';
    const { itemId, quantityWasted, type, reason } = req.body;

    if (!itemId || !quantityWasted || quantityWasted <= 0 || !type) {
      return res.status(400).json({ success: false, message: 'Item ID, valid Quantity Wasted, and Type (Wastage/Damaged) are required' });
    }

    const item = await Inventory.findOne({ _id: itemId, cafeId });
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
      itemId: item._id,
      itemName: item.name,
      type: type === 'Damaged' ? 'Damaged' : 'Wastage',
      quantityChanged: -Number(quantityWasted),
      cost: item.costPrice * Number(quantityWasted),
      reason: reason || `${type} recorded by manager`,
      userEmail: req.user.email || 'manager@cafe.com'
    });

    // Auto-update menu availability
    await updateMenuItemAvailabilityFromInventory(cafeId);

    return res.status(200).json({ success: true, message: 'Wastage recorded successfully', data: item, log: newLog });
  } catch (error) {
    console.error('recordWastage error:', error);
    return res.status(500).json({ success: false, message: 'Server error recording wastage', error: error.message });
  }
};

// @desc    Report Shortage (Chef flags stock issue)
// @route   POST /api/inventory/shortage
// @access  Protected (Owner, Manager, Chef)
const reportShortage = async (req, res) => {
  try {
    const cafeId = req.user.cafeId || 'CD001';
    const { itemId, reason } = req.body;

    if (!itemId) {
      return res.status(400).json({ success: false, message: 'Item ID is required' });
    }

    const item = await Inventory.findOne({ _id: itemId, cafeId });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    if (item.status === 'IN_STOCK') {
      item.status = 'LOW_STOCK';
      await item.save();
    }

    const newLog = await InventoryLog.create({
      cafeId,
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
    console.error('reportShortage error:', error);
    return res.status(500).json({ success: false, message: 'Server error reporting shortage', error: error.message });
  }
};

// @desc    Get Wastage reports
// @route   GET /api/inventory/reports/wastage
// @access  Protected (Owner Only)
const getWastageReport = async (req, res) => {
  try {
    const cafeId = req.user.cafeId || 'CD001';
    const logs = await InventoryLog.find({ cafeId, type: { $in: ['Wastage', 'Damaged'] } }).sort({ createdAt: -1 });
    
    const totalCost = logs.reduce((sum, log) => sum + (log.cost || 0), 0);
    const count = logs.length;

    return res.status(200).json({ success: true, totalCost, count, data: logs });
  } catch (error) {
    console.error('getWastageReport error:', error);
    return res.status(500).json({ success: false, message: 'Server error generating wastage report', error: error.message });
  }
};

// @desc    Get Consumption reports
// @route   GET /api/inventory/reports/consumption
// @access  Protected (Owner Only)
const getConsumptionReport = async (req, res) => {
  try {
    const cafeId = req.user.cafeId || 'CD001';
    const logs = await InventoryLog.find({ cafeId, type: 'Deduction' }).sort({ createdAt: -1 });

    const totalCost = logs.reduce((sum, log) => sum + (log.cost || 0), 0);
    const count = logs.length;

    return res.status(200).json({ success: true, totalCost, count, data: logs });
  } catch (error) {
    console.error('getConsumptionReport error:', error);
    return res.status(500).json({ success: false, message: 'Server error generating consumption report', error: error.message });
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

// Auto-update menu item availability based on ingredient stock levels (optimized with batch queries)
const updateMenuItemAvailabilityFromInventory = async (cafeId, affectedIngredients = null) => {
  try {
    const MenuItem = require('../models/MenuItem');
    
    // Build query to fetch only relevant menu items if affected ingredients list is provided
    const query = {};
    if (affectedIngredients && affectedIngredients.length > 0) {
      query['recipe.name'] = { $in: affectedIngredients };
    }
    
    const menuItems = await MenuItem.find(query);
    if (menuItems.length === 0) return;

    // Collect all unique ingredient names from recipes to perform a single batch fetch
    const ingredientNamesSet = new Set();
    menuItems.forEach(item => {
      if (item.recipe) {
        item.recipe.forEach(ing => {
          ingredientNamesSet.add(ing.name);
        });
      }
    });

    const ingredientNames = Array.from(ingredientNamesSet);
    const inventoryItems = await Inventory.find({
      cafeId,
      name: { $in: ingredientNames }
    }).lean();

    const inventoryMap = new Map();
    inventoryItems.forEach(inv => {
      inventoryMap.set(inv.name, inv);
    });
    
    for (const item of menuItems) {
      if (item.recipe && item.recipe.length > 0) {
        let shouldBeAvailable = true;
        
        for (const ing of item.recipe) {
          const invItem = inventoryMap.get(ing.name);
          if (!invItem || invItem.quantity <= 0) {
            shouldBeAvailable = false;
            break;
          }
        }
        
        if (item.available !== shouldBeAvailable) {
          item.available = shouldBeAvailable;
          await item.save();
          console.log(`Auto-updated menu item "${item.name}" availability to ${shouldBeAvailable} based on inventory levels.`);
          
          try {
            const { getIO } = require('../config/socket');
            const io = getIO();
            io.to(`cafe:${cafeId}`).emit('menuAvailabilityUpdated', {
              _id: String(item._id),
              name: item.name,
              available: shouldBeAvailable,
              updatedAt: item.updatedAt || new Date().toISOString()
            });
            console.log(`[SOCKET] Broadcasted menuAvailabilityUpdated for "${item.name}"`);
          } catch (socketErr) {
            console.error('[SOCKET] Error emitting menuAvailabilityUpdated:', socketErr.message);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error auto-updating menu item availability:', err);
  }
};

// Auto inventory deduction helper (Runs on status change to 'Completed' - optimized batch execution)
const deductInventoryForOrder = async (orderId, cafeId, items) => {
  try {
    const Order = require('../models/Order');
    const MenuItem = require('../models/MenuItem');
    const mongoose = require('mongoose');

    const order = await Order.findById(orderId);
    if (!order || order.inventoryDeducted || !['Ready', 'Completed', 'Delivered'].includes(order.status)) {
      return;
    }

    const opConfig = await OperationalConfig.findOne({ cafeId }).lean();
    const isEnabled = opConfig ? opConfig.inventoryEnabled : true;
    if (!isEnabled) return;

    // Batch fetch menu items for the ordered items to resolve recipes in one roundtrip
    const itemIds = items.map(item => item.id).filter(id => mongoose.isValidObjectId(id));
    const itemNames = items.map(item => item.name);
    
    const menuItems = await MenuItem.find({
      $or: [
        { _id: { $in: itemIds } },
        { name: { $in: itemNames } }
      ]
    }).lean();

    const menuItemMap = new Map();
    menuItems.forEach(mi => {
      menuItemMap.set(String(mi._id), mi);
      menuItemMap.set(mi.name, mi);
    });

    const ingredientDeductionList = [];
    const ingredientNamesSet = new Set();

    for (const item of items) {
      const itemNameLower = (item.name || '').toLowerCase();
      const orderQty = item.quantity || 0;
      if (orderQty <= 0) continue;

      const menuItem = menuItemMap.get(String(item.id)) || menuItemMap.get(item.name);
      let matchedRecipe = menuItem && menuItem.recipe && menuItem.recipe.length > 0 
        ? menuItem.recipe 
        : null;

      if (!matchedRecipe) {
        // Fallback to hardcoded RECIPES mapping
        for (const [key, ingredients] of Object.entries(RECIPES)) {
          if (itemNameLower.includes(key)) {
            matchedRecipe = ingredients;
            break;
          }
        }
      }

      if (matchedRecipe) {
        for (const ing of matchedRecipe) {
          const qtyToDeduct = ing.quantity * orderQty;
          ingredientNamesSet.add(ing.name);
          ingredientDeductionList.push({
            name: ing.name,
            deductionQty: qtyToDeduct,
            orderQty,
            itemName: item.name
          });
        }
      }
    }

    if (ingredientDeductionList.length === 0) {
      order.inventoryDeducted = true;
      await order.save();
      return;
    }

    // Batch fetch current inventory stock levels
    const ingredientNames = Array.from(ingredientNamesSet);
    const inventoryItems = await Inventory.find({
      cafeId,
      name: { $in: ingredientNames }
    });

    const inventoryMap = new Map();
    inventoryItems.forEach(inv => {
      inventoryMap.set(inv.name, inv);
    });

    const bulkOps = [];
    const logsToCreate = [];
    const affectedIngredients = [];

    for (const ded of ingredientDeductionList) {
      const invItem = inventoryMap.get(ded.name);
      if (invItem) {
        const deductionQty = ded.deductionQty;
        const newQty = Math.max(0, invItem.quantity - deductionQty);

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

        logsToCreate.push({
          cafeId,
          itemId: invItem._id,
          itemName: invItem.name,
          type: 'Deduction',
          quantityChanged: -deductionQty,
          cost: (invItem.costPrice || 0) * deductionQty,
          reason: `Sold ${ded.orderQty} x ${ded.itemName}`,
          userEmail: 'system-auto-deduct'
        });

        affectedIngredients.push(invItem.name);
        invItem.quantity = newQty; // update in-memory cache to handle repeated items
      }
    }

    if (bulkOps.length > 0) {
      await Inventory.bulkWrite(bulkOps);
      await InventoryLog.insertMany(logsToCreate);
      emitInventoryUpdated(cafeId, order.branchId || 'Main', inventoryItems);
    }

    order.inventoryDeducted = true;
    await order.save();
    
    // Auto-update availability only for menu items containing the affected ingredients
    if (affectedIngredients.length > 0) {
      await updateMenuItemAvailabilityFromInventory(cafeId, affectedIngredients);
    }
  } catch (err) {
    console.error('deductInventoryForOrder helper error:', err);
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
  updateMenuItemAvailabilityFromInventory
};
