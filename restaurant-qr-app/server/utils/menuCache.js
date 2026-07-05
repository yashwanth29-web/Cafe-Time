const { getContext } = require('./context');

let menuCache = {}; // Keyed by cafeId_branchId
let categoryCache = {}; // Keyed by cafeId_branchId

module.exports = {
  getMenu: () => {
    const context = getContext();
    const cafeId = (context && context.cafeId) || 'CD001';
    const branchId = (context && context.branchId) || 'default';
    const key = `${cafeId}_${branchId}`;
    if (menuCache[key]) {
      console.log(`[CACHE] Menu hit for ${key}: serving from memory cache`);
    }
    return menuCache[key];
  },
  
  setMenu: (data) => {
    const context = getContext();
    const cafeId = (context && context.cafeId) || 'CD001';
    const branchId = (context && context.branchId) || 'default';
    const key = `${cafeId}_${branchId}`;
    console.log(`[CACHE] Menu populated for ${key}`);
    menuCache[key] = data;
  },
  
  clearMenu: () => {
    const context = getContext();
    const cafeId = (context && context.cafeId) || 'CD001';
    const branchId = (context && context.branchId) || 'default';
    if (cafeId && branchId) {
      const key = `${cafeId}_${branchId}`;
      console.log(`[CACHE] Menu cache invalidated for ${key}`);
      delete menuCache[key];
    } else {
      console.log('[CACHE] All Menu caches invalidated');
      menuCache = {};
    }
  },
  
  getCategories: () => {
    const context = getContext();
    const cafeId = (context && context.cafeId) || 'CD001';
    const branchId = (context && context.branchId) || 'default';
    const key = `${cafeId}_${branchId}`;
    if (categoryCache[key]) {
      console.log(`[CACHE] Category hit for ${key}: serving from memory cache`);
    }
    return categoryCache[key];
  },
  
  setCategories: (data) => {
    const context = getContext();
    const cafeId = (context && context.cafeId) || 'CD001';
    const branchId = (context && context.branchId) || 'default';
    const key = `${cafeId}_${branchId}`;
    console.log(`[CACHE] Category cache populated for ${key}`);
    categoryCache[key] = data;
  },
  
  clearCategories: () => {
    const context = getContext();
    const cafeId = (context && context.cafeId) || 'CD001';
    const branchId = (context && context.branchId) || 'default';
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
