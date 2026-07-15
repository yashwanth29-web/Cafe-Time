// In-memory frontend cache synchronized with Socket.io

const getFrontendPartitionKey = () => {
  const isCustomerView = window.location.pathname === '/' || window.location.pathname === '/history';
  let cafeId, branchId;
  if (isCustomerView) {
    cafeId = sessionStorage.getItem('cafeId') || 'CD001';
    branchId = sessionStorage.getItem('branchId') || 'default';
  } else {
    cafeId = localStorage.getItem('activeCafeId') || sessionStorage.getItem('cafeId') || 'CD001';
    branchId = localStorage.getItem('activeBranchId') || sessionStorage.getItem('branchId') || 'default';
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
    return cache.menu[key] || null;
  },
  setMenu: (menuData) => {
    const key = getFrontendPartitionKey();
    cache.menu[key] = menuData;
  },
  
  getCategories: () => {
    const key = getFrontendPartitionKey();
    return cache.categories[key] || null;
  },
  setCategories: (catData) => {
    const key = getFrontendPartitionKey();
    cache.categories[key] = catData;
  },
  
  getInventory: () => {
    const key = getFrontendPartitionKey();
    return cache.inventory[key] || null;
  },
  setInventory: (invData) => {
    const key = getFrontendPartitionKey();
    cache.inventory[key] = invData;
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
  }
};

export default frontendCache;

