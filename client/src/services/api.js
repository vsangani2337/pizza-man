import axios from 'axios';

// Relative by default so the Vite dev proxy (/api -> localhost:5001) is used.
// Set VITE_API_URL in production when the API is hosted elsewhere.
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const registerUser = (data) => API.post('/auth/register', data);
export const loginUser = (data) => API.post('/auth/login', data);
export const verifyEmail = (token) => API.get(`/auth/verify-email/${token}`);
export const resendVerification = (email) => API.post('/auth/resend-verification', { email });
export const forgotPassword = (data) => API.post('/auth/forgot-password', data);
export const resetPassword = (token, data) => API.post(`/auth/reset-password/${token}`, data);
export const getMe = () => API.get('/auth/me');

// Menu (all customer-facing options in one request)
export const getMenu = () => API.get('/pizza/menu');

// Store settings (public)
export const getSettings = () => API.get('/settings');

// Orders
export const getMyOrders = () => API.get('/orders/my-orders');
export const getAllOrders = (params = {}) => API.get('/orders', { params });
export const updateOrderStatus = (id, status) => API.put(`/orders/${id}/status`, { status });
export const cancelOrder = (id) => API.post(`/orders/${id}/cancel`);

// Payment — the server always calculates the amount; prices never come from the client
export const quoteOrder = (items) => API.post('/payment/quote', { items });
export const createPaymentOrder = (items, customer) => API.post('/payment/create-order', { items, customer });
export const verifyPayment = (data) => API.post('/payment/verify', data);

// Profile / account
export const getProfile = () => API.get('/auth/profile');
export const updateProfile = (data) => API.put('/auth/profile', data);
export const updateAddresses = (addresses) => API.put('/auth/addresses', { addresses });
export const changePassword = (data) => API.put('/auth/change-password', data);
export const getFavorites = () => API.get('/auth/favorites');
export const toggleFavorite = (productId) => API.post(`/auth/favorites/${productId}`);

// Analytics (admin)
export const getAnalytics = (params = {}) => API.get('/analytics', { params });

// Users (admin)
export const getUsers = (params = {}) => API.get('/users', { params });
export const getUserDetail = (id) => API.get(`/users/${id}`);
export const getUserOrders = (id, params = {}) => API.get(`/users/${id}/orders`, { params });
export const updateUser = (id, data) => API.put(`/users/${id}`, data);

// Products + categories (admin)
export const getProductsAdmin = (params = {}) => API.get('/products', { params });
export const createProduct = (data) => API.post('/products', data);
export const updateProduct = (id, data) => API.put(`/products/${id}`, data);
export const deleteProduct = (id) => API.delete(`/products/${id}`);
export const getCategories = () => API.get('/products/categories/list');
export const createCategory = (data) => API.post('/products/categories', data);
export const updateCategory = (id, data) => API.put(`/products/categories/${id}`, data);
export const deleteCategory = (id) => API.delete(`/products/categories/${id}`);

// Inventory (admin)
export const getInventory = (params = {}) => API.get('/inventory', { params });
export const getInventoryStats = () => API.get('/inventory/stats');
export const addInventoryItem = (data) => API.post('/inventory', data);
export const updateInventoryItem = (id, data) => API.put(`/inventory/${id}`, data);
export const deleteInventoryItem = (id) => API.delete(`/inventory/${id}`);
export const restockInventoryItem = (id, quantity) => API.post(`/inventory/${id}/restock`, { quantity });
export const getStockLog = (params = {}) => API.get('/inventory/log', { params });

// Store settings (admin)
export const updateSettings = (data) => API.put('/settings', data);

export default API;
