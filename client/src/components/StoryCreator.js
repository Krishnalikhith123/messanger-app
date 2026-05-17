import React, { useState, useRef } from 'react';
import { FiX, FiImage } from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../styles/StoryCreator.css';

function StoryCreator({ onClose, onCreate }) {
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState('text');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setMediaUrl(event.target.result);
        setMediaType('image');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async () => {
    if (!content.trim()) {
      toast.error('Please add some text to your story');
      return;
    }

    setIsLoading(true);
    try {
      await onCreate(content, mediaUrl, mediaType);
    } catch (error) {
      toast.error('Failed to create story');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="story-creator-overlay">
      <div className="story-creator">
        <button className="close-btn" onClick={onClose}>
          <FiX />
        </button>

        <h2>Create a Story</h2>

        <div className="creator-content">
          {mediaUrl ? (
            <div className="media-preview">
              <img src={mediaUrl} alt="Story" />
              <button onClick={() => { setMediaUrl(null); setMediaType('text'); }}>
                Change Image
              </button>
            </div>
          ) : (
            <div className="media-upload">
              <button onClick={() => fileInputRef.current?.click()}>
                <FiImage /> Add Image (Optional)
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                hidden
              />
            </div>
          )}

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            maxLength={500}
            rows={4}
          />

          <div className="char-count">
            {content.length}/500
          </div>
        </div>

        <button
          className="create-btn"
          onClick={handleCreate}
          disabled={isLoading || !content.trim()}
        >
          {isLoading ? 'Creating...' : 'Create Story'}
        </button>
      </div>
    </div>
  );
}

export default StoryCreator;