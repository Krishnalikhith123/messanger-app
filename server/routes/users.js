import express from 'express';
import User from '../models/User.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Get user profile
router.get('/profile/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password')
      .populate('contacts', 'username profilePicture status');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all users (for contacts)
router.get('/all/list', auth, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } })
      .select('-password')
      .limit(50);

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Search users
router.get('/search/:query', auth, async (req, res) => {
  try {
    const users = await User.find({
      $or: [
        { username: { $regex: req.params.query, $options: 'i' } },
        { email: { $regex: req.params.query, $options: 'i' } }
      ],
      _id: { $ne: req.user.id }
    }).select('-password').limit(20);

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user profile
router.put('/update/:userId', auth, async (req, res) => {
  try {
    const { username, bio, profilePicture, phone, location } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { username, bio, profilePicture, phone, location },
      { new: true }
    ).select('-password');

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add contact
router.post('/contacts/add', auth, async (req, res) => {
  try {
    const { contactId } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { contacts: contactId } },
      { new: true }
    ).populate('contacts', 'username profilePicture status');

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove contact
router.post('/contacts/remove', auth, async (req, res) => {
  try {
    const { contactId } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { contacts: contactId } },
      { new: true }
    ).populate('contacts', 'username profilePicture status');

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Block user
router.post('/block', auth, async (req, res) => {
  try {
    const { blockedUserId } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { blockedUsers: blockedUserId } },
      { new: true }
    );

    res.status(200).json({ message: 'User blocked successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;