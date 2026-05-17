import express from 'express';
import Story from '../models/Story.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Create story
router.post('/', auth, async (req, res) => {
  try {
    const { content, mediaUrl, mediaType } = req.body;

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const story = new Story({
      userId: req.user.id,
      content,
      mediaUrl,
      mediaType,
      expiresAt
    });

    await story.save();
    await story.populate('userId', 'username profilePicture');

    res.status(201).json(story);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all stories
router.get('/', auth, async (req, res) => {
  try {
    const stories = await Story.find({
      expiresAt: { $gt: new Date() }
    })
      .populate('userId', 'username profilePicture')
      .sort({ createdAt: -1 });

    res.status(200).json(stories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// View story
router.post('/:storyId/view', auth, async (req, res) => {
  try {
    const story = await Story.findByIdAndUpdate(
      req.params.storyId,
      {
        $addToSet: {
          viewedBy: {
            userId: req.user.id,
            viewedAt: new Date()
          }
        }
      },
      { new: true }
    ).populate('userId', 'username profilePicture');

    res.status(200).json(story);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete story
router.delete('/:storyId', auth, async (req, res) => {
  try {
    const story = await Story.findByIdAndDelete(req.params.storyId);

    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    res.status(200).json({ message: 'Story deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;