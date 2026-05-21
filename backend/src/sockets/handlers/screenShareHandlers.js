const env = require('../../config/env');
const { validateRoomIdPayload, assertSocketJoinedRoom } = require('../utils/socketRoomPayload');
const { emitScreenShareError } = require('../utils/featureSocketErrors');
const {
  inactiveScreenShareStatus,
  activeScreenShareStatus,
} = require('../store/screenShareState');

function asAck(ack) {
  return typeof ack === 'function' ? ack : null;
}

function registerScreenShareHandlers(socket, io, screenShareState) {
  socket.on('start-screen-share', (payload, ack) => {
    const respond = asAck(ack);
    try {
      const parsed = validateRoomIdPayload(payload);
      if (!parsed.ok) {
        emitScreenShareError(socket, parsed.message, {
          field: parsed.field,
          event: 'start-screen-share',
        });
        respond?.({ ok: false, message: parsed.message });
        return;
      }
      const { roomId } = parsed;
      const inRoom = assertSocketJoinedRoom(socket, roomId);
      if (!inRoom.ok) {
        emitScreenShareError(socket, inRoom.message, {
          field: inRoom.field,
          event: 'start-screen-share',
        });
        respond?.({ ok: false, message: inRoom.message });
        return;
      }

      const started = screenShareState.tryStart(roomId, {
        socketId: socket.id,
        userId: socket.data.userId,
        userName: socket.data.userName,
      });
      if (!started.ok) {
        emitScreenShareError(socket, started.message, {
          event: 'start-screen-share',
        });
        respond?.({ ok: false, message: started.message });
        return;
      }

      if (!started.already) {
        const entry = screenShareState.get(roomId);
        io.to(roomId).emit('screen-share-status', activeScreenShareStatus(entry));
      }

      respond?.({ ok: true });
    } catch (err) {
      if (env.nodeEnv === 'development') {
        console.error('start-screen-share error:', err);
      }
      emitScreenShareError(socket, 'Could not start screen share', {
        event: 'start-screen-share',
      });
      respond?.({ ok: false, message: 'Could not start screen share' });
    }
  });

  socket.on('stop-screen-share', (payload, ack) => {
    const respond = asAck(ack);
    try {
      const parsed = validateRoomIdPayload(payload);
      if (!parsed.ok) {
        emitScreenShareError(socket, parsed.message, {
          field: parsed.field,
          event: 'stop-screen-share',
        });
        respond?.({ ok: false, message: parsed.message });
        return;
      }
      const { roomId } = parsed;
      const inRoom = assertSocketJoinedRoom(socket, roomId);
      if (!inRoom.ok) {
        emitScreenShareError(socket, inRoom.message, {
          field: inRoom.field,
          event: 'stop-screen-share',
        });
        respond?.({ ok: false, message: inRoom.message });
        return;
      }

      const stopped = screenShareState.tryStop(roomId, socket.id);
      if (!stopped.ok) {
        emitScreenShareError(socket, stopped.message, {
          event: 'stop-screen-share',
        });
        respond?.({ ok: false, message: stopped.message });
        return;
      }

      io.to(roomId).emit('screen-share-status', inactiveScreenShareStatus());
      respond?.({ ok: true });
    } catch (err) {
      if (env.nodeEnv === 'development') {
        console.error('stop-screen-share error:', err);
      }
      emitScreenShareError(socket, 'Could not stop screen share', {
        event: 'stop-screen-share',
      });
      respond?.({ ok: false, message: 'Could not stop screen share' });
    }
  });

  // Screen share is cleared on deferred room leave (roomHandlers), not here — avoids
  // dropping active presentation when the sharer or a viewer refreshes the page.
}

module.exports = {
  registerScreenShareHandlers,
};
