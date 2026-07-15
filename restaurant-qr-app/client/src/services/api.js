import axios from 'axios';

// Dynamically determine the backend API base URL for deployment/local IP testing
const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  
  // If we are in production or accessed via non-localhost, dynamically match the window origin
  // and ignore localhost-bound compile-time configurations
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl;
    }
    return `${window.location.origin}/api`;
  }

  if (envUrl) return envUrl;
  
  // Default to development local server port
  return `http://${window.location.hostname}:5000/api`;
};

// Helper to format absolute asset URLs to use the current host (useful when testing via local network IPs)
export const getAssetUrl = (url) => {
  if (!url) return '';

  // 1. Handle relative paths (e.g. /uploads/filename.jpg)
  if (url.startsWith('/uploads')) {
    const envUrl = import.meta.env.VITE_API_URL;
    let origin = '';
    
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      origin = window.location.origin;
    } else if (envUrl) {
      origin = envUrl.replace(/\/api$/, '');
    } else {
      origin = 'http://localhost:5000';
    }
    
    // Support protocol matching
    if (window.location.protocol === 'https:' && origin.startsWith('http:')) {
      origin = origin.replace('http:', 'https:');
    }
    return `${origin}${url}`;
  }

  // 2. Handle absolute paths from other domains or localhost:5000 fallback
  if (url.includes('localhost:5000') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    const origin = window.location.origin;
    const match = url.match(/\/uploads\/.+$/);
    if (match) {
      return `${origin}${match[0]}`;
    }
  }

  // 3. Upgrade insecure absolute URLs in production to avoid mixed content warnings
  if (window.location.protocol === 'https:' && url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
    return url.replace('http://', 'https://');
  }

  return url;
};

const API = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token to all API requests if present
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    const isCustomerView = window.location.pathname === '/' || window.location.pathname === '/history';
    
    let activeBranchId;
    let activeCafeId;
    if (isCustomerView) {
      // In customer view, strictly prefer the branchId and cafeId from the URL (which App.jsx puts in sessionStorage)
      activeBranchId = sessionStorage.getItem('branchId') || localStorage.getItem('activeBranchId');
      activeCafeId = sessionStorage.getItem('cafeId') || localStorage.getItem('activeCafeId');
    } else {
      // In owner/staff dashboards, prefer the active branch and cafe from localStorage
      activeBranchId = localStorage.getItem('activeBranchId') || sessionStorage.getItem('branchId');
      activeCafeId = localStorage.getItem('activeCafeId') || sessionStorage.getItem('cafeId');
    }
    
    if (activeBranchId) {
      config.headers['x-branch-id'] = activeBranchId;
    }
    if (activeCafeId) {
      config.headers['x-cafe-id'] = activeCafeId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


export const getOrders = async (params) => {
  const response = await API.get('/orders', { params });
  return response.data;
};

export const getOrderById = async (id) => {
  const response = await API.get(`/orders/${id}`);
  return response.data;
};

export const placeOrder = async (orderData) => {
  const response = await API.post('/orders', orderData);
  return response.data;
};

export const updateOrderStatus = async (id, payload) => {
  const data = typeof payload === 'string' ? { status: payload } : payload;
  const response = await API.patch(`/orders/${id}`, data);
  return response.data;
};

export const updateOrderPaymentMethod = async (id, paymentMethod) => {
  const response = await API.patch(`/orders/${id}/payment-method`, { paymentMethod });
  return response.data;
};

// Menu API helpers
export const getMenu = async () => {
  const response = await API.get('/menu');
  return response.data;
};

export const createMenuItem = async (menuItemData) => {
  const response = await API.post('/menu', menuItemData);
  return response.data;
};

export const updateMenuItem = async (id, menuItemData) => {
  const response = await API.patch(`/menu/${id}`, menuItemData);
  return response.data;
};

export const deleteMenuItem = async (id) => {
  const response = await API.delete(`/menu/${id}`);
  return response.data;
};

export const uploadMenuItemImage = async (formData) => {
  const response = await API.post('/menu/upload-image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

// Category API helpers
export const getCategories = async () => {
  const response = await API.get('/categories');
  return response.data;
};

export const createCategory = async (categoryData) => {
  const response = await API.post('/categories', categoryData);
  return response.data;
};

export const updateCategory = async (id, categoryData) => {
  const response = await API.patch(`/categories/${id}`, categoryData);
  return response.data;
};

export const deleteCategory = async (id) => {
  const response = await API.delete(`/categories/${id}`);
  return response.data;
};

export const reorderCategories = async (orderedIds) => {
  const response = await API.put('/categories/reorder', { orderedIds });
  return response.data;
};

// Payment API helpers
export const createPaymentOrder = async (paymentData) => {
  const response = await API.post('/payment/create-order', paymentData);
  return response.data;
};

export const verifyPayment = async (verificationData) => {
  const response = await API.post('/payment/verify', verificationData);
  return response.data;
};

export const payExistingOrder = async (payload) => {
  const response = await API.post('/payment/pay-existing-order', payload);
  return response.data;
};

// Auth API helpers
export const sendOtp = async (email) => {
  const response = await API.post('/auth/send-otp', { email });
  return response.data;
};

export const verifyOtp = async (email, otp) => {
  const response = await API.post('/auth/verify-otp', { email, otp });
  return response.data;
};

export const resendOtp = async (email) => {
  const response = await API.post('/auth/resend-otp', { email });
  return response.data;
};

export const logoutUser = async () => {
  const response = await API.post('/auth/logout');
  return response.data;
};

export const loginWithGoogleApi = async (credential) => {
  const response = await API.post('/auth/google', { credential });
  return response.data;
};

export const getMe = async () => {
  const response = await API.get('/auth/me');
  return response.data;
};

// Super Admin API helpers
export const createOwner = async (ownerData) => {
  const response = await API.post('/superadmin/create-owner', ownerData);
  return response.data;
};

export const getCafes = async () => {
  const response = await API.get('/superadmin/cafes');
  return response.data;
};

export const updateCafe = async (id, cafeData) => {
  const response = await API.put(`/superadmin/cafe/${id}`, cafeData);
  return response.data;
};

export const deleteCafe = async (id) => {
  const response = await API.delete(`/superadmin/cafe/${id}`);
  return response.data;
};

// Cafe Owner Admin API helpers
export const createStaff = async (staffData) => {
  const response = await API.post('/admin/create-staff', staffData);
  return response.data;
};

export const getStaff = async () => {
  const response = await API.get('/admin/staff');
  return response.data;
};

export const updateStaff = async (id, staffData) => {
  const response = await API.put(`/admin/staff/${id}`, staffData);
  return response.data;
};

export const deleteStaff = async (id) => {
  const response = await API.delete(`/admin/staff/${id}`);
  return response.data;
};

export const getStaffSummary = async () => {
  const response = await API.get('/admin/staff-summary');
  return response.data;
};

export const seedTenantAssets = async () => {
  const response = await API.post('/admin/setup/seed-assets');
  return response.data;
};

// Branches Management APIs
export const getBranches = async () => {
  const response = await API.get('/admin/branches');
  return response.data;
};

export const createBranch = async (branchData) => {
  const response = await API.post('/admin/branches', branchData);
  return response.data;
};

export const updateBranch = async (id, branchData) => {
  const response = await API.put(`/admin/branches/${id}`, branchData);
  return response.data;
};

export const deleteBranch = async (id) => {
  const response = await API.delete(`/admin/branches/${id}`);
  return response.data;
};

// Support Tickets APIs
export const getTickets = async () => {
  const response = await API.get('/superadmin/tickets');
  return response.data;
};

export const updateTicketStatus = async (id, status) => {
  const response = await API.patch(`/superadmin/tickets/${id}`, { status });
  return response.data;
};

// Profile Update API
export const updateOwnerProfile = async (userData) => {
  const response = await API.put('/admin/profile/owner', userData);
  return response.data;
};

// V2 Owner Setup Wizard APIs
export const getSetupData = async () => {
  const response = await API.get('/admin/setup');
  return response.data;
};

export const saveSetupData = async (setupData) => {
  const response = await API.post('/admin/setup', setupData);
  return response.data;
};

export const verifyRazorpayKeys = async (keyId, secret) => {
  const response = await API.post('/admin/verify-razorpay', { keyId, secret });
  return response.data;
};

export const getReports = async (params) => {
  const response = await API.get('/admin/reports', { params });
  return response.data;
};

export const uploadLogo = async (file) => {
  const formData = new FormData();
  formData.append('logo', file);
  const response = await API.post('/admin/upload-logo', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

// Inventory APIs
export const getInventory = async () => {
  const response = await API.get('/inventory');
  return response.data;
};

export const createInventoryItem = async (itemData) => {
  const response = await API.post('/inventory', itemData);
  return response.data;
};

export const updateInventoryItem = async (id, itemData) => {
  const response = await API.patch(`/inventory/${id}`, itemData);
  return response.data;
};

export const deleteInventoryItem = async (id) => {
  const response = await API.delete(`/inventory/${id}`);
  return response.data;
};

export const getInventoryLogs = async () => {
  const response = await API.get('/inventory/logs');
  return response.data;
};

export const recordPurchase = async (purchaseData) => {
  const response = await API.post('/inventory/purchase', purchaseData);
  return response.data;
};

export const recordWastage = async (wastageData) => {
  const response = await API.post('/inventory/wastage', wastageData);
  return response.data;
};

export const reportShortage = async (shortageData) => {
  const response = await API.post('/inventory/shortage', shortageData);
  return response.data;
};

export const getWastageReport = async () => {
  const response = await API.get('/inventory/reports/wastage');
  return response.data;
};

export const getConsumptionReport = async () => {
  const response = await API.get('/inventory/reports/consumption');
  return response.data;
};

// Inventory Category API helpers
export const getInventoryCategories = async () => {
  const response = await API.get('/inventory/categories');
  return response.data;
};

export const createInventoryCategory = async (categoryData) => {
  const response = await API.post('/inventory/categories', categoryData);
  return response.data;
};

export const deleteInventoryCategory = async (id) => {
  const response = await API.delete(`/inventory/categories/${id}`);
  return response.data;
};

// Attendance APIs
export const checkIn = async (attendanceData) => {
  const response = await API.post('/attendance/check-in', attendanceData);
  return response.data;
};

export const checkOut = async (attendanceData) => {
  const response = await API.post('/attendance/check-out', attendanceData);
  return response.data;
};

export const startExtraWork = async (attendanceData) => {
  const response = await API.post('/attendance/extra-work/start', attendanceData);
  return response.data;
};

export const stopExtraWork = async (attendanceData) => {
  const response = await API.post('/attendance/extra-work/stop', attendanceData);
  return response.data;
};

// Payroll APIs
export const generatePayroll = async (weekStart, weekEnd) => {
  const response = await API.post('/payroll/generate', { weekStart, weekEnd });
  return response.data;
};

export const getPayrollList = async (params) => {
  const response = await API.get('/payroll', { params });
  return response.data;
};

export const getPayrollDetails = async (id) => {
  const response = await API.get(`/payroll/${id}`);
  return response.data;
};

export const getCurrentEmployeePayroll = async () => {
  const response = await API.get('/payroll/current');
  return response.data;
};

export const updatePayroll = async (id, payrollData) => {
  const response = await API.patch(`/payroll/${id}`, payrollData);
  return response.data;
};

export const payPayroll = async (id, paymentData) => {
  const response = await API.patch(`/payroll/${id}/pay`, paymentData);
  return response.data;
};

export const deletePayroll = async (id) => {
  const response = await API.delete(`/payroll/${id}`);
  return response.data;
};

export const getPayrollHistory = async () => {
  const response = await API.get('/payroll/history');
  return response.data;
};

export const getPayrollReport = async (params) => {
  const response = await API.get('/payroll/report', { params });
  return response.data;
};

export const approvePayroll = async (id) => {
  const response = await API.patch(`/payroll/${id}/approve`);
  return response.data;
};

export const getSalaryHistory = async (params) => {
  const response = await API.get('/payroll/salary-history', { params });
  return response.data;
};

// In-app Notifications APIs
export const getNotifications = async () => {
  const response = await API.get('/notifications');
  return response.data;
};

export const markNotificationRead = async (id) => {
  const response = await API.patch(`/notifications/${id}/read`);
  return response.data;
};

export const getTodayAttendanceStatus = async (params) => {
  const response = await API.get('/attendance/today', { params });
  return response.data;
};

export const getStaffAttendanceHistory = async () => {
  const response = await API.get('/attendance/history');
  return response.data;
};

export const getOwnerTodayAttendance = async () => {
  const response = await API.get('/attendance/owner/today');
  return response.data;
};

export const getOwnerAttendanceReports = async (params) => {
  const response = await API.get('/attendance/owner/reports', { params });
  return response.data;
};

// Work Reports APIs
export const submitWorkReport = async (formData) => {
  const response = await API.post('/work-reports/submit', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const getWorkReports = async (params) => {
  const response = await API.get('/work-reports/owner', { params });
  return response.data;
};

// Cafe Public API
export const getCafeInfo = async (cafeId) => {
  const response = await API.get(`/cafe/${cafeId}`);
  return response.data;
};

export const getPaymentInfo = async () => {
  const response = await API.get('/cafe/payment-info/config');
  return response.data;
};

// Customer Reviews APIs
export const submitReview = async (reviewPayload) => {
  const response = await API.post('/reviews', reviewPayload);
  return response.data;
};

export const getReviews = async (params) => {
  const response = await API.get('/reviews', { params });
  return response.data;
};

export default API;




export const getDashboardStats = async (params) => {
  const response = await API.get('/admin/dashboard-stats', { params });
  return response.data;
};


