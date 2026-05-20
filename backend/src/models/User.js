const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const THEME_PREFERENCES = ['dark', 'light', 'system'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    username: {
      type: String,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'],
      sparse: true,
      unique: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\S+@\S+\.\S+$/,
        'Please provide a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    profileImage: {
      type: String,
      default: null,
      trim: true,
    },
    bio: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    themePreference: {
      type: String,
      enum: {
        values: THEME_PREFERENCES,
        message: 'Theme preference must be dark, light, or system',
      },
      default: 'system',
    },
    notificationSettings: {
      sound: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      meetings: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
      meetingAlerts: { type: Boolean, default: true },
      soundEnabled: { type: Boolean, default: true },
    },
    privacySettings: {
      showOnlineStatus: { type: Boolean, default: true },
      allowRoomInvites: { type: Boolean, default: true },
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) {
    return;
  }
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function comparePassword(
  candidatePassword,
) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.set('toJSON', {
  transform(_doc, ret) {
    const obj = ret;
    obj.id = obj._id.toString();
    delete obj._id;
    delete obj.__v;
    delete obj.password;
    return obj;
  },
});

module.exports = mongoose.model('User', userSchema);
