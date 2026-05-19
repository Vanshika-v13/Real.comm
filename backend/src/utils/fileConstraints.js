/** MIME types allowed for uploads (metadata only; no content inspection). */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.txt',
  '.csv',
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.zip',
]);

function isAllowedMimeType(mime) {
  return typeof mime === 'string' && ALLOWED_MIME_TYPES.has(mime.toLowerCase());
}

function isAllowedExtension(ext) {
  if (typeof ext !== 'string') {
    return false;
  }
  const normalized = ext.toLowerCase();
  return ALLOWED_EXTENSIONS.has(normalized);
}

module.exports = {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  isAllowedMimeType,
  isAllowedExtension,
};
