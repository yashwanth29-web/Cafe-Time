const MenuItem = require('../models/MenuItem');
const { updateMenuItemAvailabilityFromInventory } = require('./inventoryController');
const menuCache = require('../utils/menuCache');
const socket = require('../socket');

// @desc    Get all menu items
// @route   GET /api/menu
// @access  Public
const getMenuItems = async (req, res) => {
  try {
    const cafeId = req.query.cafeId || (req.user && req.user.cafeId) || 'CD001';
    const branchId = req.branchId || req.query.branchId || 'default';
    console.log(`[DEBUG getMenuItems] Request for cafeId: ${cafeId}, branchId: ${branchId}`);

    const cached = menuCache.getMenu();
    if (cached) {
      console.log(`[DEBUG getMenuItems] Returning from cache. Count: ${cached.length}`);
      return res.status(200).json({ success: true, count: cached.length, data: cached });
    }

    let finalMenuItems = [];

    // The Global Master Menu is stored under cafeId: 'CD001', branchId: 'default'
    if (cafeId === 'CD001' && branchId === 'default') {
      finalMenuItems = await MenuItem.find({ cafeId: 'CD001', branchId: 'default' }).select('-__v -createdAt -updatedAt').sort({ category: 1, name: 1 }).lean();
      console.log(`[DEBUG getMenuItems] CD001/default Master Items fetched: ${finalMenuItems.length}`);
    } else {
      // 1. Fetch Global Master Items
      const masterItems = await MenuItem.find({ cafeId: 'CD001', branchId: 'default' }).select('-__v -createdAt -updatedAt').lean();
      console.log(`[DEBUG getMenuItems] Non-CD001 branch - Master Items fetched: ${masterItems.length}`);
      
      // 2. Fetch Local Items for this specific cafe and branch
      const localItems = await MenuItem.find({ cafeId, branchId }).select('-__v -createdAt -updatedAt').lean();
      console.log(`[DEBUG getMenuItems] Non-CD001 branch - Local Items fetched: ${localItems.length}`);
      
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
        // Force the master item to pretend to belong to this cafe/branch in the response
        // so the frontend doesn't get confused
        return { ...master, cafeId, branchId };
      }).filter(item => item !== null);
      
      console.log(`[DEBUG getMenuItems] Non-CD001 branch - Merged Master Items: ${mergedMasterItems.length}`);
      
      // 5. Combine and sort
      finalMenuItems = [...mergedMasterItems, ...customLocalItems];
      finalMenuItems.sort((a, b) => {
        if (a.category === b.category) {
          return a.name.localeCompare(b.name);
        }
        return a.category.localeCompare(b.category);
      });
    }

    console.log(`[DEBUG getMenuItems] Final returned items: ${finalMenuItems.length}`);
    menuCache.setMenu(finalMenuItems);
    return res.status(200).json({ success: true, count: finalMenuItems.length, data: finalMenuItems });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching menu items', error: error.message });
  }
};

// @desc    Create a new menu item
// @route   POST /api/menu
// @access  Public (Owner Dashboard)
const createMenuItem = async (req, res) => {
  try {
    const { name, price, originalPrice, category, description, available, isCombo, image, recipe, preparationTime } = req.body;
    const cafeId = (req.user && req.user.cafeId) || 'CD001';
    const branchId = req.branchId || 'default';

    // Simple validation
    if (!name || price === undefined || !category || !description) {
      return res.status(400).json({ success: false, message: 'Please provide name, price, category, and description' });
    }

    const newMenuItem = new MenuItem({
      name,
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
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

    // Auto-update availability based on inventory
    await updateMenuItemAvailabilityFromInventory(cafeId, savedItem._id, branchId);

    // Fetch latest status
    const latestItem = await MenuItem.findOne({ _id: savedItem._id, cafeId, branchId });

    // Clear menu cache since a new item was added
    menuCache.clearMenu();

    const io = socket.getIO();
    if (io) {
      io.to(`branch_${cafeId}_${branchId}`).emit('menu_updated', latestItem || savedItem);
    }

    return res.status(201).json({ success: true, data: latestItem || savedItem });
  } catch (error) {
    console.error('Error creating menu item:', error);
    return res.status(500).json({ success: false, message: 'Server error while creating menu item', error: error.message });
  }
};

// @desc    Update a menu item
// @route   PATCH /api/menu/:id
// @access  Public (Owner Dashboard)
const updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const cafeId = (req.user && req.user.cafeId) || 'CD001';
    const branchId = req.branchId || 'default';

    if (updateData.price !== undefined) {
      updateData.price = parseFloat(updateData.price);
    }
    
    if (updateData.originalPrice !== undefined) {
      updateData.originalPrice = updateData.originalPrice ? parseFloat(updateData.originalPrice) : null;
    }

    if (updateData.preparationTime !== undefined) {
      updateData.preparationTime = parseInt(updateData.preparationTime);
    }

    // First find the item regardless of cafeId/branchId to see if it's a Global Master item
    const existingItem = await MenuItem.findOne({ _id: id }, null, { bypassBranchFilter: true });
    console.log(`[DEBUG updateMenuItem] Attempting to update item ID: ${id}`);
    console.log(`[DEBUG updateMenuItem] Found existing item:`, existingItem ? existingItem._id : null);
    
    if (!existingItem) {
      console.log(`[DEBUG updateMenuItem] Returning 404 because item was not found`);
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    let updatedItem;

    // Check if this is a Global Master Item being edited by a local cafe
    if (existingItem.cafeId === 'CD001' && existingItem.branchId === 'default' && (cafeId !== 'CD001' || branchId !== 'default')) {
      // Local cafe/branch trying to update a Global Master item -> Create a Local Override
      // Check if an override already exists for THIS specific cafe and branch
      const existingOverride = await MenuItem.findOne({ masterItemId: id, cafeId, branchId }, null, { bypassBranchFilter: true });
      
      if (existingOverride) {
        // Update the existing override
        updatedItem = await MenuItem.findOneAndUpdate(
          { _id: existingOverride._id, cafeId, branchId },
          updateData,
          { returnDocument: 'after', runValidators: true }
        );
      } else {
        // Create a new override for this cafe and branch
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
    } else if (existingItem.cafeId === cafeId && existingItem.branchId === branchId) {
      // It's a local item or global master editing global master -> Update directly
      updatedItem = await MenuItem.findOneAndUpdate(
        { _id: id, cafeId, branchId },
        updateData,
        { returnDocument: 'after', runValidators: true }
      );
    } else {
      // Unauthorized cross-cafe edit
      return res.status(403).json({ success: false, message: 'Unauthorized to edit this item from this branch' });
    }

    // Auto-update availability based on inventory
    await updateMenuItemAvailabilityFromInventory(cafeId, updatedItem._id, branchId);

    // Fetch the updated item again to return the latest availability status
    const latestItem = await MenuItem.findOne({ _id: updatedItem._id, cafeId, branchId }, null, { bypassBranchFilter: true });

    // Clear menu cache since an item was updated
    menuCache.clearMenu();

    const io = socket.getIO();
    if (io) {
      io.to(`branch_${cafeId}_${branchId}`).emit('menu_updated', latestItem || updatedItem);
    }

    return res.status(200).json({ success: true, data: latestItem || updatedItem });
  } catch (error) {
    console.error('Error updating menu item:', error);
    return res.status(500).json({ success: false, message: 'Server error while updating menu item', error: error.message });
  }
};

// @desc    Delete a menu item
// @route   DELETE /api/menu/:id
// @access  Public (Owner Dashboard)
const deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const cafeId = (req.user && req.user.cafeId) || 'CD001';
    const branchId = req.branchId || 'default';

    // Find regardless of cafeId/branchId to check if it's a global master item
    const existingItem = await MenuItem.findOne({ _id: id }, null, { bypassBranchFilter: true });

    if (!existingItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    if (existingItem.cafeId === 'CD001' && existingItem.branchId === 'default' && (cafeId !== 'CD001' || branchId !== 'default')) {
      // Local branch trying to delete a Global Master item -> Create a Local Override with isHidden: true
      const existingOverride = await MenuItem.findOne({ masterItemId: id, cafeId, branchId }, null, { bypassBranchFilter: true });
      if (existingOverride) {
        await MenuItem.findByIdAndUpdate(existingOverride._id, { isHidden: true });
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
    } else if (existingItem.cafeId === cafeId && existingItem.branchId === branchId) {
      // If it's an override of a master item, we must just hide it so the master doesn't reappear
      if (existingItem.masterItemId) {
        await MenuItem.findByIdAndUpdate(id, { isHidden: true });
      } else {
        // If it's a purely custom local item (or master deleting its own item), actually delete it
        await MenuItem.findByIdAndDelete(id);
      }
    } else {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this item from this branch' });
    }

    // Clear menu cache since an item was deleted/hidden
    menuCache.clearMenu();

    return res.status(200).json({ success: true, message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    return res.status(500).json({ success: false, message: 'Server error while deleting menu item', error: error.message });
  }
};

module.exports = {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem
};
