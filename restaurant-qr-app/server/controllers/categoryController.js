const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');

const DEFAULT_CATEGORIES = [
  'Signature Chai',
  'Coffee Selection',
  'Fresh Juices & Coolers',
  'Thick Milkshakes',
  'Starters & Bites',
  'French Fries'
];

// Seed default categories if none exist
const seedDefaultCategories = async (cafeId) => {
  const categoriesToCreate = DEFAULT_CATEGORIES.map(name => ({
    name,
    cafeId
  }));
  return await Category.insertMany(categoriesToCreate);
};

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
const getCategories = async (req, res) => {
  try {
    const cafeId = req.query.cafeId || (req.user && req.user.cafeId) || 'CD001';
    let categories = await Category.find({ cafeId }).sort({ name: 1 });

    if (categories.length === 0) {
      categories = await seedDefaultCategories(cafeId);
    }

    return res.status(200).json({ success: true, count: categories.length, data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching categories', error: error.message });
  }
};

// @desc    Create a new category
// @route   POST /api/categories
// @access  Protected (Owner/Admin)
const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const cafeId = req.user.cafeId || 'CD001';

    if (!name) {
      return res.status(400).json({ success: false, message: 'Please provide a category name' });
    }

    // Check if category already exists
    const exists = await Category.findOne({ name: name.trim(), cafeId });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Category already exists' });
    }

    const newCategory = new Category({
      name: name.trim(),
      cafeId
    });

    const savedCategory = await newCategory.save();
    return res.status(201).json({ success: true, data: savedCategory });
  } catch (error) {
    console.error('Error creating category:', error);
    return res.status(500).json({ success: false, message: 'Server error while creating category', error: error.message });
  }
};

// @desc    Update a category
// @route   PATCH /api/categories/:id
// @access  Protected (Owner/Admin)
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const cafeId = req.user.cafeId || 'CD001';

    if (!name) {
      return res.status(400).json({ success: false, message: 'Please provide a category name' });
    }

    const category = await Category.findOne({ _id: id, cafeId });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const oldName = category.name;
    const newName = name.trim();

    // Check if another category with the new name exists
    const duplicate = await Category.findOne({ name: newName, cafeId, _id: { $ne: id } });
    if (duplicate) {
      return res.status(400).json({ success: false, message: 'Another category with this name already exists' });
    }

    category.name = newName;
    const updatedCategory = await category.save();

    // Cascade update to all menu items in this category
    await MenuItem.updateMany(
      { category: oldName },
      { category: newName }
    );

    return res.status(200).json({ success: true, data: updatedCategory });
  } catch (error) {
    console.error('Error updating category:', error);
    return res.status(500).json({ success: false, message: 'Server error while updating category', error: error.message });
  }
};

// @desc    Delete a category
// @route   DELETE /api/categories/:id
// @access  Protected (Owner/Admin)
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const cafeId = req.user.cafeId || 'CD001';

    const category = await Category.findOne({ _id: id, cafeId });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const categoryName = category.name;

    await Category.deleteOne({ _id: id, cafeId });

    // Update menu items in this category to 'Uncategorized' or delete them?
    // Let's mark them as 'Uncategorized' so they don't disappear or cause errors,
    // which allows the owner to reclassify them later.
    await MenuItem.updateMany(
      { category: categoryName },
      { category: 'Uncategorized' }
    );

    return res.status(200).json({ success: true, message: 'Category deleted successfully, items moved to Uncategorized' });
  } catch (error) {
    console.error('Error deleting category:', error);
    return res.status(500).json({ success: false, message: 'Server error while deleting category', error: error.message });
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
};
