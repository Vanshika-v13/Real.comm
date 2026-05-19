const env = require('../../config/env');
const {
  validateRoomAndTarget,
  validateSessionDescription,
  validateIceCandidate,
} = require('../utils/signalingValidation');
const {
  emitSignalingError,
  assertRelayAllowed,
  relayToPeer,
} = require('../utils/signalingRelay');

function asAck(ack) {
  return typeof ack === 'function' ? ack : null;
}

function registerSignalingHandlers(socket, io) {
  socket.on('offer', (payload, ack) => {
    const respond = asAck(ack);
    try {
      const base = validateRoomAndTarget(payload, socket.id);
      if (!base.ok) {
        emitSignalingError(socket, base.message, { field: base.field, event: 'offer' });
        respond?.({ ok: false, message: base.message });
        return;
      }
      const { roomId, targetSocketId } = base.value;

      const allowed = assertRelayAllowed(io, socket, roomId, targetSocketId);
      if (!allowed.ok) {
        emitSignalingError(socket, allowed.message, {
          field: allowed.field,
          event: 'offer',
        });
        respond?.({ ok: false, message: allowed.message });
        return;
      }

      const sdp = validateSessionDescription(payload.sdp, 'offer');
      if (!sdp.ok) {
        emitSignalingError(socket, sdp.message, { field: sdp.field, event: 'offer' });
        respond?.({ ok: false, message: sdp.message });
        return;
      }

      relayToPeer(io, targetSocketId, 'offer', {
        roomId,
        fromSocketId: socket.id,
        fromUserId: socket.data.userId,
        fromUserName: socket.data.userName,
        sdp: sdp.value,
      });

      respond?.({ ok: true });
    } catch (err) {
      if (env.nodeEnv === 'development') {
        console.error('offer signaling error:', err);
      }
      emitSignalingError(socket, 'Could not process offer', { event: 'offer' });
      respond?.({ ok: false, message: 'Could not process offer' });
    }
  });

  socket.on('answer', (payload, ack) => {
    const respond = asAck(ack);
    try {
      const base = validateRoomAndTarget(payload, socket.id);
      if (!base.ok) {
        emitSignalingError(socket, base.message, { field: base.field, event: 'answer' });
        respond?.({ ok: false, message: base.message });
        return;
      }
      const { roomId, targetSocketId } = base.value;

      const allowed = assertRelayAllowed(io, socket, roomId, targetSocketId);
      if (!allowed.ok) {
        emitSignalingError(socket, allowed.message, {
          field: allowed.field,
          event: 'answer',
        });
        respond?.({ ok: false, message: allowed.message });
        return;
      }

      const sdp = validateSessionDescription(payload.sdp, 'answer');
      if (!sdp.ok) {
        emitSignalingError(socket, sdp.message, { field: sdp.field, event: 'answer' });
        respond?.({ ok: false, message: sdp.message });
        return;
      }

      relayToPeer(io, targetSocketId, 'answer', {
        roomId,
        fromSocketId: socket.id,
        fromUserId: socket.data.userId,
        fromUserName: socket.data.userName,
        sdp: sdp.value,
      });

      respond?.({ ok: true });
    } catch (err) {
      if (env.nodeEnv === 'development') {
        console.error('answer signaling error:', err);
      }
      emitSignalingError(socket, 'Could not process answer', { event: 'answer' });
      respond?.({ ok: false, message: 'Could not process answer' });
    }
  });

  socket.on('ice-candidate', (payload, ack) => {
    const respond = asAck(ack);
    try {
      const base = validateRoomAndTarget(payload, socket.id);
      if (!base.ok) {
        emitSignalingError(socket, base.message, {
          field: base.field,
          event: 'ice-candidate',
        });
        respond?.({ ok: false, message: base.message });
        return;
      }
      const { roomId, targetSocketId } = base.value;

      const allowed = assertRelayAllowed(io, socket, roomId, targetSocketId);
      if (!allowed.ok) {
        emitSignalingError(socket, allowed.message, {
          field: allowed.field,
          event: 'ice-candidate',
        });
        respond?.({ ok: false, message: allowed.message });
        return;
      }

      const candidate = validateIceCandidate(payload.candidate);
      if (!candidate.ok) {
        emitSignalingError(socket, candidate.message, {
          field: candidate.field,
          event: 'ice-candidate',
        });
        respond?.({ ok: false, message: candidate.message });
        return;
      }

      relayToPeer(io, targetSocketId, 'ice-candidate', {
        roomId,
        fromSocketId: socket.id,
        fromUserId: socket.data.userId,
        fromUserName: socket.data.userName,
        candidate: candidate.value,
      });

      respond?.({ ok: true });
    } catch (err) {
      if (env.nodeEnv === 'development') {
        console.error('ice-candidate signaling error:', err);
      }
      emitSignalingError(socket, 'Could not process ICE candidate', {
        event: 'ice-candidate',
      });
      respond?.({ ok: false, message: 'Could not process ICE candidate' });
    }
  });
}

module.exports = {
  registerSignalingHandlers,
};
