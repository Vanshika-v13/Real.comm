const { validateRoomIdPayload, assertSocketJoinedRoom } = require('./socketRoomPayload');

const MAX_STROKE_KEYS = 32;
const MAX_STROKE_JSON_LENGTH = 65536;

function validateWhiteboardDraw(payload, socket) {
  const base = validateRoomIdPayload(payload);
  if (!base.ok) {
    return base;
  }

  const inRoom = assertSocketJoinedRoom(socket, base.roomId);
  if (!inRoom.ok) {
    return inRoom;
  }

  const { stroke } = payload;
  if (!stroke || typeof stroke !== 'object' || Array.isArray(stroke)) {
    return { ok: false, message: 'stroke must be a non-array object', field: 'stroke' };
  }

  const keys = Object.keys(stroke);
  if (keys.length > MAX_STROKE_KEYS) {
    return { ok: false, message: 'stroke has too many properties', field: 'stroke' };
  }

  let size;
  try {
    size = JSON.stringify(stroke).length;
  } catch {
    return { ok: false, message: 'stroke is not serializable', field: 'stroke' };
  }
  if (size > MAX_STROKE_JSON_LENGTH) {
    return { ok: false, message: 'stroke payload too large', field: 'stroke' };
  }

  return { ok: true, roomId: base.roomId, stroke };
}

function validateWhiteboardClear(payload, socket) {
  const base = validateRoomIdPayload(payload);
  if (!base.ok) {
    return base;
  }
  const inRoom = assertSocketJoinedRoom(socket, base.roomId);
  if (!inRoom.ok) {
    return inRoom;
  }
  return { ok: true, roomId: base.roomId };
}

module.exports = {
  validateWhiteboardDraw,
  validateWhiteboardClear,
};
