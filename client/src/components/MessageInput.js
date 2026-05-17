import React, { useState, useRef } from 'react';
import { FiSend, FiImage, FiMic, FiX, FiSquare } from 'react-icons/fi';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useSocketStore } from '../store/socketStore';
import toast from 'react-hot-toast';
import axios from 'axios';
import '../styles/MessageInput.css';

function MessageInput({ chat, replyingTo, onCancelReply }) {
  const { user } = useAuthStore();
  const { addMessage } = useChatStore();
  const { socket } = useSocketStore();
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const handleSendMessage = async () => {
    if (message.trim()) {
      try {
        const response = await axios.post('/api/messages', {
          chatId: chat._id,
          recipientId: chat.participants.find(p => p._id !== user.id)?._id,
          content: message,
          messageType: 'text',
          replyTo: replyingTo ? replyingTo._id : undefined
        });
        
        addMessage(response.data);
        
        if (socket) {
          socket.emit('send-message', {
            ...response.data,
            recipientId: chat.participants.find(p => p._id !== user.id)?._id
          });
        }
        
        setMessage('');
        if (onCancelReply) onCancelReply();
      } catch (error) {
        toast.error('Failed to send message');
      }
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const response = await axios.post('/api/messages', {
            chatId: chat._id,
            recipientId: chat.participants.find(p => p._id !== user.id)?._id,
            content: `Image: ${file.name}`,
            messageType: 'image',
            mediaUrl: event.target.result
          });
          
          addMessage(response.data);
          
          if (socket) {
            socket.emit('send-message', {
              ...response.data,
              recipientId: chat.participants.find(p => p._id !== user.id)?._id
            });
          }
          
          toast.success('Image sent!');
        } catch (error) {
          toast.error('Failed to send image');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mpeg' });
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const response = await axios.post('/api/messages', {
              chatId: chat._id,
              recipientId: chat.participants.find(p => p._id !== user.id)?._id,
              content: 'Voice Message',
              messageType: 'voice',
              mediaUrl: event.target.result,
              duration: Math.round(audioChunksRef.current.length * 0.02)
            });
            
            addMessage(response.data);
            
            if (socket) {
              socket.emit('send-voice', {
                ...response.data,
                recipientId: chat.participants.find(p => p._id !== user.id)?._id
              });
            }
            
            toast.success('Voice message sent!');
          } catch (error) {
            toast.error('Failed to send voice message');
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success('Recording started...');
    } catch (error) {
      toast.error('Microphone access denied');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
    
    if (socket) {
      socket.emit('user-typing', {
        userId: user.id,
        recipientId: chat.participants.find(p => p._id !== user.id)?._id
      });
    }
  };

  return (
    <div className="message-input-container">
      {replyingTo && (
        <div className="reply-preview-bar">
          <div className="reply-preview-content">
            <span className="reply-user">{replyingTo.senderId?.username || 'User'}</span>
            <span className="reply-text">
              {replyingTo.messageType === 'text' ? replyingTo.content : `🖼️ ${replyingTo.messageType}`}
            </span>
          </div>
          <button className="cancel-reply-btn" onClick={onCancelReply} title="Cancel reply">
            <FiX size={16} />
          </button>
        </div>
      )}
      
      <div className="message-input">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          hidden
        />

        <div className="input-wrapper">
          <button
            className="input-btn image-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Send Image"
          >
            <FiImage size={20} />
          </button>

          {isRecording ? (
            <div className="recording-status">
               <span className="recording-dot"></span>
               <span>Recording voice... Release to send</span>
            </div>
          ) : (
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              rows="1"
              className="message-textarea"
            />
          )}

          <button
            className={`input-btn voice-btn ${isRecording ? 'recording' : ''}`}
            onMouseDown={handleStartRecording}
            onMouseUp={handleStopRecording}
            onTouchStart={handleStartRecording}
            onTouchEnd={handleStopRecording}
            title={isRecording ? 'Release to send' : 'Hold to record voice'}
          >
            <FiMic size={20} />
          </button>

        <button
          className="input-btn send-btn"
          onClick={handleSendMessage}
          disabled={(!message.trim() && !isRecording)}
          title="Send Message"
        >
          <FiSend size={20} />
        </button>
        </div>
      </div>
    </div>
  );
}

export default MessageInput;