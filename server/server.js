const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables from server/.env (works regardless of process cwd)
const envPath = path.join(__dirname, '.env');
const envResult = dotenv.config({ path: envPath, override: true });

if (envResult.error) {
  console.error('Failed to load .env:', envResult.error.message);
}

// Trim Razorpay keys (Windows CRLF / accidental spaces in .env)
if (process.env.RAZORPAY_KEY_ID) {
  process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID.trim();
}
if (process.env.RAZORPAY_KEY_SECRET) {
  process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET.trim();
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic health check route
app.get('/', (req, res) => {
  res.status(200).send('Server Running');
});

// Set mongoose options for current versions
mongoose.set('strictQuery', false);

// Routes
const authRoutes = require('./routes/authRoutes');
const questionRoutes = require('./routes/questionRoutes');
const answerRoutes = require('./routes/answerRoutes');
const pointsRoutes = require('./routes/pointsRoutes');
const socialRoutes = require('./routes/socialRoutes');
const postRoutes = require('./routes/postRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const languageRoutes = require('./routes/languageRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/answers', answerRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/language', languageRoutes);

// MongoDB connection with retry logic to avoid crashing Nodemon
const connectWithRetry = async (retryDelay = 5000) => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not set in .env');
    return setTimeout(() => connectWithRetry(retryDelay), retryDelay);
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    console.log(`Retrying MongoDB connection in ${retryDelay / 1000}s...`);
    setTimeout(() => connectWithRetry(Math.min(retryDelay * 1.5, 30000)), retryDelay);
  }
};

// Start Express server immediately; DB connection runs in background with retries.
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  connectWithRetry();
});
