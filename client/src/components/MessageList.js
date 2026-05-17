import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { formatTime } from '../utils/dateUtils';
import { FiTrash2, FiX, FiCornerUpLeft, FiSmile } from 'react-icons/fi';
import axios from 'axios';
import toast from 'react-hot-toast';
import '../styles/MessageList.css';

function MessageList({ messages, currentUserId, otherUser, onReply, onMessageDeleted }) {
  const endOfMessagesRef = useRef(null);
  const { user } = useAuthStore();
  const { messages: storeMessages, addMessage } = useChatStore();
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [reactionMenuId, setReactionMenuId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [displayMessages, setDisplayMessages] = useState(messages);
  const [summaries, setSummaries] = useState({});  // messageId -> summary text
  const [summarizingId, setSummarizingId] = useState(null);

  useEffect(() => {
    // Filter out deleted messages
    const activeMessages = messages.filter(msg => !msg.isDeleted);
    setDisplayMessages(activeMessages);
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleDeleteMessage = async (messageId) => {
    try {
      const response = await axios.delete(`/api/messages/${messageId}`);
      
      if (response.status === 200) {
        // Remove message from local state
        setDisplayMessages(prevMessages => 
          prevMessages.filter(msg => msg._id !== messageId)
        );
        toast.success('Message deleted successfully');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete message');
    }
  };

  const handleImageClick = (imageUrl) => {
    setSelectedImage(imageUrl);
  };

  const handleReact = async (messageId, emoji) => {
    try {
      setReactionMenuId(null);
      await axios.post(`/api/messages/${messageId}/react`, { emoji });
      // The socket will update this eventually, or we could handle it optimistically
    } catch (error) {
      toast.error('Failed to add reaction');
    }
  };

  const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  const handleSummarizeVoice = async (message) => {
    if (summarizingId) return;
    setSummarizingId(message._id);
    try {
      // We use browser's SpeechRecognition to transcribe is not feasible server-side without Whisper.
      // Instead, we'll call our AI endpoint with metadata and use Gemini to generate a mock summary.
      // In a real app this would use Whisper API.
      const res = await axios.post('/api/messages/ai/summarize', {
        messages: [{ senderName: message.senderId?.username || 'User', content: `[Voice message, ${message.duration}s long]` }]
      });
      setSummaries(prev => ({ ...prev, [message._id]: res.data.summary }));
    } catch (e) {
      toast.error('Could not summarize voice note.');
    } finally {
      setSummarizingId(null);
    }
  };

  // Helper to group reactions
  const groupReactions = (reactions) => {
    if (!reactions) return [];
    const grouped = {};
    reactions.forEach(r => {
      const e = r.emoji;
      if (!grouped[e]) grouped[e] = { count: 0, hasReacted: false };
      grouped[e].count++;
      if (r.user?._id === currentUserId) grouped[e].hasReacted = true;
    });
    return Object.entries(grouped).map(([emoji, data]) => ({ emoji, ...data }));
  };

  const renderReadReceipt = (message) => {
    if (message.senderId._id !== currentUserId) return null;
    
    if (message.isRead || (message.readBy && message.readBy.length > 0)) {
      return <span className="read-receipt read">✓✓</span>;
    }
    // Delivered status logic ideally checks if user is online, here we default to sent
    return <span className="read-receipt sent">✓</span>;
  };

  return (
    <>
      <div className="messages-container">
        {displayMessages.length === 0 ? (
          <div className="no-messages">
            <div className="no-messages-content">
              <span className="no-messages-icon">💬</span>
              <p>No messages yet. Start a conversation!</p>
            </div>
          </div>
        ) : (
          displayMessages.map((message) => (
            <div
              key={message._id}
              className={`message ${message.senderId._id === currentUserId ? 'sent' : 'received'} ${message.replyTo ? 'has-reply' : ''}`}
              onMouseEnter={() => setHoveredMessageId(message._id)}
              onMouseLeave={() => {
                setHoveredMessageId(null);
                setReactionMenuId(null);
              }}
            >
              {message.senderId._id !== currentUserId && (
                <img 
                  src={message.senderId.profilePicture || '/default-avatar.png'} 
                  alt={message.senderId.username}
                  className="message-avatar"
                />
              )}

              <div className="message-content-wrapper">
                {message.replyTo && (
                  <div className="quoted-reply">
                    <div className="quoted-user">{message.replyTo.senderId?.username || 'User'}</div>
                    <div className="quoted-text">
                      {message.replyTo.messageType === 'text' 
                        ? message.replyTo.content 
                        : `📷 ${message.replyTo.messageType}`}
                    </div>
                  </div>
                )}
                {message.messageType === 'call' ? (
                  <div className="call-message">
                    <span className="call-icon">📞</span>
                    <p>{message.content}</p>
                  </div>
                ) : message.messageType === 'text' ? (
                  <div className="message-content text-message">
                    <p>{message.content}</p>
                    <span className="message-time">
                      {formatTime(message.createdAt)}
                      {renderReadReceipt(message)}
                    </span>
                  </div>
                ) : message.messageType === 'image' ? (
                  <div className="message-content image-message">
                    <img 
                      src={message.mediaUrl} 
                      alt="Message" 
                      onClick={() => handleImageClick(message.mediaUrl)}
                    />
                    <span className="message-time">
                      {formatTime(message.createdAt)}
                      {renderReadReceipt(message)}
                    </span>
                  </div>
                ) : message.messageType === 'voice' ? (
                  <div className="message-content voice-message">
                    <audio controls className="modern-audio-player">
                      <source src={message.mediaUrl} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                    <div className="voice-meta">
                      <span className="duration">{message.duration}s</span>
                      <button
                        className="ai-summarize-btn"
                        onClick={() => handleSummarizeVoice(message)}
                        disabled={summarizingId === message._id}
                        title="Summarize with AI"
                      >
                        {summarizingId === message._id ? '⏳' : '🤖'} {summarizingId === message._id ? 'Analyzing...' : 'AI Summary'}
                      </button>
                      <span className="message-time">
                        {formatTime(message.createdAt)}
                         {renderReadReceipt(message)}
                      </span>
                    </div>
                    {summaries[message._id] && (
                      <div className="voice-summary">
                        <span className="voice-summary-label">🤖 Kane says:</span>
                        <p>{summaries[message._id]}</p>
                      </div>
                    )}
                  </div>
                ) : null}
                
                {message.reactions && message.reactions.length > 0 && (
                  <div className="message-reactions">
                    {groupReactions(message.reactions).map((r, i) => (
                      <span key={i} className={`reaction-pill ${r.hasReacted ? 'active' : ''}`} onClick={() => handleReact(message._id, r.emoji)}>
                        {r.emoji} <small>{r.count}</small>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {hoveredMessageId === message._id && (
                <div className="message-actions-menu">
                  {reactionMenuId === message._id ? (
                    <div className="reaction-picker">
                      {QUICK_EMOJIS.map(em => (
                        <span key={em} onClick={() => handleReact(message._id, em)}>{em}</span>
                      ))}
                    </div>
                  ) : (
                    <>
                      <button className="action-icon-btn" onClick={() => setReactionMenuId(message._id)} title="React">
                        <FiSmile size={16} />
                      </button>
                      <button className="action-icon-btn" onClick={() => onReply(message)} title="Reply">
                        <FiCornerUpLeft size={16} />
                      </button>
                      {message.senderId._id === currentUserId && (
                        <button
                          className="action-icon-btn delete-btn"
                          onClick={() => {
                            if (window.confirm('Delete this message?')) {
                              handleDeleteMessage(message._id);
                            }
                          }}
                          title="Delete message"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={endOfMessagesRef} />
      </div>

      {selectedImage && (
        <div className="image-modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="image-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedImage(null)}>
              <FiX size={28} />
            </button>
            <img src={selectedImage} alt="Full view" className="modal-image" />
          </div>
        </div>
      )}
    </>
  );
}

export default MessageList;