import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { FiMenu, FiX, FiMessageCircle, FiUsers, FiUser, FiImage, FiArrowUpCircle, FiLogOut, FiHome } from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../styles/Navbar.css';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  const navItems = [
    { path: '/chats', label: 'Messages', icon: FiMessageCircle },
    { path: '/contacts', label: 'Contacts', icon: FiUsers },
    { path: '/stories', label: 'Stories', icon: FiImage },
    { path: '/chat-history', label: 'History', icon: FiArrowUpCircle },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-logo" onClick={() => navigate('/chats')} style={{ cursor: 'pointer' }}>
          <span className="logo-icon">💬</span>
          <div className="logo-text-container">
            <span className="logo-text">ChatFlow</span>
            <span className="logo-subtitle">Stay Connected</span>
          </div>
        </div>

        <button
          className="nav-toggle"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <FiX size={28} /> : <FiMenu size={28} />}
        </button>

        <div className={`nav-menu ${isMenuOpen ? 'active' : ''}`}>
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => {
                  navigate(item.path);
                  setIsMenuOpen(false);
                }}
                title={item.label}
              >
                <Icon size={24} />
                <span className="nav-label">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="nav-user">
          <button
            className="profile-btn"
            onClick={() => {
              navigate(`/profile/${user?.id}`);
              setIsMenuOpen(false);
            }}
            title="View Profile"
          >
            <FiUser size={24} />
          </button>
          <button
            className="logout-btn"
            onClick={handleLogout}
            title="Logout"
          >
            <FiLogOut size={24} />
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;