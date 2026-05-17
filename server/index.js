import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chats.js';
import messageRoutes from './routes/messages.js';
import userRoutes from './routes/users.js';
import storyRoutes from './routes/stories.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initSocket, setOnlineUsers } from './socket.js';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mern-messenger')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stories', storyRoutes);

// Socket.io Real-time Communication
const onlineUsers = new Map();
initSocket(io);
setOnlineUsers(onlineUsers);

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  socket.on('user-online', (userId) => {
    onlineUsers.set(userId, socket.id);
    setOnlineUsers(onlineUsers);
    io.emit('user-status-changed', { userId, status: 'online' });
  });

  socket.on('send-message', (data) => {
    const recipientSocketId = onlineUsers.get(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('receive-message', data);
      io.to(recipientSocketId).emit('unread-notification', {
        senderId: data.senderId._id,
        senderName: data.senderId.username,
        message: `You have received a new message from ${data.senderId.username}`
      });
    }
  });

  socket.on('send-voice', (data) => {
    const recipientSocketId = onlineUsers.get(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('receive-voice', data);
      io.to(recipientSocketId).emit('unread-notification', {
        senderId: data.senderId._id,
        senderName: data.senderId.username,
        message: `${data.senderId.username} sent you a voice message`
      });
    }
  });

  // Call handling
  socket.on('initiate-call', (data) => {
    const recipientSocketId = onlineUsers.get(data.receiverId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('incoming-call', {
        callerId: socket.id,
        callerName: data.callerName,
        callType: data.callType
      });
    }
  });

  socket.on('accept-call', (data) => {
    const recipientSocketId = onlineUsers.get(data.callerId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('call-accepted', {
        acceptedBy: data.acceptedBy
      });
    }
  });

  socket.on('reject-call', (data) => {
    const recipientSocketId = onlineUsers.get(data.callerId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('call-rejected', {
        rejectedBy: data.rejectedBy
      });
    }
  });

  socket.on('end-call', (data) => {
    const recipientSocketId = onlineUsers.get(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('call-ended', {
        endedBy: data.endedBy
      });
    }
  });

  socket.on('user-typing', (data) => {
    const recipientSocketId = onlineUsers.get(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('user-typing', { userId: data.userId });
    }
  });

  socket.on('stop-typing', (data) => {
    const recipientSocketId = onlineUsers.get(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('stop-typing', { userId: data.userId });
    }
  });

  socket.on('delete-message', (data) => {
    const recipientSocketId = onlineUsers.get(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('message-deleted', {
        messageId: data.messageId
      });
    }
  });

  socket.on('react-message', (data) => {
    const recipientSocketId = onlineUsers.get(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('message-reacted', data);
    }
  });

  socket.on('message-read', (data) => {
    const recipientSocketId = onlineUsers.get(data.senderId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('message-read-update', data);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    let disconnectedUserId;
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        disconnectedUserId = userId;
        onlineUsers.delete(userId);
        setOnlineUsers(onlineUsers);
        break;
      }
    }
    if (disconnectedUserId) {
      io.emit('user-status-changed', { userId: disconnectedUserId, status: 'offline' });
    }
  });
});

// Error Handler
app.use(errorHandler);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running ✅' });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 API URL: http://localhost:${PORT}`);
});

export { app as default, io };