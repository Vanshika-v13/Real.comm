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
  rejectUnknownFields(['name', 'bio']),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  requireAtLeastOneField(['name', 'bio']),
];

const updateThemeRules = [
  rejectUnknownFields(['themePreference']),
  body('themePreference')
    .notEmpty()
    .withMessage('themePreference is required')
    .isIn(THEME_VALUES)
    .withMessage('themePreference must be dark, light, or system'),
];

const updateNotificationsRules = [
  rejectUnknownFields(['emailNotifications', 'meetingAlerts', 'soundEnabled']),
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
  requireAtLeastOneField(['emailNotifications', 'meetingAlerts', 'soundEnabled']),
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
  updateThemeRules,
  updateNotificationsRules,
  updatePrivacyRules,
};
