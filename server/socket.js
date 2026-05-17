// Singleton socket.io instance holder - breaks circular dependency
let _io = null;
let _onlineUsers = new Map();

export const initSocket = (io) => {
  _io = io;
};

export const setOnlineUsers = (onlineUsers) => {
  _onlineUsers = onlineUsers;
};

export const emitToUser = (userId, event, data) => {
  if (!_io) return;
  const socketId = _onlineUsers.get(userId.toString());
  if (socketId) {
    _io.to(socketId).emit(event, data);
  }
};

export const getIO = () => _io;
export const getOnlineUsers = () => _onlineUsers;
