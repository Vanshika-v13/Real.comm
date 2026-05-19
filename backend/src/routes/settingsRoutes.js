const express = require('express');
const rateLimit = require('express-rate-limit');
const settingsController = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');
const validateRequest = require('../middleware/validate');
const { uploadProfileImageSingle } = require('../middleware/uploadProfileImage');
const {
  profileStorageKeyRules,
  updateProfileRules,
  updateThemeRules,
  updateNotificationsRules,
  updatePrivacyRules,
} = require('../validators/settingsValidators');

const router = express.Router();

const profileUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many profile uploads, try again later' },
});

router.use(protect);

router.get('/me', settingsController.getMySettings);

router.put('/profile', updateProfileRules, validateRequest, settingsController.updateProfile);

router.put('/theme', updateThemeRules, validateRequest, settingsController.updateTheme);

router.put(
  '/notifications',
  updateNotificationsRules,
  validateRequest,
  settingsController.updateNotifications,
);

router.put('/privacy', updatePrivacyRules, validateRequest, settingsController.updatePrivacy);

router.post(
  '/profile-image',
  profileUploadLimiter,
  uploadProfileImageSingle('image'),
  settingsController.uploadProfileImage,
);

router.delete('/profile-image', settingsController.removeProfileImage);

router.get(
  '/profile-image/:storageKey',
  profileStorageKeyRules,
  validateRequest,
  settingsController.serveProfileImage,
);

module.exports = router;
