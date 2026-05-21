const Room = require('../../models/Room');
const { ROOM_ID_PATTERN } = require('../../utils/roomId');
const env = require('../../config/env');
const {
  activeScreenShareStatus,
  inactiveScreenShareStatus,
} = require('../store/screenShareState');
const {
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
} = require('../../services/roomJoinApprovalService');
const { formatParticipant } = require('../../utils/userProfileFormat');
const { endMeetingIfHostAbsent } = require('../utils/roomLifecycle');

function asAck(ack) {
  return typeof ack === 'function' ? ack : null;
}

function emitScreenShareStateToJoiner(socket, roomId, screenShareState) {
  if (!screenShareState) {
    return;
  }
  const cur = screenShareState.get(roomId);
  socket.emit(
    'screen-share-status',
    cur ? activeScreenShareStatus(cur) : inactiveScreenShareStatus(),
  );
}

async function enrichActiveUsers(presenceStore, roomId) {
  const active = presenceStore.getActiveUsers(roomId);
  const uniqueUserIds = [...new Set(active.map((u) => u.userId))];
  const profiles = await Promise.all(uniqueUserIds.map((id) => loadUserProfile(id)));
  const profileById = new Map(
    profiles.filter(Boolean).map((user) => [user._id.toString(), user]),
  );

  return active.map((entry) => {
    const profile = profileById.get(entry.userId);
    if (!profile) {
      return entry;
    }
    const formatted = formatParticipant(profile, entry.socketId);
    return formatted || entry;
  });
}

function processLeaveRoom(socket, io, presenceStore, roomId, options = {}) {
  const {
    skipSocketLeave = false,
    screenShareState,
    defer = false,
    checkHostLifecycle = false,
  } = options;

  const finalize = async () => {
    if (!skipSocketLeave) {
      try {
        socket.leave(roomId);
      } catch {
        /* socket may already be disconnecting */
      }
    }
    const result = presenceStore.remove(roomId, socket.id);
    if (result && result.fullyLeft) {
      io.to(roomId).emit('user-left', {
        userId: result.userId,
        name: result.userName,
        socketId: result.socketId,
      });
    }
    if (screenShareState) {
      const cleared = screenShareState.tryStopBySocket(roomId, socket.id);
      if (cleared) {
        io.to(roomId).emit('screen-share-status', inactiveScreenShareStatus());
      }
    }
    if (checkHostLifecycle) {
      try {
        await endMeetingIfHostAbsent(io, presenceStore, roomId);
      } catch (err) {
        if (env.nodeEnv === 'development') {
          console.error('host lifecycle check error:', err);
        }
      }
    }
    return result;
  };

  if (defer) {
    presenceStore.scheduleDeferredRemove(roomId, socket.id, () => {
      finalize().catch((err) => {
        if (env.nodeEnv === 'development') {
          console.error('deferred leave error:', err);
        }
      });
    });
    return;
  }

  presenceStore.cancelPendingRemoval(roomId, socket.data.userId);
  return finalize();
}

async function completeRoomJoin(socket, io, presenceStore, roomId, screenShareState, roomDoc = null) {
  await Room.updateOne(
    { roomId },
    { $addToSet: { participants: socket.data.userId } },
  );

  await socket.join(roomId);

  presenceStore.cancelPendingRemoval(roomId, socket.data.userId);
  const pruned = presenceStore.pruneStaleSocketsForUser(
    roomId,
    socket.data.userId,
    socket.id,
  );

  const addResult = presenceStore.add(roomId, socket.id, {
    userId: socket.data.userId,
    userName: socket.data.userName,
  });

  if (screenShareState) {
    const { migrated, entry } = screenShareState.migrateSharerSocket(
      roomId,
      socket.data.userId,
      socket.id,
      socket.data.userName,
    );
    if (migrated && entry) {
      io.to(roomId).emit('screen-share-status', activeScreenShareStatus(entry));
    }
  }

  const profile = await loadUserProfile(socket.data.userId);
  const participantPayload = formatParticipant(profile, socket.id) || {
    userId: socket.data.userId,
    name: socket.data.userName,
    fullName: socket.data.userName,
    username: socket.data.username || null,
    profileImage: socket.data.profileImage || null,
    bio: socket.data.bio || '',
    socketId: socket.id,
  };

  const isReconnect =
    roomDoc && isApprovedParticipant(roomDoc, socket.data.userId) && pruned > 0;

  if (addResult.isNewSocketForUser && !isReconnect) {
    io.to(roomId).emit('user-joined', participantPayload);
  }

  return enrichActiveUsers(presenceStore, roomId);
}

async function queueJoinRequest(socket, io, room, roomId) {
  const hostUserId = room.createdBy.toString();
  const user = await loadUserProfile(socket.data.userId);
  const userPayload = buildJoinRequestUserPayload(user);

  await addPendingParticipant(roomId, {
    userId: socket.data.userId,
    socketId: socket.id,
  });

  emitToRoomHost(io, roomId, hostUserId, 'join-request', {
    roomId,
    userId: socket.data.userId,
    user: userPayload,
    socketId: socket.id,
    requestedAt: new Date().toISOString(),
  });
}

function registerRoomHandlers(socket, io, presenceStore, screenShareState) {
  socket.on('join-room', async (payload, ack) => {
    const respond = asAck(ack);
    try {
      const roomId =
        typeof payload?.roomId === 'string'
          ? payload.roomId.trim().toUpperCase()
          : '';
      if (!ROOM_ID_PATTERN.test(roomId)) {
        respond?.({ ok: false, message: 'Invalid room code' });
        return;
      }

      const room = await findRoomByCode(roomId);
      if (!room) {
        respond?.({ ok: false, message: 'Room not found' });
        return;
      }

      if (socket.rooms.has(roomId)) {
        const activeUsers = await enrichActiveUsers(presenceStore, roomId);
        respond?.({
          ok: true,
          roomId,
          activeUsers,
          rejoined: true,
          joinApprovalEnabled: room.joinApprovalEnabled,
        });
        emitScreenShareStateToJoiner(socket, roomId, screenShareState);
        return;
      }

      const hostUserId = room.createdBy.toString();
      const isHost = socket.data.userId === hostUserId;
      const alreadyPending = findPendingEntry(room, {
        userId: socket.data.userId,
        socketId: socket.id,
      });

      if (room.joinApprovalEnabled && !isHost) {
        const approvedMember = isApprovedParticipant(room, socket.data.userId);

        if (!approvedMember) {
          if (alreadyPending) {
            respond?.({
              ok: false,
              pending: true,
              message: 'Join request already pending host approval',
            });
            return;
          }

          await queueJoinRequest(socket, io, room, roomId);
          respond?.({
            ok: false,
            pending: true,
            message: 'Waiting for host approval',
            roomId,
          });
          return;
        }

        await removePendingParticipant(roomId, { userId: socket.data.userId });
      }

      const activeUsers = await completeRoomJoin(
        socket,
        io,
        presenceStore,
        roomId,
        screenShareState,
        room,
      );

      respond?.({
        ok: true,
        roomId,
        activeUsers,
        joinApprovalEnabled: room.joinApprovalEnabled,
      });
      emitScreenShareStateToJoiner(socket, roomId, screenShareState);
    } catch (err) {
      if (env.nodeEnv === 'development') {
        console.error('join-room error:', err);
      }
      respond?.({ ok: false, message: 'Could not join room' });
    }
  });

  socket.on('approve-join-request', async (payload, ack) => {
    const respond = asAck(ack);
    try {
      const roomId =
        typeof payload?.roomId === 'string'
          ? payload.roomId.trim().toUpperCase()
          : '';
      const targetUserId = payload?.userId;
      const targetSocketId = payload?.socketId;

      if (!ROOM_ID_PATTERN.test(roomId)) {
        respond?.({ ok: false, message: 'Invalid room code' });
        return;
      }

      const room = await findRoomByCode(roomId);
      if (!room) {
        respond?.({ ok: false, message: 'Room not found' });
        return;
      }

      if (!isRoomHost(room, socket.data.userId)) {
        respond?.({ ok: false, message: 'Only the room host can approve join requests' });
        return;
      }

      const pending = findPendingEntry(room, {
        userId: targetUserId,
        socketId: targetSocketId,
      });
      if (!pending) {
        respond?.({ ok: false, message: 'Join request not found or already handled' });
        return;
      }

      const requesterSocket = io.sockets.sockets.get(pending.socketId);
      if (!requesterSocket || requesterSocket.data.userId !== pending.userId.toString()) {
        await removePendingParticipant(roomId, {
          userId: pending.userId,
          socketId: pending.socketId,
        });
        respond?.({ ok: false, message: 'Requester is no longer connected' });
        return;
      }

      if (requesterSocket.rooms.has(roomId)) {
        await removePendingParticipant(roomId, {
          userId: pending.userId,
          socketId: pending.socketId,
        });
        respond?.({ ok: true, message: 'User is already in the room' });
        return;
      }

      await removePendingParticipant(roomId, {
        userId: pending.userId,
        socketId: pending.socketId,
      });

      const activeUsers = await completeRoomJoin(
        requesterSocket,
        io,
        presenceStore,
        roomId,
        screenShareState,
        room,
      );

      requesterSocket.emit('join-approved', {
        roomId,
        name: room.name,
        message: 'Your request to join was approved',
        activeUsers,
      });

      respond?.({ ok: true, roomId, userId: pending.userId.toString() });
      emitScreenShareStateToJoiner(requesterSocket, roomId, screenShareState);
    } catch (err) {
      if (env.nodeEnv === 'development') {
        console.error('approve-join-request error:', err);
      }
      respond?.({ ok: false, message: 'Could not approve join request' });
    }
  });

  socket.on('reject-join-request', async (payload, ack) => {
    const respond = asAck(ack);
    try {
      const roomId =
        typeof payload?.roomId === 'string'
          ? payload.roomId.trim().toUpperCase()
          : '';
      const targetUserId = payload?.userId;
      const targetSocketId = payload?.socketId;
      const reason =
        typeof payload?.message === 'string' && payload.message.trim()
          ? payload.message.trim()
          : 'Your request to join was rejected by the host';

      if (!ROOM_ID_PATTERN.test(roomId)) {
        respond?.({ ok: false, message: 'Invalid room code' });
        return;
      }

      const room = await findRoomByCode(roomId);
      if (!room) {
        respond?.({ ok: false, message: 'Room not found' });
        return;
      }

      if (!isRoomHost(room, socket.data.userId)) {
        respond?.({ ok: false, message: 'Only the room host can reject join requests' });
        return;
      }

      const pending = findPendingEntry(room, {
        userId: targetUserId,
        socketId: targetSocketId,
      });
      if (!pending) {
        respond?.({ ok: false, message: 'Join request not found or already handled' });
        return;
      }

      await removePendingParticipant(roomId, {
        userId: pending.userId,
        socketId: pending.socketId,
      });

      const requesterSocket = io.sockets.sockets.get(pending.socketId);
      if (requesterSocket) {
        requesterSocket.emit('join-rejected', {
          roomId,
          message: reason,
        });
      }

      respond?.({ ok: true, roomId, userId: pending.userId.toString() });
    } catch (err) {
      if (env.nodeEnv === 'development') {
        console.error('reject-join-request error:', err);
      }
      respond?.({ ok: false, message: 'Could not reject join request' });
    }
  });

  socket.on('leave-room', async (payload) => {
    const roomId =
      typeof payload?.roomId === 'string'
        ? payload.roomId.trim().toUpperCase()
        : '';
    if (!ROOM_ID_PATTERN.test(roomId)) {
      return;
    }
    processLeaveRoom(socket, io, presenceStore, roomId, {
      screenShareState,
      checkHostLifecycle: true,
    });
  });

  socket.on('disconnecting', () => {
    clearPendingBySocket(socket.id).catch((err) => {
      if (env.nodeEnv === 'development') {
        console.error('clearPendingBySocket error:', err);
      }
    });

    for (const roomId of socket.rooms) {
      if (roomId === socket.id) {
        continue;
      }
      // Skip personal notification rooms (user_xxx) — not actual meeting rooms
      if (roomId.startsWith('user_')) {
        continue;
      }
      processLeaveRoom(socket, io, presenceStore, roomId, {
        skipSocketLeave: true,
        screenShareState,
        defer: true,
        checkHostLifecycle: true,
      });
    }
  });
}

module.exports = {
  registerRoomHandlers,
};
