import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import toast from 'react-hot-toast';
import axios from 'axios';
import { FiSearch, FiPlus, FiArrowLeft, FiMessageCircle, FiTrash2, FiUser } from 'react-icons/fi';
import '../styles/ContactsPage.css';

function ContactsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { getOrCreateChat, fetchMessages } = useChatStore();
  const [contacts, setContacts] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('contacts');
  const [sortBy, setSortBy] = useState('name'); // name, recent, status

  useEffect(() => {
    loadContacts();
    loadAllUsers();
  }, []);

  const loadContacts = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`/api/users/profile/${user.id}`);
      setContacts(response.data.contacts || []);
    } catch (error) {
      toast.error('Failed to load contacts');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const response = await axios.get('/api/users/all/list');
      setAllUsers(response.data || []);
    } catch (error) {
      toast.error('Failed to load users');
      console.error('Error:', error);
    }
  };

  const handleAddContact = async (contactId) => {
    try {
      await axios.post('/api/users/contacts/add', { contactId });
      toast.success('Contact added!');
      loadContacts();
    } catch (error) {
      toast.error('Failed to add contact');
    }
  };

  const handleRemoveContact = async (contactId) => {
    if (window.confirm('Remove this contact?')) {
      try {
        await axios.post('/api/users/contacts/remove', { contactId });
        toast.success('Contact removed');
        loadContacts();
      } catch (error) {
        toast.error('Failed to remove contact');
      }
    }
  };

  const handleMessageContact = async (contactId) => {
    try {
      setIsLoading(true);
      const chat = await getOrCreateChat(contactId);
      await fetchMessages(chat._id);
      navigate(`/chat/${chat._id}`);
      toast.success('Chat opened!');
    } catch (error) {
      toast.error('Failed to open chat');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchContacts = async (query) => {
    setSearchQuery(query);
    if (query.trim()) {
      try {
        const response = await axios.get(`/api/users/search/${query}`);
        setAllUsers(response.data);
      } catch (error) {
        toast.error('Failed to search');
      }
    } else {
      loadAllUsers();
    }
  };

  // Filter and sort contacts
  const filteredContacts = contacts.filter(contact => 
    contact.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.bio?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    if (sortBy === 'name') {
      return a.username.localeCompare(b.username);
    } else if (sortBy === 'status') {
      return a.status === 'online' ? -1 : 1;
    }
    return 0;
  });

  // Filter available users (not in contacts)
  const availableUsers = allUsers
    .filter(u => !contacts.find(c => c._id === u._id))
    .filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="contacts-page">
      {/* Header */}
      <div className="contacts-header">
        <div className="contacts-header-top">
          <button className="contacts-back-btn" onClick={() => navigate('/chats')}>
            <FiArrowLeft size={24} />
          </button>
          <div className="contacts-title-section">
            <h1>Contacts</h1>
            <p className="contacts-subtitle">{contacts.length} friends</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="search-contacts">
          <FiSearch size={20} />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => handleSearchContacts(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="contacts-tabs">
        <button 
          className={`tab ${activeTab === 'contacts' ? 'active' : ''}`}
          onClick={() => setActiveTab('contacts')}
        >
          <FiUser size={18} />
          <span>My Contacts</span>
          <span className="tab-badge">{contacts.length}</span>
        </button>
        <button 
          className={`tab ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          <FiPlus size={18} />
          <span>Add Friends</span>
          <span className="tab-badge">{availableUsers.length}</span>
        </button>
      </div>

      {/* Content */}
      <div className="contacts-content">
        {isLoading && activeTab === 'contacts' ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading contacts...</p>
          </div>
        ) : activeTab === 'contacts' ? (
          sortedContacts.length > 0 ? (
            <>
              {/* Sort Options */}
              <div className="sort-controls">
                <button 
                  className={`sort-btn ${sortBy === 'name' ? 'active' : ''}`}
                  onClick={() => setSortBy('name')}
                >
                  A-Z
                </button>
                <button 
                  className={`sort-btn ${sortBy === 'status' ? 'active' : ''}`}
                  onClick={() => setSortBy('status')}
                >
                  Online
                </button>
              </div>

              {/* Contacts Grid */}
              <div className="contacts-grid">
                {sortedContacts.map(contact => (
                  <div key={contact._id} className="contact-card">
                    {/* Card Header with Avatar */}
                    <div className="contact-card-header">
                      <div className="contact-avatar-wrapper">
                        <img 
                          src={contact.profilePicture || '/default-avatar.png'} 
                          alt={contact.username}
                          className="contact-avatar"
                        />
                        <span className={`status-dot ${contact.status}`}></span>
                      </div>
                      <div className="contact-status-badge">
                        {contact.status === 'online' ? '🟢 Online' : '🔴 Offline'}
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="contact-info">
                      <h3>{contact.username}</h3>
                      <p className="contact-bio">{contact.bio || 'No bio'}</p>
                      
                      {/* Contact Details */}
                      <div className="contact-details">
                        {contact.location && (
                          <span className="detail-item">📍 {contact.location}</span>
                        )}
                        {contact.phone && (
                          <span className="detail-item">📱 {contact.phone}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="contact-actions">
                      <button 
                        className="action-btn message-btn"
                        onClick={() => handleMessageContact(contact._id)}
                        disabled={isLoading}
                        title="Send Message"
                      >
                        <FiMessageCircle size={18} />
                        <span>Message</span>
                      </button>
                      <button 
                        className="action-btn remove-btn"
                        onClick={() => handleRemoveContact(contact._id)}
                        disabled={isLoading}
                        title="Remove Contact"
                      >
                        <FiTrash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <h3>No contacts yet</h3>
              <p>Add friends from the "Add Friends" tab</p>
            </div>
          )
        ) : (
          <>
            {/* Add Friends Tab */}
            {availableUsers.length > 0 ? (
              <div className="users-grid">
                {availableUsers.map(userItem => (
                  <div key={userItem._id} className="user-card">
                    {/* Card Header */}
                    <div className="user-card-header">
                      <img 
                        src={userItem.profilePicture || '/default-avatar.png'} 
                        alt={userItem.username}
                        className="user-avatar"
                      />
                      <span className={`status-dot ${userItem.status}`}></span>
                    </div>

                    {/* User Info */}
                    <div className="user-info">
                      <h3>{userItem.username}</h3>
                      <p className="user-bio">{userItem.bio || 'No bio'}</p>
                      <span className={`status-label ${userItem.status}`}>
                        {userItem.status === 'online' ? '🟢 Online' : '🔴 Offline'}
                      </span>
                    </div>

                    {/* Add Button */}
                    <button 
                      className="add-friend-btn"
                      onClick={() => handleAddContact(userItem._id)}
                      disabled={isLoading}
                    >
                      <FiPlus size={20} />
                      <span>Add Friend</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <h3>No users found</h3>
                <p>All available users are already in your contacts!</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ContactsPage;