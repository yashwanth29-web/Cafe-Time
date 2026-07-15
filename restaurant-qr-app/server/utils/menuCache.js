const { getContext } = require('./context');

let menuCache = {}; // Keyed by cafeId_branchId
let categoryCache = {}; // Keyed by cafeId_branchId

module.exports = {
  getMenu: (explicitCafeId, explicitBranchId) => {
    const context = getContext();
    const cafeId = explicitCafeId || (context && context.cafeId) || 'CD001';
    const branchId = explicitBranchId || (context && context.branchId) || 'default';
    const key = `${cafeId}_${branchId}`;
    if (menuCache[key]) {
      console.log(`[CACHE] Menu hit for ${key}: serving from memory cache`);
    }
    return menuCache[key];
  },
  
  setMenu: (explicitCafeId, explicitBranchId, data) => {
    let cafeId, branchId, menuData;
    if (data === undefined && Array.isArray(explicitCafeId)) {
      menuData = explicitCafeId;
      const context = getContext();
      cafeId = (context && context.cafeId) || 'CD001';
      branchId = (context && context.branchId) || 'default';
    } else {
      cafeId = explicitCafeId;
      branchId = explicitBranchId;
      menuData = data;
    }
    const key = `${cafeId}_${branchId}`;
    console.log(`[CACHE] Menu populated for ${key}`);
    menuCache[key] = menuData;
  },
  
  clearMenu: (explicitCafeId, explicitBranchId) => {
    const context = getContext();
    const cafeId = explicitCafeId || (context && context.cafeId) || 'CD001';
    const branchId = explicitBranchId || (context && context.branchId) || 'default';
    if (cafeId && branchId === 'default') {
      console.log(`[CACHE] Master branch updated. Invalidating ALL menu caches for ${cafeId}`);
      Object.keys(menuCache).forEach(k => {
        if (k.startsWith(`${cafeId}_`)) {
          delete menuCache[k];
        }
      });
    } else if (cafeId && branchId) {
      const key = `${cafeId}_${branchId}`;
      console.log(`[CACHE] Menu cache invalidated for ${key}`);
      delete menuCache[key];
    } else {
      console.log('[CACHE] All Menu caches invalidated');
      menuCache = {};
    }
  },
  
  getCategories: (explicitCafeId, explicitBranchId) => {
    const context = getContext();
    const cafeId = explicitCafeId || (context && context.cafeId) || 'CD001';
    const branchId = explicitBranchId || (context && context.branchId) || 'default';
    const key = `${cafeId}_${branchId}`;
    if (categoryCache[key]) {
      console.log(`[CACHE] Category hit for ${key}: serving from memory cache`);
    }
    return categoryCache[key];
  },
  
  setCategories: (explicitCafeId, explicitBranchId, data) => {
    let cafeId, branchId, catData;
    if (data === undefined && Array.isArray(explicitCafeId)) {
      catData = explicitCafeId;
      const context = getContext();
      cafeId = (context && context.cafeId) || 'CD001';
      branchId = (context && context.branchId) || 'default';
    } else {
      cafeId = explicitCafeId;
      branchId = explicitBranchId;
      catData = data;
    }
    const key = `${cafeId}_${branchId}`;
    console.log(`[CACHE] Category cache populated for ${key}`);
    categoryCache[key] = catData;
  },
  
  clearCategories: (explicitCafeId, explicitBranchId) => {
    const context = getContext();
    const cafeId = explicitCafeId || (context && context.cafeId) || 'CD001';
    const branchId = explicitBranchId || (context && context.branchId) || 'default';
    if (cafeId && branchId) {
      const key = `${cafeId}_${branchId}`;
      console.log(`[CACHE] Category cache invalidated for ${key}`);
      delete categoryCache[key];
    } else {
      console.log('[CACHE] All Category caches invalidated');
      categoryCache = {};
    }
  },
  
  clearAll: () => {
    console.log('[CACHE] All caches (menu and categories) cleared');
    menuCache = {};
    categoryCache = {};
  }
};
