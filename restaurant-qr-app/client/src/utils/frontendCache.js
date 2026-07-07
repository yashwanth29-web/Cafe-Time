// In-memory frontend cache synchronized with Socket.io

const cache = {
  menu: null,
  categories: null,
  inventory: null,
  staff: null,
};

export const frontendCache = {
  getMenu: () => cache.menu,
  setMenu: (menuData) => { cache.menu = menuData; },
  
  getCategories: () => cache.categories,
  setCategories: (catData) => { cache.categories = catData; },
  
  getInventory: () => cache.inventory,
  setInventory: (invData) => { cache.inventory = invData; },
  
  getStaff: () => cache.staff,
  setStaff: (staffData) => { cache.staff = staffData; },
  
  clear: () => {
    cache.menu = null;
    cache.categories = null;
    cache.inventory = null;
    cache.staff = null;
  }
};

export default frontendCache;
