import axios from 'axios';

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
