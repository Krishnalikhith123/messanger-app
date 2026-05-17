import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import axios from 'axios';
import { FiEdit2, FiArrowLeft, FiLogOut, FiMail, FiPhone, FiMapPin, FiSave, FiX } from 'react-icons/fi';
import '../styles/ProfilePage.css';

function ProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, logout } = useAuthStore();
  const [userProfile, setUserProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const targetId = userId || currentUser?.id;
    if (targetId) {
      loadUserProfile(targetId);
    }
  }, [userId, currentUser?.id]);

  const loadUserProfile = async (id) => {
    try {
      setIsLoading(true);
      const response = await axios.get(`/api/users/profile/${id}`);
      setUserProfile(response.data);
      setFormData(response.data);
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({ ...prev, profilePicture: event.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      const response = await axios.put(`/api/users/update/${currentUser.id}`, formData);
      setUserProfile(response.data);
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(userProfile);
    setIsEditing(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  if (isLoading) {
    return (
      <div className="profile-page">
        <div className="loading-spinner">
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="profile-page">
        <div className="error-message">
          <p>Profile not found</p>
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === userProfile._id;

  return (
    <div className="profile-page">
      <div className="profile-container">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <FiArrowLeft /> Back
        </button>

        <div className="profile-header">
          <div className="profile-picture-container">
            {isEditing && isOwnProfile ? (
              <label className="profile-picture-edit">
                <img
                  src={formData.profilePicture || '/default-avatar.png'}
                  alt={formData.username}
                  className="profile-picture"
                />
                <div className="edit-overlay">
                  <FiEdit2 />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  hidden
                />
              </label>
            ) : (
              <img
                src={userProfile.profilePicture || '/default-avatar.png'}
                alt={userProfile.username}
                className="profile-picture"
              />
            )}
          </div>

          <div className="profile-info">
            <h1>{userProfile.username}</h1>
            <div className="status-badge">
              <span className={`status-dot ${userProfile.status}`}></span>
              <p>{userProfile.status}</p>
            </div>
            {isOwnProfile && !isEditing && (
              <button
                className="edit-profile-btn"
                onClick={() => setIsEditing(true)}
              >
                <FiEdit2 /> Edit Profile
              </button>
            )}
          </div>
        </div>

        {isEditing && isOwnProfile ? (
          <div className="profile-edit-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username || ''}
                onChange={handleChange}
                placeholder="Enter username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-with-icon">
                <FiMail className="input-icon" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email || ''}
                  readOnly
                  disabled
                  placeholder="Email (cannot be changed)"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio || ''}
                onChange={handleChange}
                placeholder="Write something about yourself..."
                rows="4"
                maxLength="160"
              />
              <span className="char-count">
                {(formData.bio || '').length}/160
              </span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <div className="input-with-icon">
                  <FiPhone className="input-icon" />
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone || ''}
                    onChange={handleChange}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="location">Location</label>
                <div className="input-with-icon">
                  <FiMapPin className="input-icon" />
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location || ''}
                    onChange={handleChange}
                    placeholder="City, Country"
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button className="save-btn" onClick={handleSaveProfile} disabled={isSaving}>
                <FiSave /> {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button className="cancel-btn" onClick={handleCancel} disabled={isSaving}>
                <FiX /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="profile-details">
            <div className="detail-section">
              <h3>Personal Information</h3>

              <div className="detail-item">
                <div className="detail-icon">
                  <FiMail />
                </div>
                <div className="detail-content">
                  <label>Email</label>
                  <p>{userProfile.email}</p>
                </div>
              </div>

              {userProfile.phone && (
                <div className="detail-item">
                  <div className="detail-icon">
                    <FiPhone />
                  </div>
                  <div className="detail-content">
                    <label>Phone</label>
                    <p>{userProfile.phone}</p>
                  </div>
                </div>
              )}

              {userProfile.location && (
                <div className="detail-item">
                  <div className="detail-icon">
                    <FiMapPin />
                  </div>
                  <div className="detail-content">
                    <label>Location</label>
                    <p>{userProfile.location}</p>
                  </div>
                </div>
              )}
            </div>

            {userProfile.bio && (
              <div className="detail-section">
                <h3>Bio</h3>
                <p className="bio-text">{userProfile.bio}</p>
              </div>
            )}

            <div className="detail-section">
              <h3>Account Details</h3>

              <div className="detail-item">
                <label>Member Since</label>
                <p>{new Date(userProfile.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</p>
              </div>

              <div className="detail-item">
                <label>Status</label>
                <p>
                  <span className={`status-badge-small ${userProfile.status}`}>
                    {userProfile.status === 'online' ? '🟢 Online' : '🔴 Offline'}
                  </span>
                </p>
              </div>
            </div>

            {userProfile.contacts && userProfile.contacts.length > 0 && (
              <div className="detail-section">
                <h3>Contacts ({userProfile.contacts.length})</h3>
                <div className="contacts-preview">
                  {userProfile.contacts.slice(0, 5).map(contact => (
                    <div key={contact._id} className="contact-avatar-preview">
                      <img
                        src={contact.profilePicture || '/default-avatar.png'}
                        alt={contact.username}
                        title={contact.username}
                      />
                    </div>
                  ))}
                  {userProfile.contacts.length > 5 && (
                    <div className="contact-avatar-preview more">
                      +{userProfile.contacts.length - 5}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {isOwnProfile && (
          <div className="profile-footer">
            <button className="logout-btn" onClick={handleLogout}>
              <FiLogOut /> Logout
            </button>
          </div>
        )}

        {!isOwnProfile && (
          <div className="profile-actions">
            <button
              className="message-btn"
              onClick={() => navigate(`/chat/${userProfile._id}`)}
            >
              Send Message
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;