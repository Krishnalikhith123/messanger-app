import { create } from 'zustand';
import io from 'socket.io-client';

export const useSocketStore = create((set) => ({
  socket: null,
  isConnected: false,
  onlineUsers: new Set(),

  initializeSocket: (userId) => {
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const socket = io(API_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      socket.emit('user-online', userId);
      set({ socket, isConnected: true });
    });

    socket.on('user-status-changed', ({ userId: statusUserId, status }) => {
      set((state) => {
        const newOnlineUsers = new Set(state.onlineUsers);
        if (status === 'online') {
          newOnlineUsers.add(statusUserId);
        } else {
          newOnlineUsers.delete(statusUserId);
        }
        return { onlineUsers: newOnlineUsers };
      });
    });

    socket.on('disconnect', () => {
      set({ isConnected: false });
    });

    return socket;
  },

  getSocket: () => {
    const state = useSocketStore.getState();
    return state.socket;
  }
}));