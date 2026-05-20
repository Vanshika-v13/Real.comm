const NOTIFICATION_PATCH_KEYS = ['sound', 'messages', 'meetings', 'mentions'];
const PRIVACY_PATCH_KEYS = ['showOnlineStatus', 'allowRoomInvites'];

function pickBooleanPatch(input, allowedKeys) {
  const patch = {};
  if (!input || typeof input !== 'object') {
    return patch;
  }
  allowedKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(input, key) && typeof input[key] === 'boolean') {
      patch[key] = input[key];
    }
  });
  return patch;
}

/** Build a safe partial notification patch (never sends the full settings object). */
export function pickNotificationPatch(input) {
  return pickBooleanPatch(input, NOTIFICATION_PATCH_KEYS);
}

/** Build a safe partial privacy patch (never sends the full settings object). */
export function pickPrivacyPatch(input) {
  return pickBooleanPatch(input, PRIVACY_PATCH_KEYS);
}
