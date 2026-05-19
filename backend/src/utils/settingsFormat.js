/**
 * Public settings payload (never includes password or internal paths).
 * @param {import('../models/User')} user
 */
function formatSettingsUser(user) {
  const json = user.toJSON();
  return {
    id: json.id,
    name: json.name,
    email: json.email,
    profileImage: json.profileImage || null,
    bio: json.bio || '',
    themePreference: json.themePreference,
    notificationSettings: json.notificationSettings,
    privacySettings: json.privacySettings,
    lastSeen: json.lastSeen,
    createdAt: json.createdAt,
  };
}

module.exports = { formatSettingsUser };
