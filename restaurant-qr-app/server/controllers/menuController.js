const MenuItem = require('../models/MenuItem');

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
    const { name, price, category, description, available, image } = req.body;

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
      image: image || '/images/default-food.png'
    });

    const savedItem = await newMenuItem.save();
    return res.status(201).json({ success: true, data: savedItem });
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

    const updatedItem = await MenuItem.findByIdAndUpdate(
      id,
      updateData,
      { new: true, returnDocument: 'after', runValidators: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    return res.status(200).json({ success: true, data: updatedItem });
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
