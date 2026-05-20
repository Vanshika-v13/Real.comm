const Room = require('../models/Room');
const User = require('../models/User');
const { formatParticipant } = require('../utils/userProfileFormat');

function isRoomHost(room, userId) {
  if (!room || !userId) {
    return false;
  }
  return room.createdBy.toString() === userId.toString();
}

async function findRoomByCode(roomId) {
  return Room.findOne({ roomId: roomId.trim().toUpperCase() });
}

async function loadUserProfile(userId) {
  return User.findById(userId).select('name username email profileImage bio');
}

function buildJoinRequestUserPayload(user) {
  const profile = formatParticipant(user);
  return profile || {
    userId: user._id.toString(),
    name: user.name,
    fullName: user.name,
    username: user.username || null,
    profileImage: user.profileImage || null,
    bio: user.bio || '',
  };
}

async function addPendingParticipant(roomId, { userId, socketId }) {
  const normalizedRoomId = roomId.trim().toUpperCase();
  const now = new Date();

  await Room.updateOne(
    { roomId: normalizedRoomId },
    {
      $pull: {
        pendingParticipants: { userId },
      },
    },
  );

  const room = await Room.findOneAndUpdate(
    { roomId: normalizedRoomId },
    {
      $push: {
        pendingParticipants: {
          userId,
          socketId,
          requestedAt: now,
        },
      },
    },
    { returnDocument: 'after' },
  );

  return room;
}

async function removePendingParticipant(roomId, { userId, socketId }) {
  const normalizedRoomId = roomId.trim().toUpperCase();
  const pullQuery = userId ? { userId } : { socketId };
  return Room.findOneAndUpdate(
    { roomId: normalizedRoomId },
    { $pull: { pendingParticipants: pullQuery } },
    { returnDocument: 'after' },
  );
}

async function clearPendingBySocket(socketId) {
  if (!socketId) {
    return;
  }
  await Room.updateMany(
    { 'pendingParticipants.socketId': socketId },
    { $pull: { pendingParticipants: { socketId } } },
  );
}

function isApprovedParticipant(room, userId) {
  if (!room?.participants?.length || !userId) {
    return false;
  }
  const id = userId.toString();
  return room.participants.some((p) => p.toString() === id);
}

function findPendingEntry(room, { userId, socketId }) {
  if (!room?.pendingParticipants?.length) {
    return null;
  }
  return room.pendingParticipants.find((entry) => {
    if (userId && entry.userId.toString() === userId.toString()) {
      return true;
    }
    if (socketId && entry.socketId === socketId) {
      return true;
    }
    return false;
  });
}

function emitToRoomHost(io, roomId, hostUserId, event, payload) {
  // Emit to the host's personal socket room (joined on connection in registerHandlers)
  io.to(`user_${hostUserId}`).emit(event, payload);
}

module.exports = {
  isRoomHost,
  findRoomByCode,
  loadUserProfile,
  buildJoinRequestUserPayload,
  addPendingParticipant,
  removePendingParticipant,
  clearPendingBySocket,
  findPendingEntry,
  isApprovedParticipant,
  emitToRoomHost,
};
