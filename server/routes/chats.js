import express from 'express';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Get all chats for user
router.get('/', auth, async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.user.id })
      .populate('participants', 'username profilePicture status')
      .populate('lastMessage')
      .sort({ lastMessageTime: -1 });

    // Add unread count to response
    const chatsWithUnread = chats.map(chat => {
      const unreadCount = chat.unreadCount?.get(req.user.id) || 0;
      return {
        ...chat.toObject(),
        unreadCount
      };
    });

    res.status(200).json(chatsWithUnread);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get or create chat
router.post('/get-or-create', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    
    let chat = await Chat.findOne({
      participants: { $all: [req.user.id, userId] },
      isGroupChat: false
    }).populate('participants', 'username profilePicture status')
      .populate('lastMessage');

    if (!chat) {
      chat = new Chat({
        participants: [req.user.id, userId],
        isGroupChat: false,
        unreadCount: new Map()
      });
      await chat.save();
      await chat.populate('participants', 'username profilePicture status');
    }

    const unreadCount = chat.unreadCount?.get(req.user.id) || 0;
    const response = chat.toObject();
    response.unreadCount = unreadCount;

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get chat by ID
router.get('/:chatId', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId)
      .populate('participants', 'username profilePicture status')
      .populate('lastMessage');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    const unreadCount = chat.unreadCount?.get(req.user.id) || 0;
    const response = chat.toObject();
    response.unreadCount = unreadCount;

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete all messages in a chat (clear chat)
router.delete('/:chatId/messages', auth, async (req, res) => {
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

    res.status(200).json({ message: 'All messages deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete chat completely
router.delete('/:chatId', auth, async (req, res) => {
  try {
    await Message.deleteMany({ chatId: req.params.chatId });
    await Chat.findByIdAndDelete(req.params.chatId);

    res.status(200).json({ message: 'Chat deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create group chat
router.post('/group', auth, async (req, res) => {
  try {
    const { groupName, participantIds, groupImage, groupDescription } = req.body;

    const chat = new Chat({
      isGroupChat: true,
      groupName,
      groupImage,
      groupDescription,
      participants: [req.user.id, ...participantIds],
      admin: req.user.id,
      unreadCount: new Map()
    });

    await chat.save();
    await chat.populate('participants', 'username profilePicture status');

    res.status(201).json(chat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Leave group chat
router.post('/:chatId/leave', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    if (!chat.isGroupChat) {
      return res.status(400).json({ message: 'Only group chats can be left' });
    }
    
    const isParticipant = chat.participants.some(p => p.toString() === req.user.id);
    if (!isParticipant) {
      return res.status(400).json({ message: 'You are not a participant of this group' });
    }

    // Filter out the current user
    chat.participants = chat.participants.filter(p => p.toString() !== req.user.id);

    // If leaving user is the admin
    if (chat.admin?.toString() === req.user.id) {
      if (chat.participants.length > 0) {
        // Appoint first remaining participant as the new admin
        chat.admin = chat.participants[0];
      } else {
        // No participants left, delete group and all its messages
        await Message.deleteMany({ chatId: req.params.chatId });
        await Chat.findByIdAndDelete(req.params.chatId);
        return res.status(200).json({ message: 'Group deleted since no members remain' });
      }
    }

    await chat.save();
    await chat.populate('participants', 'username profilePicture status');

    res.status(200).json(chat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add participants to group chat
router.post('/:chatId/add-participants', auth, async (req, res) => {
  try {
    const { participantIds } = req.body;
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    if (!chat.isGroupChat) {
      return res.status(400).json({ message: 'Only group chats can have members added' });
    }
    if (chat.admin?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the group admin can add members' });
    }

    // Filter out users who are already participants
    const newParticipants = participantIds.filter(
      id => !chat.participants.some(p => p.toString() === id)
    );

    if (newParticipants.length > 0) {
      chat.participants.push(...newParticipants);
      await chat.save();
    }

    await chat.populate('participants', 'username profilePicture status');
    
    if (chat.lastMessage) {
      await chat.populate('lastMessage');
    }

    res.status(200).json(chat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove participant from group chat
router.post('/:chatId/remove-participant', auth, async (req, res) => {
  try {
    const { participantId } = req.body;
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    if (!chat.isGroupChat) {
      return res.status(400).json({ message: 'Only group chats can have members removed' });
    }
    if (chat.admin?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the group admin can remove members' });
    }
    if (participantId === req.user.id) {
      return res.status(400).json({ message: 'Admin cannot be removed. Use Leave Group instead.' });
    }

    const isParticipant = chat.participants.some(p => p.toString() === participantId);
    if (!isParticipant) {
      return res.status(400).json({ message: 'User is not a participant of this group' });
    }

    chat.participants = chat.participants.filter(p => p.toString() !== participantId);
    await chat.save();

    await chat.populate('participants', 'username profilePicture status');
    
    if (chat.lastMessage) {
      await chat.populate('lastMessage');
    }

    res.status(200).json(chat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;