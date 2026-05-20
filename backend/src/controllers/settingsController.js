const fs = require('fs');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const {
  formatSettingsUser,
  normalizeNotificationSettings,
  normalizePrivacySettings,
} = require('../utils/userProfileFormat');
const { generateToken } = require('../utils/tokenUtils');
const {
  buildProfileImagePublicUrl,
  deleteProfileImageByUrl,
  resolveProfileImagePath,
} = require('../utils/profileImageStorage');

function touchLastSeen(user) {
  user.lastSeen = new Date();
}

function emitUserProfileUpdated(req, user) {
  const io = req.app.get('io');
  const presenceStore = req.app.get('presenceStore');
  if (!io || !presenceStore) {
    return;
  }

  const userId = user._id.toString();
  const roomIds = presenceStore.getRoomIdsForUser(userId);
  if (roomIds.length === 0) {
    return;
  }

  const payload = {
    userId,
    name: user.name,
    fullName: user.name,
    username: user.username || null,
    profileImage: user.profileImage || null,
    bio: user.bio || '',
  };

  roomIds.forEach((roomId) => {
    io.to(roomId).emit('user-profile-updated', payload);
  });
}

function sendSettings(res, user, { statusCode = 200, message } = {}) {
  return sendSuccess(res, {
    statusCode,
    message,
    data: {
      settings: formatSettingsUser(user),
    },
  });
}

async function assertUsernameAvailable(username, excludeUserId) {
  if (!username) {
    return;
  }
  const existing = await User.findOne({ username }).select('_id');
  if (existing && existing._id.toString() !== excludeUserId.toString()) {
    throw new AppError('Username is already taken', 409);
  }
}

function readSubdocument(raw) {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  return typeof raw.toObject === 'function' ? raw.toObject() : { ...raw };
}

function ensureUserSettingsSubdocuments(user) {
  const notificationRaw = readSubdocument(user.notificationSettings);
  if (Object.keys(notificationRaw).length === 0) {
    user.notificationSettings = normalizeNotificationSettings({});
    user.markModified('notificationSettings');
  }

  const privacyRaw = readSubdocument(user.privacySettings);
  if (Object.keys(privacyRaw).length === 0) {
    user.privacySettings = normalizePrivacySettings({});
    user.markModified('privacySettings');
  }
}

const NOTIFICATION_PATCH_KEYS = [
  'sound',
  'messages',
  'meetings',
  'mentions',
  'soundEnabled',
  'emailNotifications',
  'meetingAlerts',
];

const PRIVACY_PATCH_KEYS = ['showOnlineStatus', 'allowRoomInvites'];

function pickPatchFields(body, allowedKeys) {
  const patch = {};
  allowedKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      patch[key] = body[key];
    }
  });
  return patch;
}

function applyNotificationUpdates(user, body) {
  const patch = pickPatchFields(body, NOTIFICATION_PATCH_KEYS);
  if (Object.keys(patch).length === 0) {
    return;
  }
  const raw = readSubdocument(user.notificationSettings);
  const current = normalizeNotificationSettings(raw);
  const next = { ...current };

  if (patch.sound !== undefined) {
    next.sound = patch.sound;
    next.soundEnabled = patch.sound;
  }
  if (patch.soundEnabled !== undefined) {
    next.soundEnabled = patch.soundEnabled;
    next.sound = patch.soundEnabled;
  }
  if (patch.messages !== undefined) {
    next.messages = patch.messages;
    next.emailNotifications = patch.messages;
  }
  if (patch.emailNotifications !== undefined) {
    next.emailNotifications = patch.emailNotifications;
    next.messages = patch.emailNotifications;
  }
  if (patch.meetings !== undefined) {
    next.meetings = patch.meetings;
    next.meetingAlerts = patch.meetings;
  }
  if (patch.meetingAlerts !== undefined) {
    next.meetingAlerts = patch.meetingAlerts;
    next.meetings = patch.meetingAlerts;
  }
  if (patch.mentions !== undefined) {
    next.mentions = patch.mentions;
  }

  user.notificationSettings = {
    ...raw,
    sound: next.sound,
    soundEnabled: next.soundEnabled,
    messages: next.messages,
    emailNotifications: next.emailNotifications,
    meetings: next.meetings,
    meetingAlerts: next.meetingAlerts,
    mentions: next.mentions,
  };
  user.markModified('notificationSettings');
}

function applyPrivacyUpdates(user, body) {
  const patch = pickPatchFields(body, PRIVACY_PATCH_KEYS);
  if (Object.keys(patch).length === 0) {
    return;
  }
  const raw = readSubdocument(user.privacySettings);
  const current = normalizePrivacySettings(raw);
  const next = { ...current };

  if (patch.showOnlineStatus !== undefined) {
    next.showOnlineStatus = patch.showOnlineStatus;
  }
  if (patch.allowRoomInvites !== undefined) {
    next.allowRoomInvites = patch.allowRoomInvites;
  }

  user.privacySettings = {
    ...raw,
    showOnlineStatus: next.showOnlineStatus,
    allowRoomInvites: next.allowRoomInvites,
  };
  user.markModified('privacySettings');
}

const getMySettings = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User no longer exists', 404);
  }
  ensureUserSettingsSubdocuments(user);
  touchLastSeen(user);
  await user.save({ validateBeforeSave: true });
  return sendSettings(res, user, { message: 'Settings fetched' });
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User no longer exists', 404);
  }

  const fullName = req.body.fullName ?? req.body.name;
  if (fullName !== undefined) {
    user.name = fullName;
  }
  if (req.body.username !== undefined) {
    const username = String(req.body.username).trim().toLowerCase();
    if (!username) {
      throw new AppError('Username cannot be empty', 400);
    }
    await assertUsernameAvailable(username, user._id);
    user.username = username;
  }
  if (req.body.bio !== undefined) {
    user.bio = req.body.bio;
  }

  touchLastSeen(user);
  await user.save({ validateBeforeSave: true });
  emitUserProfileUpdated(req, user);
  return sendSettings(res, user, { message: 'Profile updated successfully' });
});

const updatePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!user) {
    throw new AppError('User no longer exists', 404);
  }

  const { currentPassword, newPassword } = req.body;
  const matches = await user.comparePassword(currentPassword);
  if (!matches) {
    throw new AppError('Current password is incorrect', 400);
  }

  const sameAsCurrent = await user.comparePassword(newPassword);
  if (sameAsCurrent) {
    throw new AppError('New password must be different from current password', 400);
  }

  user.password = newPassword;
  touchLastSeen(user);
  await user.save({ validateBeforeSave: true });

  const token = generateToken(user._id);
  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') {
    cookieOptions.secure = true;
  }

  return res
    .status(200)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      status: 'success',
      message: 'Password updated successfully',
      data: {
        token,
        settings: formatSettingsUser(user),
      },
    });
});

const updateTheme = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User no longer exists', 404);
  }

  user.themePreference = req.body.themePreference;
  touchLastSeen(user);
  await user.save({ validateBeforeSave: true });
  return sendSettings(res, user, { message: 'Theme preference updated' });
});

const updateNotifications = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User no longer exists', 404);
  }

  applyNotificationUpdates(user, pickPatchFields(req.body, NOTIFICATION_PATCH_KEYS));
  touchLastSeen(user);
  await user.save({ validateBeforeSave: true });
  return sendSettings(res, user, { message: 'Notification settings updated' });
});

const updatePrivacy = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User no longer exists', 404);
  }

  applyPrivacyUpdates(user, pickPatchFields(req.body, PRIVACY_PATCH_KEYS));
  touchLastSeen(user);
  await user.save({ validateBeforeSave: true });
  return sendSettings(res, user, { message: 'Privacy settings updated' });
});

const uploadProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No profile image uploaded', 400);
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User no longer exists', 404);
  }

  const previousUrl = user.profileImage;
  const publicUrl = buildProfileImagePublicUrl(req.file.filename);

  user.profileImage = publicUrl;
  touchLastSeen(user);
  await user.save({ validateBeforeSave: true });

  if (previousUrl && previousUrl !== publicUrl) {
    deleteProfileImageByUrl(previousUrl);
  }

  emitUserProfileUpdated(req, user);

  return sendSuccess(res, {
    message: 'Profile image uploaded',
    data: {
      profileImage: publicUrl,
      settings: formatSettingsUser(user),
    },
  });
});

const removeProfileImage = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User no longer exists', 404);
  }

  const previousUrl = user.profileImage;
  user.profileImage = null;
  touchLastSeen(user);
  await user.save({ validateBeforeSave: true });

  if (previousUrl) {
    deleteProfileImageByUrl(previousUrl);
  }

  emitUserProfileUpdated(req, user);
  return sendSettings(res, user, { message: 'Profile image removed' });
});

const serveProfileImage = asyncHandler(async (req, res) => {
  const filePath = resolveProfileImagePath(req.params.storageKey);
  if (!filePath || !fs.existsSync(filePath)) {
    throw new AppError('Profile image not found', 404);
  }

  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  const typeByExt = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  const contentType = typeByExt[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return res.sendFile(filePath);
});

module.exports = {
  getMySettings,
  updateProfile,
  updatePassword,
  updateTheme,
  updateNotifications,
  updatePrivacy,
  uploadProfileImage,
  removeProfileImage,
  serveProfileImage,
};
