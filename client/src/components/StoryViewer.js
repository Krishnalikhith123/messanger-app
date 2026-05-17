import React, { useState, useEffect } from 'react';
import { FiX, FiTrash2 } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import '../styles/StoryViewer.css';

function StoryViewer({ story, onClose, onDelete, isOwner }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          onClose();
          return 0;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [onClose]);

  return (
    <div className="story-viewer">
      <div className="story-progress">
        <div className="progress-bar" style={{ width: `${progress}%` }}></div>
      </div>

      <div className="story-content">
        {story.mediaType === 'image' ? (
          <img src={story.mediaUrl} alt="Story" />
        ) : (
          <div className="story-text-content">
            <p>{story.content}</p>
          </div>
        )}
      </div>

      <div className="story-info">
        <div className="viewer-info">
          <img src={story.userId.profilePicture || '/default-avatar.png'} alt={story.userId.username} />
          <div>
            <h4>{story.userId.username}</h4>
            <p>{formatDistanceToNow(new Date(story.createdAt), { addSuffix: true })}</p>
          </div>
        </div>

        <div className="viewer-count">
          <p>{story.viewedBy?.length || 0} views</p>
        </div>
      </div>

      <button className="close-btn" onClick={onClose}>
        <FiX />
      </button>

      {isOwner && (
        <button className="delete-btn" onClick={onDelete}>
          <FiTrash2 />
        </button>
      )}
    </div>
  );
}

export default StoryViewer;