/**
 * Consistent public user profile shape for APIs, sockets, and room payloads.
 * @param {import('../models/User')} user
 */
function formatPublicUser(user) {
  if (!user) {
    return null;
  }

  const json = typeof user.toJSON === 'function' ? user.toJSON() : user;
  const name = json.name || '';
  const notifications = normalizeNotificationSettings(json.notificationSettings);
  const privacy = normalizePrivacySettings(json.privacySettings);
  const themePreference = json.themePreference || 'system';

  return {
    id: json.id || json._id?.toString(),
    fullName: name,
    name,
    username: json.username || null,
    email: json.email,
    profileImage: json.profileImage || null,
    bio: json.bio || '',
    theme: themePreference,
    themePreference,
    notificationSettings: notifications,
    privacySettings: privacy,
    lastSeen: json.lastSeen,
    createdAt: json.createdAt,
  };
}

function toCanonicalNotificationSettings(notifications) {
  const n = notifications || {};
  return {
    sound: Boolean(n.sound),
    messages: Boolean(n.messages),
    meetings: Boolean(n.meetings),
    mentions: Boolean(n.mentions),
  };
}

function toCanonicalPrivacySettings(privacy) {
  const p = privacy || {};
  return {
    showOnlineStatus: Boolean(p.showOnlineStatus),
    allowRoomInvites: Boolean(p.allowRoomInvites),
  };
}

/**
 * Settings page payload — stable shape for every user and every endpoint.
 * Includes email; never password.
 */
function formatSettingsUser(user) {
  const profile = formatPublicUser(user);
  if (!profile) {
    return null;
  }

  const themePreference =
    profile.themePreference === 'light'
    || profile.themePreference === 'dark'
    || profile.themePreference === 'system'
      ? profile.themePreference
      : 'system';

  return {
    id: profile.id,
    fullName: profile.fullName || '',
    name: profile.name || profile.fullName || '',
    username: profile.username ?? null,
    email: profile.email || '',
    profileImage: profile.profileImage ?? null,
    bio: profile.bio || '',
    theme: themePreference,
    themePreference,
    notificationSettings: toCanonicalNotificationSettings(
      profile.notificationSettings || {},
    ),
    privacySettings: toCanonicalPrivacySettings(profile.privacySettings || {}),
    lastSeen: profile.lastSeen ?? null,
    createdAt: profile.createdAt ?? null,
  };
}

/**
 * Participant list entry for rooms / presence.
 */
function formatParticipant(user, socketId) {
  const profile = formatPublicUser(user);
  if (!profile) {
    return null;
  }
  return {
    userId: profile.id,
    socketId: socketId || undefined,
    name: profile.fullName,
    fullName: profile.fullName,
    username: profile.username,
    profileImage: profile.profileImage,
    bio: profile.bio,
  };
}

function normalizeNotificationSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    sound: src.sound ?? src.soundEnabled ?? true,
    messages: src.messages ?? src.emailNotifications ?? true,
    meetings: src.meetings ?? src.meetingAlerts ?? true,
    mentions: src.mentions ?? true,
    emailNotifications: src.emailNotifications ?? src.messages ?? true,
    meetingAlerts: src.meetingAlerts ?? src.meetings ?? true,
    soundEnabled: src.soundEnabled ?? src.sound ?? true,
  };
}

function normalizePrivacySettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    showOnlineStatus: src.showOnlineStatus ?? true,
    allowRoomInvites: src.allowRoomInvites ?? true,
  };
}

module.exports = {
  formatPublicUser,
  formatSettingsUser,
  formatParticipant,
  normalizeNotificationSettings,
  normalizePrivacySettings,
  toCanonicalNotificationSettings,
  toCanonicalPrivacySettings,
};
