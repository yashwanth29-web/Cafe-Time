let menuCache = null;
let categoryCache = {}; // Keyed by cafeId since categories are branch/cafe specific

module.exports = {
  getMenu: () => {
    if (menuCache) {
      console.log('[CACHE] Menu hit: serving from memory cache');
    }
    return menuCache;
  },
  
  setMenu: (data) => {
    console.log('[CACHE] Menu populated in memory');
    menuCache = data;
  },
  
  clearMenu: () => {
    console.log('[CACHE] Menu cache invalidated/cleared');
    menuCache = null;
  },
  
  getCategories: (cafeId) => {
    const key = cafeId || 'CD001';
    if (categoryCache[key]) {
      console.log(`[CACHE] Category hit for cafe ${key}: serving from memory cache`);
    }
    return categoryCache[key];
  },
  
  setCategories: (cafeId, data) => {
    const key = cafeId || 'CD001';
    console.log(`[CACHE] Category cache populated for cafe ${key}`);
    categoryCache[key] = data;
  },
  
  clearCategories: (cafeId) => {
    if (cafeId) {
      console.log(`[CACHE] Category cache invalidated for cafe ${cafeId}`);
      delete categoryCache[cafeId];
    } else {
      console.log('[CACHE] All Category caches invalidated');
      categoryCache = {};
    }
  },
  
  clearAll: () => {
    console.log('[CACHE] All caches (menu and categories) cleared');
    menuCache = null;
    categoryCache = {};
  }
};
