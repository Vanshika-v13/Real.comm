const Room = require('../../models/Room');
const { ROOM_ID_PATTERN } = require('../../utils/roomId');
const env = require('../../config/env');
const {
  activeScreenShareStatus,
  inactiveScreenShareStatus,
} = require('../store/screenShareState');

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

function processLeaveRoom(socket, io, presenceStore, roomId, options = {}) {
  const { skipSocketLeave = false, screenShareState } = options;
  if (!skipSocketLeave) {
    socket.leave(roomId);
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

      const room = await Room.findOne({ roomId });
      if (!room) {
        respond?.({ ok: false, message: 'Room not found' });
        return;
      }

      if (socket.rooms.has(roomId)) {
        respond?.({
          ok: true,
          roomId,
          activeUsers: presenceStore.getActiveUsers(roomId),
          rejoined: true,
        });
        emitScreenShareStateToJoiner(socket, roomId, screenShareState);
        return;
      }

      await Room.updateOne(
        { roomId },
        { $addToSet: { participants: socket.data.userId } },
      );

      await socket.join(roomId);

      presenceStore.add(roomId, socket.id, {
        userId: socket.data.userId,
        userName: socket.data.userName,
      });

      io.to(roomId).emit('user-joined', {
        userId: socket.data.userId,
        name: socket.data.userName,
        socketId: socket.id,
      });

      respond?.({
        ok: true,
        roomId,
        activeUsers: presenceStore.getActiveUsers(roomId),
      });
      emitScreenShareStateToJoiner(socket, roomId, screenShareState);
    } catch (err) {
      if (env.nodeEnv === 'development') {
        console.error('join-room error:', err);
      }
      respond?.({ ok: false, message: 'Could not join room' });
    }
  });

  socket.on('leave-room', (payload) => {
    const roomId =
      typeof payload?.roomId === 'string'
        ? payload.roomId.trim().toUpperCase()
        : '';
    if (!ROOM_ID_PATTERN.test(roomId)) {
      return;
    }
    processLeaveRoom(socket, io, presenceStore, roomId, { screenShareState });
  });

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) {
        continue;
      }
      processLeaveRoom(socket, io, presenceStore, roomId, {
        skipSocketLeave: true,
        screenShareState,
      });
    }
  });
}

module.exports = {
  registerRoomHandlers,
};
