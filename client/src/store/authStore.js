import { create } from 'zustand';
import axios from 'axios';

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('user')) || null,
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      set({
        token,
        user,
        isAuthenticated: true,
        isLoading: false
      });
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  register: async (username, email, password, confirmPassword) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post('/api/auth/register', {
        username,
        email,
        password,
        confirmPassword
      });
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      set({
        token,
        user,
        isAuthenticated: true,
        isLoading: false
      });
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await axios.post('/api/auth/logout', { userId: useAuthStore.getState().user.id });
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];
      
      set({
        user: null,
        token: null,
        isAuthenticated: false
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  setUser: (user) => set({ user }),
  clearError: () => set({ error: null })
}));

// Set initial auth header
const token = localStorage.getItem('token');
if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}