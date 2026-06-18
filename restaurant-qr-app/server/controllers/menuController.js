const MenuItem = require('../models/MenuItem');
const { updateMenuItemAvailabilityFromInventory } = require('./inventoryController');

// @desc    Get all menu items
// @route   GET /api/menu
// @access  Public
const getMenuItems = async (req, res) => {
  try {
    const menuItems = await MenuItem.find().sort({ category: 1, name: 1 });
    return res.status(200).json({ success: true, count: menuItems.length, data: menuItems });
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
    const { name, price, category, description, available, image, recipe, preparationTime } = req.body;

    // Simple validation
    if (!name || price === undefined || !category || !description) {
      return res.status(400).json({ success: false, message: 'Please provide name, price, category, and description' });
    }

    const newMenuItem = new MenuItem({
      name,
      price: parseFloat(price),
      category,
      description,
      available: available !== undefined ? available : true,
      image: image || '/images/default-food.png',
      recipe: recipe || [],
      preparationTime: preparationTime ? parseInt(preparationTime) : 10
    });

    const savedItem = await newMenuItem.save();

    // Auto-update availability based on inventory
    const cafeId = (req.user && req.user.cafeId) || 'CD001';
    await updateMenuItemAvailabilityFromInventory(cafeId);

    // Fetch latest status
    const latestItem = await MenuItem.findById(savedItem._id);
    const finalItem = latestItem || savedItem;

    // Emit socket update
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      io.to(`cafe:${cafeId}`).emit('menuAvailabilityUpdated', {
        _id: String(finalItem._id),
        name: finalItem.name,
        available: finalItem.available,
        price: finalItem.price,
        updatedAt: finalItem.updatedAt || new Date().toISOString()
      });
      console.log(`[SOCKET] Broadcasted menuAvailabilityUpdated for created item: ${finalItem.name}`);
    } catch (err) {
      console.error('[SOCKET] Error emitting menuAvailabilityUpdated:', err.message);
    }

    return res.status(201).json({ success: true, data: finalItem });
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

    if (updateData.price !== undefined) {
      updateData.price = parseFloat(updateData.price);
    }

    if (updateData.preparationTime !== undefined) {
      updateData.preparationTime = parseInt(updateData.preparationTime);
    }

    const updatedItem = await MenuItem.findByIdAndUpdate(
      id,
      updateData,
      { new: true, returnDocument: 'after', runValidators: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    // Auto-update availability based on inventory
    const cafeId = (req.user && req.user.cafeId) || 'CD001';
    await updateMenuItemAvailabilityFromInventory(cafeId);

    // Fetch the updated item again to return the latest availability status
    const latestItem = await MenuItem.findById(id);
    const finalItem = latestItem || updatedItem;

    // Emit socket update
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      io.to(`cafe:${cafeId}`).emit('menuAvailabilityUpdated', {
        _id: String(finalItem._id),
        name: finalItem.name,
        available: finalItem.available,
        price: finalItem.price,
        updatedAt: finalItem.updatedAt || new Date().toISOString()
      });
      console.log(`[SOCKET] Broadcasted menuAvailabilityUpdated for updated item: ${finalItem.name}`);
    } catch (err) {
      console.error('[SOCKET] Error emitting menuAvailabilityUpdated:', err.message);
    }

    return res.status(200).json({ success: true, data: finalItem });
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
    const deletedItem = await MenuItem.findByIdAndDelete(id);

    if (!deletedItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

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
