import express from 'express';
import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import Event from '../models/Event.js';
import { emitToUser } from '../socket.js';
import { auth } from '../middleware/auth.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

// Initialize Gemini AI (Lazy)
let genAI;
let model;

const getAiModel = () => {
  if (!model) {
    if (!process.env.GEMINI_API_KEY) return null;
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const modelName = "gemini-2.5-flash"; // Verified available in the API list
    console.log(`🤖 Initializing AI with model: ${modelName}`);
    model = genAI.getGenerativeModel({ model: modelName });
  }
  return model;
};

// Extract user intent using Gemini AI
router.post('/ai/extract-intent', auth, async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript) return res.status(400).json({ message: 'Transcript is required' });

    const aiModel = getAiModel();
    if (!aiModel) {
      return res.status(500).json({ message: 'AI Assistant is not configured.' });
    }

    const prompt = `You are an advanced intent parser for a futuristic messaging application voice assistant named Kane.
The user will give you a voice command. Extract the action and the relevant entities.
You MUST return ONLY a valid JSON object. No other text.

Supported Actions:
1. "reply" - Sending a message to someone. 
   Entities: "recipientName" (string), "content" (string)
2. "create_group" - Creating a group chat. 
   Entities: "groupName" (string, default to "New Group" if not specified), "participantNames" (array of strings)
3. "check_stories" - Checking stories/statuses.
4. "catch_me_up" - Summarizing recent messages.
5. "update_story" - Posting/updating a new text story/status update.
   Entities: "content" (string, the story text to post)
6. "unknown" - If the command doesn't match above.

Rules:
- If the user says "create a group with [names]", action is "create_group".
- If the group name is not clear, use "New Group".
- Extract names of people clearly.

Example: "create a group with mallikarjun and ashwin"
JSON: { "action": "create_group", "groupName": "New Group", "participantNames": ["mallikarjun", "ashwin"] }

Example: "reply to mom I am coming home"
JSON: { "action": "reply", "recipientName": "mom", "content": "I am coming home" }

Example: "post a story saying chilling at home"
JSON: { "action": "update_story", "content": "chilling at home" }

User Command: "${transcript}"
`;

    const result = await aiModel.generateContent(prompt);
    let responseText = result.response.text().trim();
    console.log('🎤 Raw AI Intent Response:', responseText);
    
    // Improved cleaning logic
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const intentData = JSON.parse(responseText);
      res.status(200).json(intentData);
    } catch (parseError) {
      console.error('🎤 JSON Parse Error:', parseError, 'Content:', responseText);
      // Fallback: search for something that looks like JSON if it's buried in text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const intentData = JSON.parse(jsonMatch[0]);
        return res.status(200).json(intentData);
      }
      throw parseError;
    }
  } catch (error) {
    console.error('AI Intent Extraction Error:', error);
    res.status(500).json({ message: 'Failed to process voice command.' });
  }
});

// Summarize unread messages using Gemini AI
router.post('/ai/summarize', auth, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: 'Messages array is required' });
    }

    const aiModel = getAiModel();
    if (!aiModel) return res.status(500).json({ message: 'AI Assistant is not configured.' });

    const formattedMessages = messages.map(m => `[From ${m.senderName}]: ${m.content}`).join('\n');

    const prompt = `
You are Kane, a futuristic AI assistant for a messaging app. 
The user asked to be "Caught Up" on their unread messages.
Here are the unread messages:
${formattedMessages}

Provide a very short, conversational, and friendly 2-3 sentence summary of what the user missed.
Do not use bullet points, just a natural spoken paragraph. Start with "Here is what you missed..." or similar.
`;

    const result = await aiModel.generateContent(prompt);
    let summary = result.response.text().trim();
    
    res.status(200).json({ summary });
  } catch (error) {
    console.error('AI Summarization Error:', error);
    res.status(500).json({ message: 'Failed to summarize messages.' });
  }
});

// Get all unread messages for the logged-in user
router.get('/unread/all', auth, async (req, res) => {
  try {
    const unreadMessages = await Message.find({
      recipientId: req.user.id,
      isRead: false,
      isDeleted: false,
      messageType: 'text' // Only fetch text messages for AI reading
    }).populate('senderId', 'username').sort({ createdAt: 1 });

    res.status(200).json(unreadMessages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark specific messages as read
router.post('/mark-read', auth, async (req, res) => {
  try {
    const { messageIds } = req.body;
    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({ message: 'Invalid message IDs' });
    }

    await Message.updateMany(
      { _id: { $in: messageIds }, recipientId: req.user.id },
      { 
        isRead: true,
        $addToSet: { readBy: req.user.id }
      }
    );

    res.status(200).json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get messages for a chat
router.get('/:chatId', auth, async (req, res) => {
  try {
    const messages = await Message.find({ 
      chatId: req.params.chatId,
      isDeleted: false 
    })
      .populate('senderId', 'username profilePicture')
      .populate({
        path: 'replyTo',
        select: 'content messageType senderId',
        populate: { path: 'senderId', select: 'username' }
      })
      .populate('reactions.user', 'username')
      .sort({ createdAt: 1 });

    // Mark messages as read
    await Message.updateMany(
      { 
        chatId: req.params.chatId,
        recipientId: req.user.id,
        isRead: false
      },
      { 
        isRead: true,
        $addToSet: { readBy: req.user.id }
      }
    );

    // Reset unread count for this chat
    await Chat.findByIdAndUpdate(
      req.params.chatId,
      { $set: { [`unreadCount.${req.user.id}`]: 0 } }
    );

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send message
router.post('/', auth, async (req, res) => {
  try {
    const { chatId, recipientId, content, messageType, mediaUrl, duration, replyTo } = req.body;

    const message = new Message({
      chatId,
      senderId: req.user.id,
      recipientId,
      content,
      messageType,
      mediaUrl,
      duration,
      replyTo: replyTo || null,
      isRead: false
    });

    await message.save();
    await message.populate('senderId', 'username profilePicture');
    if (replyTo) {
      await message.populate({
        path: 'replyTo',
        select: 'content messageType senderId',
        populate: { path: 'senderId', select: 'username' }
      });
    }

    // Update chat last message
    const chat = await Chat.findByIdAndUpdate(
      chatId,
      {
        lastMessage: message._id,
        lastMessageTime: new Date(),
        $inc: { [`unreadCount.${recipientId}`]: 1 }
      },
      { new: true }
    );

    res.status(201).json(message);

    // AI POST-PROCESSING (Background Tasks)
    (async () => {
      const aiModel = getAiModel();
      if (!aiModel) return;

      const chatDoc = await Chat.findById(chatId).populate('participants');
      if (!chatDoc) return;

      // 1. @Kane Chat Co-Pilot (Case-Insensitive, Direct & Group Chats)
      if (content.toLowerCase().includes('@kane')) {
        try {
          // Fetch last 10 messages for context
          const recentMsgs = await Message.find({ chatId }).sort({ createdAt: -1 }).limit(10).populate('senderId', 'username');
          const contextStr = recentMsgs.reverse().map(m => `[${m.senderId?.username || 'User'}]: ${m.content}`).join('\n');
          
          const prompt = `You are Kane, a friendly and intelligent AI assistant in this chat. 
Recent Chat History Context:
${contextStr}

The user just sent: "${content}"
Provide a helpful, direct, friendly, and concise response. Do not use markdown wrappers.`;

          const result = await aiModel.generateContent(prompt);
          let botReply = result.response.text().trim();

          // Find or create AI Bot User
          let botUser = await User.findOne({ username: 'Kane (AI)' });
          if (!botUser) {
            botUser = new User({ username: 'Kane (AI)', email: 'kane@ai.bot', password: 'ai', isBot: true });
            await botUser.save();
          }

          const recipientId = chatDoc.isGroupChat 
            ? undefined 
            : chatDoc.participants.find(p => p._id.toString() !== req.user.id)?._id;

          const botMessage = new Message({
            chatId,
            senderId: botUser._id,
            recipientId,
            content: botReply,
            messageType: 'text',
            isRead: false
          });
          await botMessage.save();
          await botMessage.populate('senderId', 'username profilePicture');

          // Update chat
          await Chat.findByIdAndUpdate(chatId, { lastMessage: botMessage._id, lastMessageTime: new Date() });

          // Emit to all participants
          chatDoc.participants.forEach(p => {
            emitToUser(p._id, 'receive-message', { ...botMessage.toObject(), recipientId: p._id });
            if (p._id.toString() !== req.user.id) {
               emitToUser(p._id, 'unread-notification', { senderId: botUser._id, senderName: 'Kane (AI)', message: chatDoc.isGroupChat ? 'Kane (AI) replied in the group.' : 'Kane (AI) replied.' });
            }
          });
        } catch (e) {
          console.error('Co-Pilot Error:', e);
        }
      }

      // 2. Autonomous Event Extraction
      const timeKeywords = ['tomorrow', 'today', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', ' pm', ' am', ' at ', 'let\'s meet'];
      if (timeKeywords.some(kw => content.toLowerCase().includes(kw))) {
        try {
          const eventPrompt = `Extract event details from this message if any exist: "${content}". 
Current local time is: ${new Date().toString()}.
Return ONLY JSON format: { 
  "isEvent": true/false, 
  "title": "...", 
  "date": "...", 
  "time": "...", 
  "location": "...",
  "isoDateTime": "YYYY-MM-DDTHH:MM:SS.000Z" (Calculate this exact ISO string in UTC or standard local timezone, based on the current local time provided above)
}. No markdown wrappers.`;
          
          const eventResult = await aiModel.generateContent(eventPrompt);
          let rawEvent = eventResult.response.text().trim();
          
          // Clean markdown code blocks robustly
          rawEvent = rawEvent.replace(/```json/gi, '').replace(/```/g, '').trim();
          
          // Regex fallback if needed
          let eventData = { isEvent: false };
          try {
            eventData = JSON.parse(rawEvent);
          } catch (parseErr) {
            const jsonMatch = rawEvent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              eventData = JSON.parse(jsonMatch[0]);
            }
          }
          
          if (eventData.isEvent) {
             const newEvent = new Event({
               title: eventData.title,
               date: eventData.date,
               time: eventData.time,
               location: eventData.location,
               eventTimestamp: eventData.isoDateTime ? new Date(eventData.isoDateTime) : null,
               chatId,
               createdBy: req.user.id
             });
             await newEvent.save();
             
             // Emit to participants
             chatDoc.participants.forEach(p => {
               emitToUser(p._id, 'new-event', newEvent.toObject());
             });
          }
        } catch (e) {
          console.error('Event Extraction Error:', e);
        }
      }
    })();

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Stateless AI Assistant Chat Route for Floating Assistant
router.post('/ai-chat', auth, async (req, res) => {
  try {
    const { content } = req.body;
    
    const aiModel = getAiModel();
    if (!aiModel) {
      return res.status(200).json({ reply: "I'm currently in 'offline mode' because no API key was found. Please add GEMINI_API_KEY to the .env file!" });
    }

    // Generate real AI response
    const result = await aiModel.generateContent(content);
    const aiContent = result.response.text();

    // Return stateless response
    res.status(200).json({ reply: aiContent });
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ 
      message: "Sorry, I had trouble processing that request. Please try again later." 
    });
  }
});

// Mark as read
router.put('/:messageId/read', auth, async (req, res) => {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.messageId,
      {
        isRead: true,
        $addToSet: { readBy: req.user.id }
      },
      { new: true }
    );

    res.status(200).json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add or remove reaction
router.post('/:messageId/react', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const existingReactionIndex = message.reactions.findIndex(
      (r) => r.emoji === emoji && r.user.toString() === req.user.id
    );

    if (existingReactionIndex !== -1) {
      message.reactions.splice(existingReactionIndex, 1);
    } else {
      message.reactions.push({ emoji, user: req.user.id });
    }

    await message.save();
    await message.populate('reactions.user', 'username');

    res.status(200).json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete message (soft delete)
router.delete('/:messageId', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is the sender
    if (message.senderId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    // Soft delete - just mark as deleted
    const deletedMessage = await Message.findByIdAndUpdate(
      req.params.messageId,
      { 
        isDeleted: true,
        deletedAt: new Date(),
        content: 'This message was deleted'
      },
      { new: true }
    );

    res.status(200).json({ message: 'Message deleted successfully', data: deletedMessage });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete all messages in a chat
router.delete('/chat/:chatId/all', auth, async (req, res) => {
  try {
    await Message.deleteMany({ chatId: req.params.chatId });
    
    await Chat.findByIdAndUpdate(
      req.params.chatId,
      {
        lastMessage: null,
        lastMessageTime: new Date(),
        $set: { 'unreadCount.$[]': 0 }
      }
    );

    res.status(200).json({ message: 'All messages deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fetch all active events for a chat
router.get('/:chatId/events', auth, async (req, res) => {
  try {
    const events = await Event.find({ chatId: req.params.chatId }).sort({ createdAt: 1 });
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete/Dismiss an event
router.delete('/events/:eventId', auth, async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.eventId);
    res.status(200).json({ message: 'Event dismissed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;