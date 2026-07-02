let menuCache = {}; // Keyed by branchId
let categoryCache = {}; // Keyed by cafeId_branchId since categories are branch specific

module.exports = {
  getMenu: (branchId) => {
    const key = branchId || 'default';
    if (menuCache[key]) {
      console.log(`[CACHE] Menu hit for branch ${key}: serving from memory cache`);
    }
    return menuCache[key];
  },
  
  setMenu: (branchId, data) => {
    const key = branchId || 'default';
    console.log(`[CACHE] Menu populated in memory for branch ${key}`);
    menuCache[key] = data;
  },
  
  clearMenu: (branchId) => {
    if (branchId) {
      console.log(`[CACHE] Menu cache invalidated/cleared for branch ${branchId}`);
      delete menuCache[branchId];
    } else {
      console.log('[CACHE] All Menu caches invalidated');
      menuCache = {};
    }
  },
  
  getCategories: (cafeId, branchId) => {
    const key = `${cafeId || 'CD001'}_${branchId || 'default'}`;
    if (categoryCache[key]) {
      console.log(`[CACHE] Category hit for ${key}: serving from memory cache`);
    }
    return categoryCache[key];
  },
  
  setCategories: (cafeId, branchId, data) => {
    const key = `${cafeId || 'CD001'}_${branchId || 'default'}`;
    console.log(`[CACHE] Category cache populated for ${key}`);
    categoryCache[key] = data;
  },
  
  clearCategories: (cafeId, branchId) => {
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
