import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useSocketStore } from '../store/socketStore';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import toast from 'react-hot-toast';
import axios from 'axios';
import { FiPhone, FiVideo, FiMoreVertical, FiArrowLeft, FiX, FiSearch } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import '../styles/ChatWindow.css';

function ChatWindow({ chat }) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { messages, addMessage, fetchMessages, removeMessage, deleteChat, leaveGroup, updateChats, setCurrentChat } = useChatStore();
  const { socket } = useSocketStore();
  const [isTyping, setIsTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showBgMenu, setShowBgMenu] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [chatBg, setChatBg] = useState(() => {
    const saved = localStorage.getItem(`chatBg_${chat._id}`);
    return saved || '#f5f7fa';
  });
  const [otherUser, setOtherUser] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);
  const [extractedEvents, setExtractedEvents] = useState([]);

  const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b'];

  useEffect(() => {
    if (chat && !chat.isGroupChat) {
      const other = chat.participants.find(p => p._id !== user.id);
      setOtherUser(other);
    }
  }, [chat, user.id]);

  useEffect(() => {
    // Load background from localStorage
    const saved = localStorage.getItem(`chatBg_${chat._id}`);
    if (saved) {
      setChatBg(saved);
    }
  }, [chat._id]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await axios.get(`/api/messages/${chat._id}/events`);
        setExtractedEvents(response.data);
      } catch (error) {
        console.error('Error fetching chat events:', error);
      }
    };
    if (chat?._id) {
      fetchEvents();
    }
  }, [chat._id]);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (data) => {
      if (data.chatId === chat._id) {
        addMessage(data);
      }
    };

    const handleIncomingCall = ({ callerId, callerName, callType }) => {
      const message = `Incoming ${callType} call from ${callerName}`;
      if (callType === 'audio') {
        toast.loading(`${callerName} is calling you...`, { duration: 30000 });
      } else {
        toast.loading(`${callerName} is calling you (video)...`, { duration: 30000 });
      }
      addCallMessage(callerName, 'incoming', callType);
    };

    const handleCallRejected = ({ rejectedBy }) => {
      toast.error(`${rejectedBy} rejected your call`);
      addCallMessage(rejectedBy, 'missed', 'audio');
    };

    const handleCallEnded = ({ endedBy }) => {
      toast.info(`Call ended by ${endedBy}`);
    };

    const handleUserTyping = ({ userId }) => {
      if (userId !== user.id) {
        setIsTyping(true);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
        }, 3000);
      }
    };

    const handleStopTyping = ({ userId }) => {
      if (userId !== user.id) {
        setIsTyping(false);
      }
    };

    const handleMessageDeleted = ({ messageId }) => {
      removeMessage(messageId);
      console.log('Message deleted:', messageId);
    };

    const handleUnreadNotification = ({ senderId, senderName, message }) => {
      // This is handled in ChatList, just log it here
      console.log('Unread notification:', message);
    };

    socket.on('receive-message', handleReceiveMessage);
    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-rejected', handleCallRejected);
    socket.on('call-ended', handleCallEnded);
    socket.on('user-typing', handleUserTyping);
    socket.on('stop-typing', handleStopTyping);
    socket.on('message-deleted', handleMessageDeleted);
    socket.on('unread-notification', handleUnreadNotification);
    socket.on('new-event', (event) => {
      if (event.chatId === chat._id) {
        setExtractedEvents(prev => [...prev, event]);
        toast(`📅 New Event: ${event.title} on ${event.date} at ${event.time}`, { duration: 8000, icon: '🗓️' });
      }
    });

    return () => {
      socket.off('receive-message', handleReceiveMessage);
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-rejected', handleCallRejected);
      socket.off('call-ended', handleCallEnded);
      socket.off('user-typing', handleUserTyping);
      socket.off('stop-typing', handleStopTyping);
      socket.off('message-deleted', handleMessageDeleted);
      socket.off('unread-notification', handleUnreadNotification);
      socket.off('new-event');
    };
  }, [socket, chat._id, user.id, addMessage, removeMessage]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
        setShowBgMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const addCallMessage = (userName, type, callType) => {
    let content = '';
    
    if (type === 'incoming') {
      content = `📞 Incoming ${callType} call`;
    } else if (type === 'outgoing') {
      content = `📞 Outgoing ${callType} call`;
    } else if (type === 'missed') {
      content = `📞 Missed ${callType} call`;
    }

    const message = {
      _id: Date.now().toString(),
      chatId: chat._id,
      senderId: { _id: otherUser?._id, username: userName, profilePicture: otherUser?.profilePicture },
      content: content,
      messageType: 'call',
      callType: callType,
      createdAt: new Date()
    };
    addMessage(message);
  };

  const handleAudioCall = () => {
    if (!otherUser) {
      toast.error('User not found');
      return;
    }

    setIsCalling(true);
    const loadingToast = toast.loading('Calling...', { duration: 60000 });
    
    if (socket) {
      socket.emit('initiate-call', {
        receiverId: otherUser._id,
        callType: 'audio',
        callerName: user.username
      });
    }

    addCallMessage(user.username, 'outgoing', 'audio');
    
    setTimeout(() => {
      setIsCalling(false);
      toast.dismiss(loadingToast);
      toast.error('Call timeout - No response from recipient');
      addCallMessage(user.username, 'missed', 'audio');
    }, 30000);
  };

  const handleVideoCall = () => {
    if (!otherUser) {
      toast.error('User not found');
      return;
    }

    setIsCalling(true);
    const loadingToast = toast.loading('Video calling...', { duration: 60000 });
    
    if (socket) {
      socket.emit('initiate-call', {
        receiverId: otherUser._id,
        callType: 'video',
        callerName: user.username
      });
    }

    addCallMessage(user.username, 'outgoing', 'video');
    
    setTimeout(() => {
      setIsCalling(false);
      toast.dismiss(loadingToast);
      toast.error('Video call timeout - No response from recipient');
      addCallMessage(user.username, 'missed', 'video');
    }, 30000);
  };

  const handleDeleteGroup = async () => {
    if (window.confirm('Are you sure you want to delete this group? This will delete all messages and remove the group for everyone.')) {
      try {
        await deleteChat(chat._id);
        toast.success('Group deleted successfully');
        navigate('/chats');
      } catch (error) {
        toast.error('Failed to delete group');
        console.error('Error deleting group:', error);
      }
    }
    setShowMenu(false);
    setShowBgMenu(false);
  };

  const handleLeaveGroup = async () => {
    const confirmMsg = chat.admin === user.id
      ? 'You are the Admin of this group. Leaving will assign a new Admin and remove you. Are you sure you want to leave?'
      : 'Are you sure you want to leave this group?';
      
    if (window.confirm(confirmMsg)) {
      try {
        await leaveGroup(chat._id);
        toast.success('You left the group successfully');
        navigate('/chats');
      } catch (error) {
        toast.error('Failed to leave group');
        console.error('Error leaving group:', error);
      }
    }
    setShowMenu(false);
    setShowBgMenu(false);
  };

  const handleRemoveParticipant = async (participantId, username) => {
    if (window.confirm(`Are you sure you want to remove ${username} from the group?`)) {
      try {
        const res = await axios.post(`/api/chats/${chat._id}/remove-participant`, {
          participantId
        });
        updateChats(res.data);
        setCurrentChat(res.data);
        toast.success(`${username} removed successfully`);
      } catch (error) {
        toast.error('Failed to remove member');
        console.error('Error removing member:', error);
      }
    }
  };

  const handleDismissEvent = async (eventId, idx) => {
    try {
      if (eventId) {
        await axios.delete(`/api/messages/events/${eventId}`);
      }
      setExtractedEvents(prev => prev.filter((_, i) => i !== idx));
      toast.success('Event dismissed');
    } catch (error) {
      console.error('Error dismissing event:', error);
      toast.error('Failed to dismiss event');
    }
  };

  const handleClearChat = async () => {
    if (window.confirm('Are you sure you want to clear all messages in this chat? This cannot be undone.')) {
      try {
        await axios.delete(`/api/chats/${chat._id}/messages`);
        // Reload messages
        await fetchMessages(chat._id);
        toast.success('Chat cleared successfully');
      } catch (error) {
        toast.error('Failed to clear chat');
        console.error('Error:', error);
      }
    }
    setShowMenu(false);
    setShowBgMenu(false);
  };

  const handleViewProfile = () => {
    if (otherUser) {
      navigate(`/profile/${otherUser._id}`);
      setShowMenu(false);
      setShowBgMenu(false);
    }
  };

  const handleColorChange = (color) => {
    setChatBg(color);
    localStorage.setItem(`chatBg_${chat._id}`, color);
    setShowBgMenu(false);
    setShowMenu(false);
    toast.success('Background color changed');
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const bgUrl = `url(${event.target.result})`;
        setChatBg(bgUrl);
        localStorage.setItem(`chatBg_${chat._id}`, bgUrl);
        setShowBgMenu(false);
        setShowMenu(false);
        toast.success('Background image changed');
      };
      reader.readAsDataURL(file);
    }
  };

  const getBackgroundStyle = () => {
    if (chatBg.startsWith('url')) {
      return {
        background: chatBg,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      };
    }
    return {
      background: chatBg,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    };
  };

  return (
    <div className="chat-window" style={getBackgroundStyle()}>
      {/* Header */}
      <div className="chat-header">
        <button className="back-btn" onClick={() => navigate('/chats')}>
          <FiArrowLeft size={24} />
        </button>
        
        <div className="header-info">
          {chat.isGroupChat ? (
            <>
              <div className="header-avatar-wrapper" onClick={() => setShowGroupModal(true)} style={{ cursor: 'pointer' }}>
                <img 
                  src={chat.groupImage || '/default-avatar.png'} 
                  alt={chat.groupName}
                  className="header-user-avatar"
                />
              </div>
              <div className="header-user-info" onClick={() => setShowGroupModal(true)} style={{ cursor: 'pointer' }}>
                <h3>{chat.groupName}</h3>
                <p className="user-status">
                  {chat.participants?.length || 0} members
                </p>
              </div>
            </>
          ) : otherUser && (
            <>
              <div className="header-avatar-wrapper" onClick={handleViewProfile} style={{ cursor: 'pointer' }}>
                <img 
                  src={otherUser.profilePicture || '/default-avatar.png'} 
                  alt={otherUser.username}
                  className="header-user-avatar"
                />
                <span className={`status-indicator ${otherUser.status}`}></span>
              </div>
              <div className="header-user-info" onClick={handleViewProfile} style={{ cursor: 'pointer' }}>
                <h3>{otherUser.username}</h3>
                <p className="user-status">
                  {otherUser.status === 'online' ? '🟢 Online' : '🔴 Offline'}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="header-actions">
          <button 
            className="call-btn audio-call"
            onClick={handleAudioCall}
            disabled={isCalling}
            title="Audio Call"
          >
            <FiPhone size={20} />
          </button>
          
          <button 
            className="call-btn video-call"
            onClick={handleVideoCall}
            disabled={isCalling}
            title="Video Call"
          >
            <FiVideo size={20} />
          </button>
          
          <div className="menu-container" ref={menuRef}>
            <button 
              className="menu-btn"
              onClick={() => {
                setShowMenu(!showMenu);
                setShowBgMenu(false);
              }}
              title="More Options"
            >
              <FiMoreVertical size={20} />
            </button>

            {showMenu && (
              <div className="dropdown-menu">
                {chat.isGroupChat ? (
                  <>
                    <button onClick={() => { setShowGroupModal(true); setShowMenu(false); }} className="menu-option">
                      <span>👥</span>
                      <span>View Group Profile</span>
                    </button>
                    <button onClick={handleLeaveGroup} className="menu-option danger">
                      <span>🚪</span>
                      <span>Leave Group</span>
                    </button>
                    {chat.admin === user.id && (
                      <>
                        <button onClick={() => { setShowAddMembersModal(true); setShowMenu(false); }} className="menu-option">
                          <span>➕</span>
                          <span>Add Friends</span>
                        </button>
                        <button onClick={handleDeleteGroup} className="menu-option danger">
                          <span>🗑️</span>
                          <span>Delete Group</span>
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <button onClick={handleViewProfile} className="menu-option">
                    <span>👤</span>
                    <span>View Profile</span>
                  </button>
                )}

                <button onClick={handleClearChat} className="menu-option danger">
                  <span>🗑️</span>
                  <span>Clear Chat</span>
                </button>
                
                <div className="menu-divider"></div>

                <div className="menu-submenu">
                  <button 
                    onClick={() => setShowBgMenu(!showBgMenu)}
                    className="menu-option"
                  >
                    <span>🎨</span>
                    <span>Change Background</span>
                    <span className="menu-arrow">›</span>
                  </button>

                  {showBgMenu && (
                    <div className="bg-submenu">
                      <div className="submenu-section">
                        <p className="submenu-title">Colors</p>
                        <div className="color-options">
                          {colors.map((color, idx) => (
                            <button
                              key={idx}
                              className="color-option"
                              style={{ backgroundColor: color }}
                              onClick={() => handleColorChange(color)}
                              title={color}
                            >
                              {chatBg === color && <span className="checkmark">✓</span>}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="submenu-divider"></div>

                      <div className="submenu-section">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleImageUpload}
                          accept="image/*"
                          hidden
                        />
                        <button
                          className="menu-option photo-option"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <span>📸</span>
                          <span>Add Photo</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI-Extracted Event Cards */}
      {extractedEvents.length > 0 && (
        <div className="event-cards-strip">
          {extractedEvents.map((ev, idx) => (
            <div key={idx} className="event-card">
              <span className="event-card-icon">🗓️</span>
              <div className="event-card-body">
                <p className="event-card-title">{ev.title}</p>
                <p className="event-card-details">{ev.date} · {ev.time} {ev.location ? `· 📍 ${ev.location}` : ''}</p>
              </div>
              <button className="event-card-dismiss" onClick={() => handleDismissEvent(ev._id, idx)} title="Dismiss">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <MessageList 
        messages={messages} 
        currentUserId={user.id}
        otherUser={otherUser}
        onReply={setReplyingTo}
      />

      {/* Typing Indicator */}
      {isTyping && (
        <div className="typing-indicator">
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
          <span>Typing...</span>
        </div>
      )}

      {/* Input Area */}
      <MessageInput 
        chat={chat}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />

      {/* Group Profile Modal */}
      {showGroupModal && createPortal(
        <div className="group-modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="group-modal" onClick={(e) => e.stopPropagation()}>
            <div className="group-modal-header">
              <h3>Group Profile</h3>
              <button className="group-modal-close" onClick={() => setShowGroupModal(false)}>
                <FiX size={20} />
              </button>
            </div>
            
            <div className="group-modal-body">
              <div className="group-modal-avatar-section">
                <img 
                  src={chat.groupImage || '/default-avatar.png'} 
                  alt={chat.groupName} 
                  className="group-modal-avatar"
                />
                <h2>{chat.groupName}</h2>
                <p className="group-modal-desc">
                  {chat.groupDescription || 'No description provided.'}
                </p>
              </div>
              
              <div className="group-modal-members-section">
                <h4>Members ({chat.participants?.length || 0})</h4>
                <div className="group-modal-members-list">
                  {chat.participants?.map(member => {
                    const isMemberAdmin = chat.admin === member._id;
                    const isCurrentUser = user.id === member._id;
                    return (
                      <div key={member._id} className="group-member-item">
                        <div className="member-avatar-wrapper">
                          <img 
                            src={member.profilePicture || '/default-avatar.png'} 
                            alt={member.username} 
                            className="member-avatar"
                          />
                          <span className={`status-indicator ${member.status}`}></span>
                        </div>
                        <div className="member-details">
                          <span className="member-name">
                            {member.username} {isCurrentUser && ' (You)'}
                          </span>
                          <span className="member-status-text">
                            {member.status === 'online' ? '🟢 Online' : '🔴 Offline'}
                          </span>
                        </div>
                        {isMemberAdmin ? (
                          <span className="admin-badge">👑 Admin</span>
                        ) : (
                          chat.admin === user.id && (
                            <button 
                              className="member-remove-btn" 
                              onClick={() => handleRemoveParticipant(member._id, member.username)}
                              title={`Remove ${member.username}`}
                            >
                              ✕
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Add Friends Modal */}
      {showAddMembersModal && createPortal(
        <AddMembersModal 
          chat={chat} 
          onClose={() => setShowAddMembersModal(false)} 
          user={user} 
          updateChats={updateChats} 
          setCurrentChat={setCurrentChat} 
        />,
        document.body
      )}
    </div>
  );
}

// Add members helper component
function AddMembersModal({ chat, onClose, user, updateChats, setCurrentChat }) {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const res = await axios.get(`/api/users/profile/${user.id}`);
        setContacts(res.data.contacts || []);
      } catch (err) {
        toast.error('Failed to load contacts');
      }
    };
    fetchContacts();
  }, [user.id]);

  // Filter out contacts who are already participants
  const addableContacts = contacts.filter(
    contact => !chat.participants.some(p => p._id === contact._id)
  );

  // Search filter
  const filteredContacts = addableContacts.filter(contact =>
    contact.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleAddSubmit = async () => {
    if (selectedIds.length === 0) {
      toast.error('Please select at least one contact');
      return;
    }
    setIsLoading(true);
    try {
      const res = await axios.post(`/api/chats/${chat._id}/add-participants`, {
        participantIds: selectedIds
      });
      updateChats(res.data);
      setCurrentChat(res.data);
      toast.success('Members added successfully!');
      onClose();
    } catch (err) {
      toast.error('Failed to add members');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="group-modal-overlay" onClick={onClose}>
      <div className="group-modal add-members-modal" onClick={(e) => e.stopPropagation()}>
        <div className="group-modal-header">
          <h3>Add Friends to Group</h3>
          <button className="group-modal-close" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <div className="group-modal-body">
          <div className="add-members-search">
            <FiSearch size={18} />
            <input
              type="text"
              placeholder="Search friends..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="add-members-list-section">
            <h4>Select Friends ({selectedIds.length} selected)</h4>
            <div className="add-members-list">
              {filteredContacts.length > 0 ? (
                filteredContacts.map(contact => {
                  const isChecked = selectedIds.includes(contact._id);
                  return (
                    <div 
                      key={contact._id} 
                      className={`add-member-item ${isChecked ? 'selected' : ''}`}
                      onClick={() => handleToggleSelect(contact._id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="member-avatar-wrapper">
                        <img 
                          src={contact.profilePicture || '/default-avatar.png'} 
                          alt={contact.username} 
                          className="member-avatar"
                        />
                        <span className={`status-indicator ${contact.status}`}></span>
                      </div>
                      <div className="member-details">
                        <span className="member-name">{contact.username}</span>
                        <span className="member-status-text">
                          {contact.status === 'online' ? '🟢 Online' : '🔴 Offline'}
                        </span>
                      </div>
                      <div className="member-checkbox">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="no-addable-friends">
                  <p>No new friends to add</p>
                </div>
              )}
            </div>
          </div>

          <button 
            className="add-members-submit-btn" 
            onClick={handleAddSubmit}
            disabled={isLoading || selectedIds.length === 0}
          >
            {isLoading ? 'Adding...' : `Add to Group (${selectedIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatWindow;