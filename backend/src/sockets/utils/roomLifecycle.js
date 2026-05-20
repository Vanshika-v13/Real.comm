const Room = require('../../models/Room');
const { roomSessionStore } = require('../store/roomSessionStore');

/**
 * When the host has no sockets left in the room, end the session for everyone.
 * Host presence is the authority for whether a meeting is active.
 */
async function endMeetingIfHostAbsent(io, presenceStore, roomId) {
  const room = await Room.findOne({ roomId });
  if (!room) {
    return false;
  }

  const hostUserId = room.createdBy.toString();
  const active = presenceStore.getActiveUsers(roomId);
  const hostStillPresent = active.some((u) => u.userId.toString() === hostUserId);

  if (hostStillPresent) {
    roomSessionStore.cancelHostCleanup(roomId);
    return false;
  }

  roomSessionStore.clearRoomSession(roomId);

  if (active.length > 0) {
    io.to(roomId).emit('room-session-closed', {
      roomId,
      reason: 'Host left the session',
    });
  }

  return true;
}

module.exports = { endMeetingIfHostAbsent };
