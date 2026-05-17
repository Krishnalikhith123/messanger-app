import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { useSocketStore } from './store/socketStore';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import ContactsPage from './pages/ContactsPage';
import ProfilePage from './pages/ProfilePage';
import StoriesPage from './pages/StoriesPage';
import ChatHistoryPage from './pages/ChatHistoryPage';
import AIAssistant from './components/AIAssistant';
import './App.css';

function App() {
  const { isAuthenticated, user } = useAuthStore();
  const { initializeSocket } = useSocketStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      initializeSocket(user.id);
    }
  }, [isAuthenticated, user, initializeSocket]);

  return (
    <Router>
      <Toaster position="top-right" />
      {isAuthenticated && <Navbar />}
      {isAuthenticated && <AIAssistant />}
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/chats" />} />
        <Route path="/register" element={!isAuthenticated ? <RegisterPage /> : <Navigate to="/chats" />} />
        
        {isAuthenticated ? (
          <>
            <Route path="/chats" element={<ChatPage />} />
            <Route path="/chat/:chatId" element={<ChatPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/profile/:userId" element={<ProfilePage />} />
            <Route path="/stories" element={<StoriesPage />} />
            <Route path="/chat-history" element={<ChatHistoryPage />} />
            <Route path="/" element={<Navigate to="/chats" />} />
          </>
        ) : (
          <Route path="*" element={<Navigate to="/login" />} />
        )}
      </Routes>
    </Router>
  );
}

export default App;