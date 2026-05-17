import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiPlus, FiUsers, FiX, FiCamera, FiArrowLeft } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import '../styles/ChatList.css';

function ChatList({ chats, selectedChat, onSelectChat }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Zustand auth and group actions
  const { user } = useAuthStore();
  const { createGroup } = useChatStore();

  // Wizard state variables
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [contactsSearch, setContactsSearch] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [groupImage, setGroupImage] = useState('');
  const [groupDescription, setGroupDescription] = useState('');

  const filteredChats = chats.filter(chat => {
    const participant = chat.participants.find(p => p._id !== user?.id);
    const name = chat.isGroupChat ? chat.groupName : (participant?.username || 'Unknown');
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleNewChat = () => {
    navigate('/contacts');
  };

  const loadContacts = async () => {
    try {
      const userId = user?.id;
      if (!userId) return;
      const response = await axios.get(`/api/users/profile/${userId}`);
      setContacts(response.data.contacts || []);
    } catch (error) {
      console.error('Failed to load contacts', error);
      toast.error('Failed to load contacts');
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    loadContacts();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setStep(1);
    setContactsSearch('');
    setSelectedContacts([]);
    setGroupName('');
    setGroupImage('');
    setGroupDescription('');
  };

  const toggleSelectContact = (contact) => {
    setSelectedContacts(prev => {
      const exists = prev.some(c => c._id === contact._id);
      if (exists) {
        return prev.filter(c => c._id !== contact._id);
      } else {
        return [...prev, contact];
      }
    });
  };

  const handleGroupImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setGroupImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    setIsCreating(true);
    try {
      const participantIds = selectedContacts.map(c => c._id);
      const newGroup = await createGroup({
        groupName,
        participantIds,
        groupImage,
        groupDescription
      });
      toast.success('Group created successfully!');
      closeModal();
      onSelectChat(newGroup);
    } catch (error) {
      console.error(error);
      toast.error('Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.username.toLowerCase().includes(contactsSearch.toLowerCase())
  );

  return (
    <div className="chat-list">
      <div className="chat-list-header">
        <h2>Messages</h2>
        <div className="chat-list-actions">
          <button className="new-group-btn" onClick={handleOpenModal} title="New Group Chat">
            <FiUsers size={20} />
          </button>
          <button className="new-chat-btn" onClick={handleNewChat} title="New Chat">
            <FiPlus size={24} />
          </button>
        </div>
      </div>

      <div className="chat-search">
        <FiSearch className="search-icon" size={20} />
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="chat-items">
        {filteredChats.length > 0 ? (
          filteredChats.map(chat => {
            const participant = chat.participants.find(p => p._id !== user?.id);
            const chatName = chat.isGroupChat ? chat.groupName : (participant?.username || 'Unknown User');
            const chatImage = chat.isGroupChat ? (chat.groupImage || '/default-avatar.png') : (participant?.profilePicture || '/default-avatar.png');
            const lastMessage = chat.lastMessage?.content || 'No messages yet';
            const unreadCount = chat.unreadCount || 0;

            return (
              <div
                key={chat._id}
                className={`chat-item ${selectedChat?._id === chat._id ? 'active' : ''}`}
                onClick={() => onSelectChat(chat)}
              >
                <img src={chatImage} alt={chatName} className="chat-avatar" />
                <div className="chat-info">
                  <h3>{chatName}</h3>
                  <p className="chat-preview">{lastMessage}</p>
                </div>
                <div className="chat-right">
                  {chat.lastMessageTime && (
                    <span className="chat-time">
                      {formatDistanceToNow(new Date(chat.lastMessageTime), { addSuffix: false })}
                    </span>
                  )}
                  {unreadCount > 0 && (
                    <div className="unread-badge">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="no-chats">
            <p>No conversations yet</p>
            <button onClick={handleNewChat}>Start a new chat</button>
          </div>
        )}
      </div>

      {/* --- Group Wizard Modal --- */}
      {isModalOpen && createPortal(
        <div className="wizard-overlay">
          <div className="wizard-modal">
            <div className="wizard-header">
              {step === 2 && (
                <button className="wizard-back-btn" onClick={() => setStep(1)}>
                  <FiArrowLeft size={20} />
                </button>
              )}
              <h3>{step === 1 ? 'New Group: Members' : 'New Group: Details'}</h3>
              <button className="wizard-close-btn" onClick={closeModal}>
                <FiX size={20} />
              </button>
            </div>

            {step === 1 ? (
              <div className="wizard-step-1">
                <div className="wizard-search">
                  <FiSearch className="wizard-search-icon" size={18} />
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={contactsSearch}
                    onChange={(e) => setContactsSearch(e.target.value)}
                  />
                </div>

                {/* Selected contacts strip */}
                {selectedContacts.length > 0 && (
                  <div className="selected-contacts-strip">
                    {selectedContacts.map(contact => (
                      <div key={contact._id} className="selected-contact-bubble">
                        <img src={contact.profilePicture || '/default-avatar.png'} alt={contact.username} />
                        <span>{contact.username}</span>
                        <button onClick={() => toggleSelectContact(contact)}>
                          <FiX size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Contacts list selection */}
                <div className="wizard-contacts-list">
                  {filteredContacts.length > 0 ? (
                    filteredContacts.map(contact => {
                      const isSelected = selectedContacts.some(c => c._id === contact._id);
                      return (
                        <div
                          key={contact._id}
                          className={`wizard-contact-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleSelectContact(contact)}
                        >
                          <img src={contact.profilePicture || '/default-avatar.png'} alt={contact.username} />
                          <div className="wizard-contact-info">
                            <h4>{contact.username}</h4>
                            <p>{contact.status === 'online' ? '🟢 Online' : '🔴 Offline'}</p>
                          </div>
                          <div className={`wizard-checkbox ${isSelected ? 'checked' : ''}`}>
                            {isSelected && '✓'}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="no-contacts-found">
                      <p>No contacts found</p>
                    </div>
                  )}
                </div>

                <div className="wizard-footer">
                  <span className="selected-count">{selectedContacts.length} selected</span>
                  <button
                    className="wizard-next-btn"
                    disabled={selectedContacts.length === 0}
                    onClick={() => setStep(2)}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : (
              <div className="wizard-step-2">
                <div className="wizard-avatar-upload">
                  <label className="wizard-avatar-label">
                    <img
                      src={groupImage || '/default-avatar.png'}
                      alt="Group Avatar"
                      className="wizard-avatar-preview"
                    />
                    <div className="wizard-avatar-overlay">
                      <FiCamera size={20} />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleGroupImageChange}
                      hidden
                    />
                  </label>
                  <p>Upload Group DP</p>
                </div>

                <div className="wizard-form-group">
                  <label>Group Name *</label>
                  <input
                    type="text"
                    placeholder="Enter group name..."
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    maxLength="40"
                  />
                </div>

                <div className="wizard-form-group">
                  <label>Group Description</label>
                  <textarea
                    placeholder="What's this group about? (optional)..."
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    maxLength="150"
                    rows="3"
                  />
                </div>

                <div className="wizard-footer">
                  <button
                    className="wizard-create-btn"
                    disabled={!groupName.trim() || isCreating}
                    onClick={handleCreateGroup}
                  >
                    {isCreating ? 'Creating...' : 'Create Group'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default ChatList;