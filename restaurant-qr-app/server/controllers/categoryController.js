const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const menuCache = require('../utils/menuCache');

const DEFAULT_CATEGORIES = [
  'Signature Chai',
  'Coffee Selection',
  'Fresh Juices & Coolers',
  'Thick Milkshakes',
  'Starters & Bites',
  'French Fries'
];

// Seed default categories if none exist
const seedDefaultCategories = async (cafeId, branchId = 'default') => {
  const categoriesToCreate = DEFAULT_CATEGORIES.map(name => ({
    name,
    cafeId,
    branchId
  }));
  return await Category.insertMany(categoriesToCreate);
};

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
const getCategories = async (req, res, next) => {
  try {
    const cafeId = req.query.cafeId || (req.user && req.user.cafeId) || 'CD001';
    const branchId = req.branchId || req.query.branchId || 'default';
    const cached = menuCache.getCategories(cafeId, branchId);
    if (cached) {
      return res.status(200).json({ success: true, count: cached.length, data: cached });
    }
    
    let categories;
    if (branchId === 'all') {
      // Find unique category documents by name for the entire cafe
      categories = await Category.aggregate([
        { $match: { cafeId } },
        { $group: {
            _id: '$name',
            doc: { $first: '$$ROOT' }
        }},
        { $replaceRoot: { newRoot: '$doc' } },
        { $sort: { displayOrder: 1, name: 1 } }
      ]);
    } else {
      categories = await Category.find({ cafeId, branchId }).sort({ displayOrder: 1, name: 1 });
    }

    if (categories.length === 0) {
      try {
        const seedBranchId = branchId === 'all' ? 'default' : branchId;
        const existingInSeedBranch = await Category.find({ cafeId, branchId: seedBranchId });
        if (existingInSeedBranch.length === 0) {
          categories = await seedDefaultCategories(cafeId, seedBranchId);
        } else {
          categories = existingInSeedBranch;
        }
      } catch (seedError) {
        console.warn('[SEED WARNING] Failed to seed default categories:', seedError.message);
        categories = await Category.find({ cafeId, branchId }).sort({ displayOrder: 1, name: 1 });
      }
    }

    if (categories && Array.isArray(categories)) {
      menuCache.setCategories(cafeId, branchId, categories);
    }

    return res.status(200).json({ success: true, count: categories.length, data: categories });
  } catch (error) {
    error.controllerName = 'categoryController';
    error.serviceName = 'getCategories';
    next(error);
  }
};

// @desc    Create a new category
// @route   POST /api/categories
// @access  Protected (Owner/Admin)
const createCategory = async (req, res, next) => {
  try {
    const { name } = req.body;
    const cafeId = req.user.cafeId || 'CD001';
    const branchId = req.branchId || 'default';

    if (!name) {
      return res.status(400).json({ success: false, message: 'Please provide a category name' });
    }

    let finalBranchId = branchId;
    if (branchId === 'all') {
      const Branch = require('../models/Branch');
      const defaultBranch = await Branch.findOne({ cafeId }).lean();
      finalBranchId = defaultBranch ? defaultBranch.branchId : 'default';
    }

    // Check if category already exists in this branch
    const exists = await Category.findOne({ name: name.trim(), cafeId, branchId: finalBranchId });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Category already exists in this branch' });
    }

    const newCategory = new Category({
      name: name.trim(),
      cafeId,
      branchId: finalBranchId
    });

    const savedCategory = await newCategory.save();
    
    // Clear category cache for this cafe/branch
    menuCache.clearCategories(cafeId, finalBranchId);

    return res.status(201).json({ success: true, data: savedCategory });
  } catch (error) {
    error.controllerName = 'categoryController';
    error.serviceName = 'createCategory';
    next(error);
  }
};

// @desc    Update a category
// @route   PATCH /api/categories/:id
// @access  Protected (Owner/Admin)
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const cafeId = req.user.cafeId || 'CD001';
    const branchId = req.branchId || 'default';

    if (!name) {
      return res.status(400).json({ success: false, message: 'Please provide a category name' });
    }

    let finalBranchId = branchId;
    if (branchId === 'all') {
      const categoryDoc = await Category.findOne({ _id: id, cafeId });
      if (categoryDoc) finalBranchId = categoryDoc.branchId;
    }

    const category = await Category.findOne({ _id: id, cafeId, branchId: finalBranchId });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const oldName = category.name;
    const newName = name.trim();

    // Check if another category with the new name exists in this branch
    const duplicate = await Category.findOne({ name: newName, cafeId, branchId: finalBranchId, _id: { $ne: id } });
    if (duplicate) {
      return res.status(400).json({ success: false, message: 'Another category with this name already exists in this branch' });
    }

    category.name = newName;
    const updatedCategory = await category.save();

    // Cascade update to all menu items in this category FOR THIS BRANCH ONLY
    await MenuItem.updateMany(
      { category: oldName, cafeId, branchId: finalBranchId },
      { category: newName },
      { bypassBranchFilter: true }
    );

    // Invalidate caches
    menuCache.clearCategories(cafeId, finalBranchId);
    menuCache.clearMenu(cafeId, finalBranchId);

    return res.status(200).json({ success: true, data: updatedCategory });
  } catch (error) {
    error.controllerName = 'categoryController';
    error.serviceName = 'updateCategory';
    next(error);
  }
};

// @desc    Delete a category
// @route   DELETE /api/categories/:id
// @access  Protected (Owner/Admin)
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cafeId = req.user.cafeId || 'CD001';
    const branchId = req.branchId || 'default';

    let finalBranchId = branchId;
    if (branchId === 'all') {
      const categoryDoc = await Category.findOne({ _id: id, cafeId });
      if (categoryDoc) finalBranchId = categoryDoc.branchId;
    }

    const category = await Category.findOne({ _id: id, cafeId, branchId: finalBranchId });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const categoryName = category.name;

    await Category.deleteOne({ _id: id, cafeId, branchId: finalBranchId });

    // Update menu items in this category FOR THIS BRANCH ONLY to 'Uncategorized'
    await MenuItem.updateMany(
      { category: categoryName, cafeId, branchId: finalBranchId },
      { category: 'Uncategorized' },
      { bypassBranchFilter: true }
    );
    // Invalidate caches
    menuCache.clearCategories(cafeId, finalBranchId);
    menuCache.clearMenu(cafeId, finalBranchId);

    return res.status(200).json({ success: true, message: 'Category deleted successfully, items moved to Uncategorized' });
  } catch (error) {
    error.controllerName = 'categoryController';
    error.serviceName = 'deleteCategory';
    next(error);
  }
};

// @desc    Reorder categories display order
// @route   PUT /api/categories/reorder
// @access  Protected (Owner/Admin)
const reorderCategories = async (req, res, next) => {
  try {
    const { orderedIds } = req.body;
    const cafeId = req.user.cafeId || 'CD001';
    const branchId = req.branchId || 'default';

    if (!orderedIds || !Array.isArray(orderedIds)) {
      return res.status(400).json({ success: false, message: 'Please provide an array of category IDs' });
    }

    const bulkOps = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id, cafeId, branchId },
        update: { $set: { displayOrder: index } }
      }
    }));

    await Category.bulkWrite(bulkOps);

    // Invalidate categories cache
    menuCache.clearCategories(cafeId, branchId);

    return res.status(200).json({ success: true, message: 'Categories reordered successfully' });
  } catch (error) {
    error.controllerName = 'categoryController';
    error.serviceName = 'reorderCategories';
    next(error);
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories
};
