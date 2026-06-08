import axios from 'axios';

// Dynamically determine the backend API base URL for deployment/local IP testing
const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;

  // If in production or accessed via non-localhost, dynamically match the window origin
  if (window.location.hostname !== 'localhost') {
    return `${window.location.origin}/api`;
  }
  
  // Default to development local server port
  return 'http://localhost:5000/api';
};

const API = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getOrders = async () => {
  const response = await API.get('/orders');
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

export const updateOrderStatus = async (id, status) => {
  const response = await API.patch(`/orders/${id}`, { status });
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

export const getStaffSummary = async () => {
  const response = await API.get('/admin/staff-summary');
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

export default API;

