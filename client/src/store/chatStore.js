import { create } from 'zustand';
import axios from 'axios';

export const useChatStore = create((set) => ({
  chats: [],
  currentChat: null,
  messages: [],
  isLoading: false,

  fetchChats: async () => {
    set({ isLoading: true });
    try {
      const response = await axios.get('/api/chats');
      set({ chats: response.data, isLoading: false });
      return response.data;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  getOrCreateChat: async (userId) => {
    try {
      const response = await axios.post('/api/chats/get-or-create', { userId });
      set((state) => ({
        chats: [response.data, ...state.chats.filter(c => c._id !== response.data._id)]
      }));
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  createGroup: async (groupData) => {
    try {
      const response = await axios.post('/api/chats/group', groupData);
      set((state) => ({
        chats: [response.data, ...state.chats]
      }));
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  fetchMessages: async (chatId) => {
    set({ isLoading: true });
    try {
      const response = await axios.get(`/api/messages/${chatId}`);
      set({ messages: response.data, isLoading: false });
      return response.data;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message]
    }));
  },

  setCurrentChat: (chat) => set({ currentChat: chat }),
  
  setChats: (chats) => set({ chats }),

  removeMessage: (messageId) => {
    set((state) => ({
      messages: state.messages.filter(m => m._id !== messageId)
    }));
  },

  updateChats: (updatedChat) => {
    set((state) => ({
      chats: state.chats.map(c => c._id === updatedChat._id ? updatedChat : c)
    }));
  },

  deleteChat: async (chatId) => {
    try {
      await axios.delete(`/api/chats/${chatId}`);
      set((state) => ({
        chats: state.chats.filter(c => c._id !== chatId),
        currentChat: null
      }));
    } catch (error) {
      throw error;
    }
  },

  leaveGroup: async (chatId) => {
    try {
      await axios.post(`/api/chats/${chatId}/leave`);
      set((state) => ({
        chats: state.chats.filter(c => c._id !== chatId),
        currentChat: null
      }));
    } catch (error) {
      throw error;
    }
  }
}));