const crypto = require('crypto');
const AppError = require('./AppError');

const ROOM_ID_LENGTH = 8;
/** Uppercase letters and digits without ambiguous I, O, 0, 1 */
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_ID_PATTERN = new RegExp(`^[${ROOM_CODE_CHARS}]{8}$`);

function randomRoomIdString() {
  const bytes = crypto.randomBytes(ROOM_ID_LENGTH);
  let out = '';
  for (let i = 0; i < ROOM_ID_LENGTH; i += 1) {
    out += ROOM_CODE_CHARS[bytes[i] % ROOM_CODE_CHARS.length];
  }
  return out;
}

/**
 * @param {import('mongoose').Model} RoomModel
 * @returns {Promise<string>}
 */
async function generateUniqueRoomId(RoomModel) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const roomId = randomRoomIdString();
    const taken = await RoomModel.exists({ roomId });
    if (!taken) {
      return roomId;
    }
  }
  throw new AppError('Could not generate a unique room code', 503);
}

module.exports = {
  generateUniqueRoomId,
  randomRoomIdString,
  ROOM_ID_LENGTH,
  ROOM_ID_PATTERN,
  ROOM_CODE_CHARS,
};
