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

export default API;
