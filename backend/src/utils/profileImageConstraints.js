/** Profile image upload constraints (images only). */
const PROFILE_MAX_BYTES = 5 * 1024 * 1024;

const PROFILE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const PROFILE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function isAllowedProfileMimeType(mime) {
  return typeof mime === 'string' && PROFILE_MIME_TYPES.has(mime.toLowerCase());
}

function isAllowedProfileExtension(ext) {
  if (typeof ext !== 'string') {
    return false;
  }
  return PROFILE_EXTENSIONS.has(ext.toLowerCase());
}

module.exports = {
  PROFILE_MAX_BYTES,
  PROFILE_MIME_TYPES,
  PROFILE_EXTENSIONS,
  isAllowedProfileMimeType,
  isAllowedProfileExtension,
};
