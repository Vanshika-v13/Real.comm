const path = require('path');
const fs = require('fs');
const env = require('../config/env');

const profileUploadRoot = path.resolve(env.uploadDir, 'profile-images');

function ensureProfileUploadDir() {
  fs.mkdirSync(profileUploadRoot, { recursive: true });
}

function buildProfileImagePublicUrl(storageFileName) {
  const safe = path.basename(storageFileName);
  return `/api/settings/profile-image/${safe}`;
}

function resolveProfileImagePath(storageFileName) {
  const safe = path.basename(storageFileName);
  const absolutePath = path.join(profileUploadRoot, safe);
  const resolvedRoot = path.resolve(profileUploadRoot);
  const resolvedFile = path.resolve(absolutePath);
  if (
    resolvedFile !== resolvedRoot
    && !resolvedFile.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    return null;
  }
  return resolvedFile;
}

function storageNameFromPublicUrl(publicUrl) {
  if (typeof publicUrl !== 'string' || !publicUrl) {
    return null;
  }
  const prefix = '/api/settings/profile-image/';
  if (!publicUrl.startsWith(prefix)) {
    return null;
  }
  return path.basename(publicUrl.slice(prefix.length));
}

function deleteProfileImageByUrl(publicUrl) {
  const storageName = storageNameFromPublicUrl(publicUrl);
  if (!storageName) {
    return;
  }
  const filePath = resolveProfileImagePath(storageName);
  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* best-effort cleanup */
  }
}

module.exports = {
  profileUploadRoot,
  ensureProfileUploadDir,
  buildProfileImagePublicUrl,
  resolveProfileImagePath,
  storageNameFromPublicUrl,
  deleteProfileImageByUrl,
};
