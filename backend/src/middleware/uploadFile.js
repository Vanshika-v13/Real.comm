const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const {
  isAllowedMimeType,
  isAllowedExtension,
} = require('../utils/fileConstraints');

const uploadRoot = path.resolve(env.uploadDir);

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    fs.mkdirSync(uploadRoot, { recursive: true });
    cb(null, uploadRoot);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = isAllowedExtension(ext) ? ext : '';
    const name = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${safeExt}`;
    cb(null, name);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!isAllowedExtension(ext) || !isAllowedMimeType(file.mimetype)) {
    return cb(new AppError('File type or extension is not allowed', 400));
  }
  return cb(null, true);
}

const upload = multer({
  storage,
  limits: { fileSize: env.maxFileSizeBytes },
  fileFilter,
});

function uploadSingle(fieldName) {
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
  upload,
  uploadSingle,
  uploadRoot,
};
