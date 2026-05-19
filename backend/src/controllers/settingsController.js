const fs = require('fs');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { formatSettingsUser } = require('../utils/settingsFormat');
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
    profileImage: user.profileImage || null,
  };

  roomIds.forEach((roomId) => {
    io.to(roomId).emit('user-profile-updated', payload);
  });
}

function sendSettings(res, user, statusCode = 200) {
  return res.status(statusCode).json({
    status: 'success',
    data: {
      settings: formatSettingsUser(user),
    },
  });
}

const getMySettings = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User no longer exists', 401);
  }
  touchLastSeen(user);
  await user.save({ validateBeforeSave: true });
  return sendSettings(res, user);
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User no longer exists', 401);
  }

  if (req.body.name !== undefined) {
    user.name = req.body.name;
  }
  if (req.body.bio !== undefined) {
    user.bio = req.body.bio;
  }

  touchLastSeen(user);
  await user.save({ validateBeforeSave: true });
  emitUserProfileUpdated(req, user);
  return sendSettings(res, user);
});

const updateTheme = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User no longer exists', 401);
  }

  user.themePreference = req.body.themePreference;
  touchLastSeen(user);
  await user.save({ validateBeforeSave: true });
  return sendSettings(res, user);
});

const updateNotifications = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User no longer exists', 401);
  }

  const { emailNotifications, meetingAlerts, soundEnabled } = req.body;
  if (emailNotifications !== undefined) {
    user.notificationSettings.emailNotifications = emailNotifications;
  }
  if (meetingAlerts !== undefined) {
    user.notificationSettings.meetingAlerts = meetingAlerts;
  }
  if (soundEnabled !== undefined) {
    user.notificationSettings.soundEnabled = soundEnabled;
  }

  user.markModified('notificationSettings');
  touchLastSeen(user);
  await user.save({ validateBeforeSave: true });
  return sendSettings(res, user);
});

const updatePrivacy = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User no longer exists', 401);
  }

  const { showOnlineStatus, allowRoomInvites } = req.body;
  if (showOnlineStatus !== undefined) {
    user.privacySettings.showOnlineStatus = showOnlineStatus;
  }
  if (allowRoomInvites !== undefined) {
    user.privacySettings.allowRoomInvites = allowRoomInvites;
  }

  user.markModified('privacySettings');
  touchLastSeen(user);
  await user.save({ validateBeforeSave: true });
  return sendSettings(res, user);
});

const uploadProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No profile image uploaded', 400);
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User no longer exists', 401);
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

  return res.status(200).json({
    status: 'success',
    data: {
      profileImage: publicUrl,
      settings: formatSettingsUser(user),
    },
  });
});

const removeProfileImage = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User no longer exists', 401);
  }

  const previousUrl = user.profileImage;
  user.profileImage = null;
  touchLastSeen(user);
  await user.save({ validateBeforeSave: true });

  if (previousUrl) {
    deleteProfileImageByUrl(previousUrl);
  }

  emitUserProfileUpdated(req, user);
  return sendSettings(res, user);
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
  updateTheme,
  updateNotifications,
  updatePrivacy,
  uploadProfileImage,
  removeProfileImage,
  serveProfileImage,
};
