const InventoryCategory = require('../models/InventoryCategory');
const Inventory = require('../models/Inventory');

const DEFAULT_INVENTORY_CATEGORIES = [
  'Tea Ingredients',
  'Coffee Ingredients',
  'Juice Ingredients',
  'Milkshake Ingredients',
  'Bakery Items',
  'Snacks',
  'Packaging Materials',
  'Cleaning Supplies'
];

const seedDefaultInventoryCategories = async (cafeId, branchId = 'default') => {
  const categoriesToCreate = DEFAULT_INVENTORY_CATEGORIES.map(name => ({
    name,
    cafeId,
    branchId
  }));
  return await InventoryCategory.insertMany(categoriesToCreate);
};

// @desc    Get all inventory categories
// @route   GET /api/inventory/categories
// @access  Protected
const getInventoryCategories = async (req, res) => {
  try {
    const cafeId = req.query.cafeId || (req.user && req.user.cafeId) || 'CD001';
    const branchId = req.branchId || req.query.branchId || 'default';
    
    let categories;
    if (branchId === 'all') {
      // Find unique category documents by name for the entire cafe
      categories = await InventoryCategory.aggregate([
        { $match: { cafeId } },
        { $group: {
            _id: '$name',
            doc: { $first: '$$ROOT' }
        }},
        { $replaceRoot: { newRoot: '$doc' } },
        { $sort: { name: 1 } }
      ]);
    } else {
      categories = await InventoryCategory.find({ cafeId, branchId }).sort({ name: 1 });
    }

    if (categories.length === 0) {
      try {
        const seedBranchId = branchId === 'all' ? 'default' : branchId;
        // Verify default categories do not already exist under seedBranchId
        const existingInSeedBranch = await InventoryCategory.find({ cafeId, branchId: seedBranchId });
        if (existingInSeedBranch.length === 0) {
          categories = await seedDefaultInventoryCategories(cafeId, seedBranchId);
        } else {
          // If they already exist in the seed branch, copy them to categories return list
          categories = existingInSeedBranch;
        }
      } catch (seedError) {
        console.warn('[SEED WARNING] Failed to seed default inventory categories:', seedError.message);
        // Fallback: Query again or just return empty list to prevent crash
        categories = await InventoryCategory.find({ cafeId, branchId }).sort({ name: 1 });
      }
    }

    // Ensure categories is always an array
    if (!categories || !Array.isArray(categories)) {
      categories = [];
    }

    return res.status(200).json({ success: true, count: categories.length, data: categories });
  } catch (error) {
    console.error('Error fetching inventory categories:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching inventory categories', data: [], error: error.message });
  }
};

// @desc    Create a new inventory category
// @route   POST /api/inventory/categories
// @access  Protected (Owner/Admin)
const createInventoryCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const cafeId = req.user.cafeId || 'CD001';
    const branchId = req.branchId || 'default';

    if (!name) {
      return res.status(400).json({ success: false, message: 'Please provide a category name' });
    }

    let finalBranchId = branchId;
    if (branchId === 'all') {
      const defaultBranch = await Branch.findOne({ cafeId }).lean();
      finalBranchId = defaultBranch ? defaultBranch.branchId : 'default';
    }

    const exists = await InventoryCategory.findOne({ name: name.trim(), cafeId, branchId: finalBranchId });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Category already exists in this branch' });
    }

    const newCategory = new InventoryCategory({
      name: name.trim(),
      cafeId,
      branchId: finalBranchId
    });

    const savedCategory = await newCategory.save();
    return res.status(201).json({ success: true, data: savedCategory });
  } catch (error) {
    console.error('Error creating inventory category:', error);
    return res.status(500).json({ success: false, message: 'Server error while creating inventory category', error: error.message });
  }
};

// @desc    Delete an inventory category
// @route   DELETE /api/inventory/categories/:id
// @access  Protected (Owner/Admin)
const deleteInventoryCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const cafeId = req.user.cafeId || 'CD001';
    const branchId = req.branchId || 'default';

    let finalBranchId = branchId;
    if (branchId === 'all') {
      const categoryDoc = await InventoryCategory.findById(id);
      if (categoryDoc) finalBranchId = categoryDoc.branchId;
    }

    const category = await InventoryCategory.findOne({ _id: id, cafeId, branchId: finalBranchId });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const categoryName = category.name;

    await InventoryCategory.deleteOne({ _id: id, cafeId, branchId: finalBranchId });

    // Update items under this category FOR THIS BRANCH ONLY to 'Uncategorized'
    await Inventory.updateMany(
      { category: categoryName, cafeId, branchId: finalBranchId },
      { category: 'Uncategorized' }
    );

    return res.status(200).json({ success: true, message: 'Inventory category deleted successfully, items moved to Uncategorized' });
  } catch (error) {
    console.error('Error deleting inventory category:', error);
    return res.status(500).json({ success: false, message: 'Server error while deleting inventory category', error: error.message });
  }
};

module.exports = {
  getInventoryCategories,
  createInventoryCategory,
  deleteInventoryCategory
};
