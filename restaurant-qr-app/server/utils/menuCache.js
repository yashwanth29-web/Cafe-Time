const { getContext } = require('./context');

// Keyed by cafeId_branchId -> { data, expiresAt }
let menuCache = {};
let categoryCache = {};

const CACHE_TTL_MS = 5000; // 5 seconds TTL ensures localhost and live stay in sync with MongoDB

module.exports = {
  getMenu: (explicitCafeId, explicitBranchId) => {
    const context = getContext();
    const cafeId = explicitCafeId || (context && context.cafeId) || 'CD001';
    const branchId = explicitBranchId || (context && context.branchId) || 'default';
    const key = `${cafeId}_${branchId}`;
    
    const entry = menuCache[key];
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data;
    }
    if (entry) {
      delete menuCache[key];
    }
    return null;
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
    menuCache[key] = {
      data: menuData,
      expiresAt: Date.now() + CACHE_TTL_MS
    };
  },
  
  clearMenu: (explicitCafeId, explicitBranchId) => {
    const context = getContext();
    const cafeId = explicitCafeId || (context && context.cafeId) || 'CD001';
    const branchId = explicitBranchId || (context && context.branchId) || 'default';
    if (cafeId && (branchId === 'default' || branchId === 'all')) {
      Object.keys(menuCache).forEach(k => {
        if (k.startsWith(`${cafeId}_`)) {
          delete menuCache[k];
        }
      });
    } else if (cafeId && branchId) {
      const key = `${cafeId}_${branchId}`;
      delete menuCache[key];
    } else {
      menuCache = {};
    }
  },
  
  getCategories: (explicitCafeId, explicitBranchId) => {
    const context = getContext();
    const cafeId = explicitCafeId || (context && context.cafeId) || 'CD001';
    const branchId = explicitBranchId || (context && context.branchId) || 'default';
    const key = `${cafeId}_${branchId}`;
    
    const entry = categoryCache[key];
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data;
    }
    if (entry) {
      delete categoryCache[key];
    }
    return null;
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
    categoryCache[key] = {
      data: catData,
      expiresAt: Date.now() + CACHE_TTL_MS
    };
  },
  
  clearCategories: (explicitCafeId, explicitBranchId) => {
    const context = getContext();
    const cafeId = explicitCafeId || (context && context.cafeId) || 'CD001';
    const branchId = explicitBranchId || (context && context.branchId) || 'default';
    if (cafeId && (branchId === 'default' || branchId === 'all')) {
      Object.keys(categoryCache).forEach(k => {
        if (k.startsWith(`${cafeId}_`)) {
          delete categoryCache[k];
        }
      });
    } else if (cafeId && branchId) {
      const key = `${cafeId}_${branchId}`;
      delete categoryCache[key];
    } else {
      categoryCache = {};
    }
  },
  
  clearAll: () => {
    menuCache = {};
    categoryCache = {};
  }
};
