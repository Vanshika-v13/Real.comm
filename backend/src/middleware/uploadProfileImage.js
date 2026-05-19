const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const {
  PROFILE_MAX_BYTES,
  isAllowedProfileExtension,
  isAllowedProfileMimeType,
} = require('../utils/profileImageConstraints');
const { profileUploadRoot, ensureProfileUploadDir } = require('../utils/profileImageStorage');

ensureProfileUploadDir();

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    ensureProfileUploadDir();
    cb(null, profileUploadRoot);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = isAllowedProfileExtension(ext) ? ext : '';
    const name = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${safeExt}`;
    cb(null, name);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!isAllowedProfileExtension(ext) || !isAllowedProfileMimeType(file.mimetype)) {
    return cb(
      new AppError('Profile image must be PNG, JPEG, or WebP', 400),
    );
  }
  return cb(null, true);
}

const upload = multer({
  storage,
  limits: { fileSize: PROFILE_MAX_BYTES },
  fileFilter,
});

function uploadProfileImageSingle(fieldName = 'image') {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        return next(err);
      }
      return next();
    });
  };
}

module.exports = {
  uploadProfileImageSingle,
};
