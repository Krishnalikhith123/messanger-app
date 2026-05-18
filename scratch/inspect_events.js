import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Event from '../server/models/Event.js';

dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mern-messenger';
console.log('Connecting to database:', mongoUri);

async function inspect() {
  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected successfully!');
    
    const events = await Event.find().sort({ createdAt: -1 }).limit(10);
    console.log(`\nFound ${events.length} recent events in database:`);
    
    events.forEach((ev, idx) => {
      console.log(`\n[Event #${idx + 1}]`);
      console.log('ID:', ev._id);
      console.log('Title:', ev.title);
      console.log('Date Text:', ev.date);
      console.log('Time Text:', ev.time);
      console.log('Location:', ev.location);
      console.log('Event Timestamp (ISO):', ev.eventTimestamp);
      console.log('Reminded Status:', ev.reminded);
      console.log('Created At:', ev.createdAt);
      
      const now = new Date();
      if (ev.eventTimestamp) {
        const diffMs = ev.eventTimestamp.getTime() - now.getTime();
        const diffMins = Math.round(diffMs / 60000);
        console.log(`Time Difference from now: ${diffMins} minutes`);
      } else {
        console.log('⚠️ eventTimestamp is null or missing!');
      }
    });

  } catch (error) {
    console.error('Inspection error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

inspect();
