const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    phone: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false,
    },
    profileImage: {
      type: String,
      default: '',
    },
    points: {
      type: Number,
      default: 0,
      min: 0,
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    /** Tracks last forgot-password request (once per day limit) */
    lastForgotPasswordAt: {
      type: Date,
      default: null,
    },
    /** Subscription: free | bronze | silver | gold */
    subscriptionPlan: {
      type: String,
      enum: ['free', 'bronze', 'silver', 'gold'],
      default: 'free',
    },
    subscriptionActiveAt: {
      type: Date,
      default: null,
    },
    subscriptionExpiresAt: {
      type: Date,
      default: null,
    },
    preferredLanguage: {
      type: String,
      enum: ['en', 'es', 'hi', 'pt', 'zh', 'fr'],
      default: 'en',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
