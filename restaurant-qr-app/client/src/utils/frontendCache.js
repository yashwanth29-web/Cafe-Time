// In-memory frontend cache synchronized with Socket.io

const getFrontendPartitionKey = () => {
  const isCustomerView = window.location.pathname === '/' || window.location.pathname === '/history' || window.location.pathname === '/cart';
  let cafeId, branchId;
  const searchParams = new URLSearchParams(window.location.search);
  if (isCustomerView) {
    cafeId = searchParams.get('cafeId') || sessionStorage.getItem('cafeId') || '';
    branchId = searchParams.get('branchId') || sessionStorage.getItem('branchId') || 'default';
  } else {
    cafeId = localStorage.getItem('activeCafeId') || searchParams.get('cafeId') || sessionStorage.getItem('cafeId') || '';
    branchId = localStorage.getItem('activeBranchId') || searchParams.get('branchId') || sessionStorage.getItem('branchId') || 'default';
  }
  return `${cafeId}_${branchId}`;
};

const cache = {
  menu: {},
  categories: {},
  inventory: {},
  staff: {},
};

export const frontendCache = {
  getMenu: () => {
    const key = getFrontendPartitionKey();
    if (cache.menu[key]) return cache.menu[key];
    try {
      const stored = localStorage.getItem(`fe_cache_menu_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        cache.menu[key] = parsed;
        return parsed;
      }
    } catch (_) {}
    return null;
  },
  setMenu: (menuData) => {
    const key = getFrontendPartitionKey();
    cache.menu[key] = menuData;
    try {
      localStorage.setItem(`fe_cache_menu_${key}`, JSON.stringify(menuData));
    } catch (_) {}
  },
  
  getCategories: () => {
    const key = getFrontendPartitionKey();
    if (cache.categories[key]) return cache.categories[key];
    try {
      const stored = localStorage.getItem(`fe_cache_cats_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        cache.categories[key] = parsed;
        return parsed;
      }
    } catch (_) {}
    return null;
  },
  setCategories: (catData) => {
    const key = getFrontendPartitionKey();
    cache.categories[key] = catData;
    try {
      localStorage.setItem(`fe_cache_cats_${key}`, JSON.stringify(catData));
    } catch (_) {}
  },
  
  getInventory: () => {
    const key = getFrontendPartitionKey();
    if (cache.inventory[key]) return cache.inventory[key];
    try {
      const stored = localStorage.getItem(`fe_cache_inv_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        cache.inventory[key] = parsed;
        return parsed;
      }
    } catch (_) {}
    return null;
  },
  setInventory: (invData) => {
    const key = getFrontendPartitionKey();
    cache.inventory[key] = invData;
    try {
      localStorage.setItem(`fe_cache_inv_${key}`, JSON.stringify(invData));
    } catch (_) {}
  },
  
  getStaff: () => {
    const key = getFrontendPartitionKey();
    return cache.staff[key] || null;
  },
  setStaff: (staffData) => {
    const key = getFrontendPartitionKey();
    cache.staff[key] = staffData;
  },
  
  clear: () => {
    cache.menu = {};
    cache.categories = {};
    cache.inventory = {};
    cache.staff = {};
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('fe_cache_')) localStorage.removeItem(k);
      });
    } catch (_) {}
  }
};

export default frontendCache;

