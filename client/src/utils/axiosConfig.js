import axios from 'axios';

// Set production API base URL from env if provided, otherwise default to relative path for dev proxy
const API_URL = process.env.REACT_APP_API_URL || '';
axios.defaults.baseURL = API_URL;

// Global response interceptor — catches 401 (expired/invalid token) across ALL requests
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token is invalid or expired — clear auth state and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];

      // Avoid redirect loop if already on login/register
      const pathname = window.location.pathname;
      if (pathname !== '/login' && pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
