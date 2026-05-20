const { body, param } = require('express-validator');

const THEME_VALUES = ['dark', 'light', 'system'];

function rejectUnknownFields(allowedKeys) {
  const allowed = new Set(allowedKeys);
  return body().custom((_value, { req }) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      throw new Error('Invalid request body');
    }
    const unknown = Object.keys(req.body).filter((key) => !allowed.has(key));
    if (unknown.length > 0) {
      throw new Error(`Unknown fields: ${unknown.join(', ')}`);
    }
    return true;
  });
}

function requireAtLeastOneField(fieldNames) {
  const names = fieldNames;
  return body().custom((_value, { req }) => {
    const hasOne = names.some((name) => Object.prototype.hasOwnProperty.call(req.body, name));
    if (!hasOne) {
      throw new Error(`At least one of ${names.join(', ')} is required`);
    }
    return true;
  });
}

const profileStorageKeyRules = [
  param('storageKey')
    .trim()
    .notEmpty()
    .withMessage('storageKey is required')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('Invalid profile image key'),
];

const updateProfileRules = [
  rejectUnknownFields(['name', 'fullName', 'username', 'bio']),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('fullName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Full name cannot be empty')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('username')
    .optional()
    .trim()
    .toLowerCase()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-z0-9_]+$/)
    .withMessage('Username may only contain letters, numbers, and underscores'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  requireAtLeastOneField(['name', 'fullName', 'username', 'bio']),
];

const updatePasswordRules = [
  rejectUnknownFields(['currentPassword', 'newPassword', 'confirmPassword']),
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters'),
  body('confirmPassword')
    .notEmpty()
    .withMessage('Password confirmation is required')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    }),
];

const updateThemeRules = [
  rejectUnknownFields(['themePreference']),
  body('themePreference')
    .notEmpty()
    .withMessage('themePreference is required')
    .isIn(THEME_VALUES)
    .withMessage('themePreference must be dark, light, or system'),
];

const NOTIFICATION_FIELDS = [
  'sound',
  'messages',
  'meetings',
  'mentions',
  'emailNotifications',
  'meetingAlerts',
  'soundEnabled',
];

const updateNotificationsRules = [
  rejectUnknownFields(NOTIFICATION_FIELDS),
  body('sound').optional().isBoolean().withMessage('sound must be a boolean').toBoolean(),
  body('messages').optional().isBoolean().withMessage('messages must be a boolean').toBoolean(),
  body('meetings').optional().isBoolean().withMessage('meetings must be a boolean').toBoolean(),
  body('mentions').optional().isBoolean().withMessage('mentions must be a boolean').toBoolean(),
  body('emailNotifications')
    .optional()
    .isBoolean()
    .withMessage('emailNotifications must be a boolean')
    .toBoolean(),
  body('meetingAlerts')
    .optional()
    .isBoolean()
    .withMessage('meetingAlerts must be a boolean')
    .toBoolean(),
  body('soundEnabled')
    .optional()
    .isBoolean()
    .withMessage('soundEnabled must be a boolean')
    .toBoolean(),
  requireAtLeastOneField(NOTIFICATION_FIELDS),
];

const updatePrivacyRules = [
  rejectUnknownFields(['showOnlineStatus', 'allowRoomInvites']),
  body('showOnlineStatus')
    .optional()
    .isBoolean()
    .withMessage('showOnlineStatus must be a boolean')
    .toBoolean(),
  body('allowRoomInvites')
    .optional()
    .isBoolean()
    .withMessage('allowRoomInvites must be a boolean')
    .toBoolean(),
  requireAtLeastOneField(['showOnlineStatus', 'allowRoomInvites']),
];

module.exports = {
  profileStorageKeyRules,
  updateProfileRules,
  updatePasswordRules,
  updateThemeRules,
  updateNotificationsRules,
  updatePrivacyRules,
};
