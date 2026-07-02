const MenuItem = require('../models/MenuItem');
const { updateMenuItemAvailabilityFromInventory } = require('./inventoryController');
const menuCache = require('../utils/menuCache');
const socket = require('../socket');

// @desc    Get all menu items
// @route   GET /api/menu
// @access  Public
const getMenuItems = async (req, res) => {
  try {
    const cached = menuCache.getMenu();
    if (cached) {
      return res.status(200).json({ success: true, count: cached.length, data: cached });
    }
    const menuItems = await MenuItem.find().select('-__v -createdAt -updatedAt').sort({ category: 1, name: 1 }).lean();
    menuCache.setMenu(menuItems);
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
    const { name, price, originalPrice, category, description, available, isCombo, image, recipe, preparationTime } = req.body;

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
      preparationTime: preparationTime ? parseInt(preparationTime) : 10
    });

    const savedItem = await newMenuItem.save();

    // Auto-update availability based on inventory
    const cafeId = (req.user && req.user.cafeId) || 'CD001';
    await updateMenuItemAvailabilityFromInventory(cafeId, savedItem._id);

    // Fetch latest status
    const latestItem = await MenuItem.findById(savedItem._id);

    // Clear menu cache since a new item was added
    menuCache.clearMenu();

    const io = socket.getIO();
    if (io) {
      io.to(`cafe_${cafeId}`).emit('menu_updated', latestItem || savedItem);
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

    if (updateData.price !== undefined) {
      updateData.price = parseFloat(updateData.price);
    }
    
    if (updateData.originalPrice !== undefined) {
      updateData.originalPrice = updateData.originalPrice ? parseFloat(updateData.originalPrice) : null;
    }

    if (updateData.preparationTime !== undefined) {
      updateData.preparationTime = parseInt(updateData.preparationTime);
    }

    const updatedItem = await MenuItem.findByIdAndUpdate(
      id,
      updateData,
      { returnDocument: 'after', runValidators: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    // Auto-update availability based on inventory
    const cafeId = (req.user && req.user.cafeId) || 'CD001';
    await updateMenuItemAvailabilityFromInventory(cafeId, id);

    // Fetch the updated item again to return the latest availability status
    const latestItem = await MenuItem.findById(id);

    // Clear menu cache since an item was updated
    menuCache.clearMenu();

    const io = socket.getIO();
    if (io) {
      io.to(`cafe_${cafeId}`).emit('menu_updated', latestItem || updatedItem);
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
    const deletedItem = await MenuItem.findByIdAndDelete(id);

    if (!deletedItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    // Clear menu cache since an item was deleted
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
