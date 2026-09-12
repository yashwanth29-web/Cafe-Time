const MenuItem = require('../models/MenuItem');
const { updateMenuItemAvailabilityFromInventory } = require('./inventoryController');
const menuCache = require('../utils/menuCache');
const socket = require('../socket');

// @desc    Get all menu items
// @route   GET /api/menu
// @access  Public
const getMenuItems = async (req, res, next) => {
  try {
    const cafeId = req.cafeId || req.query.cafeId || (req.user && req.user.cafeId);
    if (!cafeId) {
      return res.status(400).json({ success: false, message: 'Missing cafeId' });
    }
    let branchId = req.branchId || req.query.branchId || 'default';
    if (branchId === 'all') branchId = 'default';

    console.log(`[DEBUG getMenuItems] Request for cafeId: ${cafeId}, branchId: ${branchId}`);

    const Cafe = require('../models/Cafe');
    const targetCafe = await Cafe.findOne({ cafeId });
    if (targetCafe && targetCafe.isDeleted) {
      return res.status(403).json({ success: false, message: 'This cafe has been deleted. Access denied.' });
    }

    const cached = menuCache.getMenu(cafeId, branchId);
    if (cached) {
      console.log(`[DEBUG getMenuItems] Returning from cache. Count: ${cached.length}`);
      return res.status(200).json({ success: true, count: cached.length, data: cached });
    }

    let finalMenuItems = [];

    if (cafeId === 'CD001') {
      if (branchId === 'default') {
        finalMenuItems = await MenuItem.find({ cafeId: 'CD001', branchId: 'default', isHidden: { $ne: true } })
          .select('-__v -createdAt -updatedAt')
          .sort({ category: 1, name: 1 })
          .lean();
        console.log(`[DEBUG getMenuItems] CD001/default Master Items fetched: ${finalMenuItems.length}`);
      } else {
        // 1. Fetch Global Master Items
        const masterItems = await MenuItem.find({ cafeId: 'CD001', branchId: 'default', isHidden: { $ne: true } })
          .select('-__v -createdAt -updatedAt')
          .lean();
        
        // 2. Fetch Local Items for this specific cafe and branch
        const localItems = await MenuItem.find({ cafeId, branchId }).select('-__v -createdAt -updatedAt').lean();
        
        // 3. Map Local Items by masterItemId for O(1) lookup
        const localOverridesMap = {};
        const customLocalItems = [];
        
        localItems.forEach(localItem => {
          if (localItem.masterItemId) {
            localOverridesMap[localItem.masterItemId.toString()] = localItem;
          } else {
            customLocalItems.push(localItem);
          }
        });
        
        // 4. Merge master and local overrides
        const mergedMasterItems = masterItems.map(master => {
          const override = localOverridesMap[master._id.toString()];
          if (override) {
            return override.isHidden ? null : override;
          }
          return { ...master, cafeId, branchId };
        }).filter(item => item !== null);
        
        // 5. Combine and sort
        finalMenuItems = [...mergedMasterItems, ...customLocalItems];
      }
    } else {
      // Completely independent tenant
      const query = { cafeId, isHidden: { $ne: true } };
      if (branchId !== 'all') {
        query.branchId = branchId;
      }
      finalMenuItems = await MenuItem.find(query).select('-__v -createdAt -updatedAt').lean();
    }

    finalMenuItems.sort((a, b) => {
      if (a.category === b.category) {
        return a.name.localeCompare(b.name);
      }
      return (a.category || '').localeCompare(b.category || '');
    });

    // Ensure every item has both .id and ._id formatted
    const mappedFinalItems = finalMenuItems.map(item => ({
      ...item,
      id: item._id ? item._id.toString() : item.id
    }));

    menuCache.setMenu(cafeId, branchId, mappedFinalItems);
    return res.status(200).json({ success: true, count: mappedFinalItems.length, data: mappedFinalItems });
  } catch (error) {
    error.controllerName = 'menuController';
    error.serviceName = 'getMenuItems';
    next(error);
  }
};

// @desc    Create a new menu item
// @route   POST /api/menu
// @access  Public (Owner Dashboard)
const createMenuItem = async (req, res, next) => {
  try {
    const { name, price, originalPrice, makingCost, category, description, available, isCombo, image, recipe, preparationTime } = req.body;
    const cafeId = req.cafeId || (req.user && req.user.cafeId);
    if (!cafeId) {
      return res.status(400).json({ success: false, message: 'Missing cafeId' });
    }
    let branchId = req.branchId || (req.headers['x-branch-id'] || 'default');
    if (branchId === 'all') branchId = 'default';

    // Simple validation
    if (!name || price === undefined || !category || !description) {
      return res.status(400).json({ success: false, message: 'Please provide name, price, category, and description' });
    }

    const newMenuItem = new MenuItem({
      name,
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
      makingCost: makingCost !== undefined ? parseFloat(makingCost) : 0,
      category,
      description,
      available: available !== undefined ? available : true,
      isCombo: isCombo !== undefined ? isCombo : false,
      image: image || '/images/default-food.png',
      recipe: recipe || [],
      preparationTime: preparationTime ? parseInt(preparationTime) : 10,
      cafeId,
      branchId
    });

    const savedItem = await newMenuItem.save();
    const finalItem = {
      ...savedItem.toObject(),
      id: savedItem._id.toString()
    };

    // Invalidate caches immediately
    menuCache.clearAll();

    // Run inventory availability check in background (non-blocking for ultra-fast instant UI)
    setImmediate(async () => {
      try {
        await updateMenuItemAvailabilityFromInventory(cafeId, savedItem._id, branchId);
      } catch (err) {
        console.error('[INVENTORY] Background availability update error:', err.message);
      }
    });

    // Broadcast socket updates
    try {
      const io = socket.getIO();
      if (io) {
        io.to(`branch:${branchId}`).emit('menu_updated', finalItem);
        io.to(`branch_${cafeId}_${branchId}`).emit('menu_updated', finalItem);
        io.to(`cafe:${cafeId}`).emit('menu_updated', finalItem);
        io.to(`cafe_${cafeId}`).emit('menu_updated', finalItem);
        io.to(`cafe:${cafeId}`).emit('dashboard_realtime_sync', {
          cafeId,
          branchId,
          model: 'MenuItem',
          action: 'create',
          data: finalItem
        });
        io.to(`cafe:${cafeId}`).emit('menuAvailabilityUpdated', {
          _id: String(finalItem._id),
          name: finalItem.name,
          available: finalItem.available,
          price: finalItem.price,
          updatedAt: finalItem.updatedAt || new Date().toISOString()
        });
      }
    } catch (err) {
      console.warn('[SOCKET] Could not broadcast menu update:', err.message);
    }

    return res.status(201).json({ success: true, data: finalItem });
  } catch (error) {
    error.controllerName = 'menuController';
    error.serviceName = 'createMenuItem';
    next(error);
  }
};

// @desc    Update a menu item
// @route   PATCH /api/menu/:id
// @access  Public (Owner Dashboard)
const updateMenuItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    const cafeId = req.cafeId || (req.user && req.user.cafeId);
    if (!cafeId) {
      return res.status(400).json({ success: false, message: 'Missing cafeId' });
    }
    let branchId = req.branchId || (req.headers['x-branch-id'] || 'default');
    if (branchId === 'all') branchId = 'default';

    // Strip immutable or restricted tenant fields
    delete updateData._id;
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.__v;
    delete updateData.cafeId;
    delete updateData.branchId;

    if (updateData.price !== undefined) {
      updateData.price = parseFloat(updateData.price);
    }

    if (updateData.makingCost !== undefined) {
      updateData.makingCost = parseFloat(updateData.makingCost) || 0;
    }
    
    if (updateData.originalPrice !== undefined) {
      updateData.originalPrice = updateData.originalPrice ? parseFloat(updateData.originalPrice) : null;
    }

    if (updateData.preparationTime !== undefined) {
      updateData.preparationTime = parseInt(updateData.preparationTime);
    }

    // Never overwrite an existing image with null, undefined, or empty/default image in update
    if (!updateData.image || updateData.image === '/images/default-food.png') {
      delete updateData.image;
    }

    const existingItem = await MenuItem.findOne({ _id: id }, null, { bypassBranchFilter: true });
    if (!existingItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    let updatedItem;
    const isSuperAdmin = (req.user && (req.user.role || '').toLowerCase() === 'super_admin');
    const isOwnerOrAdmin = (req.user && ['owner', 'admin'].includes((req.user.role || '').toLowerCase()));

    // If item belongs to this cafe (or edited by owner/admin/super_admin for this cafe), update directly!
    if (existingItem.cafeId === cafeId || isSuperAdmin) {
      updatedItem = await MenuItem.findOneAndUpdate(
        { _id: id },
        updateData,
        { returnDocument: 'after', runValidators: true, bypassBranchFilter: true }
      );
    } else if (existingItem.cafeId === 'CD001' && existingItem.branchId === 'default' && cafeId !== 'CD001') {
      // Local separate cafe trying to update a Global Master item -> Create/Update a Local Override
      const existingOverride = await MenuItem.findOne({ masterItemId: id, cafeId, branchId }, null, { bypassBranchFilter: true });
      if (existingOverride) {
        updatedItem = await MenuItem.findOneAndUpdate(
          { _id: existingOverride._id, cafeId, branchId },
          updateData,
          { returnDocument: 'after', runValidators: true, bypassBranchFilter: true }
        );
      } else {
        const overrideData = {
          ...existingItem.toObject(),
          ...updateData,
          _id: undefined,
          createdAt: undefined,
          updatedAt: undefined,
          cafeId,
          branchId,
          masterItemId: id,
          isHidden: false
        };
        const newLocalItem = new MenuItem(overrideData);
        updatedItem = await newLocalItem.save();
      }
    } else {
      return res.status(403).json({ success: false, message: 'Unauthorized to edit this item from this branch' });
    }

    if (!updatedItem) {
      return res.status(404).json({ success: false, message: 'Menu item update target not found' });
    }

    const finalItem = {
      ...updatedItem.toObject(),
      id: updatedItem._id.toString()
    };

    // Invalidate caches immediately
    menuCache.clearAll();

    // Background inventory check
    setImmediate(async () => {
      try {
        await updateMenuItemAvailabilityFromInventory(cafeId, updatedItem._id, branchId);
      } catch (err) {
        console.error('[INVENTORY] Background availability update error:', err.message);
      }
    });

    // Broadcast socket updates
    try {
      const io = socket.getIO();
      if (io) {
        io.to(`branch:${branchId}`).emit('menu_updated', finalItem);
        io.to(`branch_${cafeId}_${branchId}`).emit('menu_updated', finalItem);
        io.to(`cafe:${cafeId}`).emit('menu_updated', finalItem);
        io.to(`cafe_${cafeId}`).emit('menu_updated', finalItem);
        io.to(`cafe:${cafeId}`).emit('dashboard_realtime_sync', {
          cafeId,
          branchId,
          model: 'MenuItem',
          action: 'update',
          data: finalItem
        });
        io.to(`cafe:${cafeId}`).emit('menuAvailabilityUpdated', {
          _id: String(finalItem._id),
          name: finalItem.name,
          available: finalItem.available,
          price: finalItem.price,
          updatedAt: finalItem.updatedAt || new Date().toISOString()
        });
      }
    } catch (err) {
      console.warn('[SOCKET] Could not broadcast menu update:', err.message);
    }

    return res.status(200).json({ success: true, data: finalItem });
  } catch (error) {
    error.controllerName = 'menuController';
    error.serviceName = 'updateMenuItem';
    next(error);
  }
};

// @desc    Delete a menu item
// @route   DELETE /api/menu/:id
// @access  Public (Owner Dashboard)
const deleteMenuItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = (req.user && (req.user.role || '').toLowerCase() === 'super_admin');
    const existingItem = await MenuItem.findOne({ _id: id }, null, { bypassBranchFilter: true });

    if (!existingItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    const cafeId = isSuperAdmin ? existingItem.cafeId : (req.cafeId || (req.user && req.user.cafeId));
    let branchId = req.branchId || (req.headers['x-branch-id'] || 'default');
    if (branchId === 'all') branchId = 'default';

    if (!cafeId) {
      return res.status(400).json({ success: false, message: 'Missing cafeId context' });
    }

    if (isSuperAdmin) {
      // Super admin can directly delete the item completely
      await MenuItem.findOneAndDelete({ _id: id }, { bypassBranchFilter: true });
      await MenuItem.deleteMany({ masterItemId: id });
    } else if (existingItem.cafeId === cafeId) {
      // Owner/Admin of this cafe deleting their own item:
      // If it's a master item (CD001 default), soft-delete with isHidden: true so references don't break,
      // and delete any local overrides
      if (existingItem.cafeId === 'CD001' && existingItem.branchId === 'default') {
        await MenuItem.findOneAndUpdate({ _id: id }, { isHidden: true }, { bypassBranchFilter: true });
        await MenuItem.deleteMany({ masterItemId: id });
      } else if (existingItem.masterItemId) {
        // If it's an override, set isHidden: true so master doesn't reappear
        await MenuItem.findOneAndUpdate({ _id: id, cafeId }, { isHidden: true }, { bypassBranchFilter: true });
      } else {
        // Pure custom local item
        await MenuItem.findOneAndDelete({ _id: id, cafeId }, { bypassBranchFilter: true });
      }
    } else if (existingItem.cafeId === 'CD001' && existingItem.branchId === 'default' && cafeId !== 'CD001') {
      // Separate tenant hiding a master item in their branch
      const existingOverride = await MenuItem.findOne({ masterItemId: id, cafeId, branchId }, null, { bypassBranchFilter: true });
      if (existingOverride) {
        await MenuItem.findOneAndUpdate({ _id: existingOverride._id, cafeId, branchId }, { isHidden: true }, { bypassBranchFilter: true });
      } else {
        const overrideData = {
          ...existingItem.toObject(),
          _id: undefined,
          createdAt: undefined,
          updatedAt: undefined,
          cafeId,
          branchId,
          masterItemId: id,
          isHidden: true
        };
        await new MenuItem(overrideData).save();
      }
    } else {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this item from this branch' });
    }

    // Clear all menu caches thoroughly so deletions reflect across all instances immediately
    menuCache.clearAll();

    // Broadcast socket events so all connected clients and tabs remove the item immediately
    try {
      const io = socket.getIO();
      if (io) {
        io.to(`branch:${branchId}`).emit('menu_updated', { deletedId: id });
        io.to(`branch_${cafeId}_${branchId}`).emit('menu_updated', { deletedId: id });
        io.to(`cafe:${cafeId}`).emit('menu_updated', { deletedId: id });
        io.to(`cafe_${cafeId}`).emit('menu_updated', { deletedId: id });
        io.to(`cafe:${cafeId}`).emit('dashboard_realtime_sync', {
          cafeId,
          branchId,
          model: 'MenuItem',
          action: 'delete',
          id
        });
      }
    } catch (err) {
      console.warn('[SOCKET] Could not broadcast menu delete:', err.message);
    }

    return res.status(200).json({ success: true, message: 'Menu item deleted successfully' });
  } catch (error) {
    error.controllerName = 'menuController';
    error.serviceName = 'deleteMenuItem';
    next(error);
  }
};

module.exports = {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem
};
