const { assertSocketJoinedRoom } = require('./socketRoomPayload');
const Room = require('../../models/Room');

async function assertAuthorizedParticipant(socket, roomId, presenceStore) {
  // 1. Verify socket is in the socket.io room
  const joined = assertSocketJoinedRoom(socket, roomId);
  if (!joined.ok) return joined;

  // 2. Verify socket is active in the presence store
  const activeUsers = presenceStore.getActiveUsers(roomId);
  const present = activeUsers.some((u) => u.socketId === socket.id);
  if (!present) {
    return { ok: false, message: 'Not an approved participant' };
  }

  // 3. Verify the userId is approved in the database
  const room = await Room.findOne({ roomId });
  if (!room) {
    return { ok: false, message: 'Room not found' };
  }

  const userIdStr = socket.data.userId.toString();
  const isHost = room.createdBy.toString() === userIdStr;
  const isApproved = room.participants.some((id) => id.toString() === userIdStr);

  if (!isHost && !isApproved) {
    return { ok: false, message: 'Not approved to join this room' };
  }

  return { ok: true, room };
}

module.exports = { assertAuthorizedParticipant };
