import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMessageCircle, FiTrash2 } from 'react-icons/fi';
import '../styles/ContactList.css';

function ContactList({ contacts, onRemove, isLoading }) {
  const navigate = useNavigate();

  if (isLoading) {
    return <div className="contact-list"><p>Loading contacts...</p></div>;
  }

  if (contacts.length === 0) {
    return (
      <div className="contact-list empty">
        <p>No contacts yet. Add some friends to get started!</p>
      </div>
    );
  }

  return (
    <div className="contact-list">
      {contacts.map(contact => (
        <div key={contact._id} className="contact-card">
          <img src={contact.profilePicture || '/default-avatar.png'} alt={contact.username} />
          <div className="contact-details">
            <h4>{contact.username}</h4>
            <p>{contact.bio || 'No bio'}</p>
            <span className={`status ${contact.status}`}>{contact.status}</span>
          </div>
          <div className="contact-actions">
            <button
              className="message-btn"
              onClick={() => navigate(`/chat/${contact._id}`)}
              title="Send Message"
            >
              <FiMessageCircle />
            </button>
            <button
              className="remove-btn"
              onClick={() => onRemove(contact._id)}
              title="Remove Contact"
            >
              <FiTrash2 />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ContactList;