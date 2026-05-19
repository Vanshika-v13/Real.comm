const { ROOM_ID_PATTERN } = require('../../utils/roomId');

function validateRoomIdPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, message: 'Payload must be an object', field: 'payload' };
  }
  const roomId =
    typeof payload.roomId === 'string' ? payload.roomId.trim().toUpperCase() : '';
  if (!ROOM_ID_PATTERN.test(roomId)) {
    return { ok: false, message: 'Invalid room code', field: 'roomId' };
  }
  return { ok: true, roomId };
}

function assertSocketJoinedRoom(socket, roomId) {
  if (!socket.rooms.has(roomId)) {
    return {
      ok: false,
      message: 'You must join the room first',
      field: 'roomId',
    };
  }
  return { ok: true };
}

module.exports = {
  validateRoomIdPayload,
  assertSocketJoinedRoom,
};
