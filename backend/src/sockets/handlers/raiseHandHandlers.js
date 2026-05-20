const env = require('../../config/env');
const { validateRoomIdPayload } = require('../utils/socketRoomPayload');
const { assertAuthorizedParticipant } = require('../utils/participantAuth');
const { roomSessionStore } = require('../store/roomSessionStore');
const Room = require('../../models/Room');

function asAck(ack) {
  return typeof ack === 'function' ? ack : null;
}

function registerRaiseHandHandlers(socket, io, presenceStore) {
  // Authoritative hand raising
  socket.on('raise-hand', async (payload, ack) => {
    const respond = asAck(ack);
    try {
      const vRoom = validateRoomIdPayload(payload);
      if (!vRoom.ok) {
        respond?.({ ok: false, message: vRoom.message });
        return;
      }
      const roomId = vRoom.roomId;

      const auth = await assertAuthorizedParticipant(socket, roomId, presenceStore);
      if (!auth.ok) {
        respond?.({ ok: false, message: auth.message });
        return;
      }

      const info = {
        userId: socket.data.userId,
        name: socket.data.userName,
      };

      const changed = roomSessionStore.raiseHand(roomId, socket.id, info);
      if (changed) {
        const list = roomSessionStore.getRaisedHands(roomId);
        const raisedHandInfo = list.find((item) => item.socketId === socket.id);
        io.to(roomId).emit('hand-state-changed', {
          socketId: socket.id,
          userId: socket.data.userId,
          name: socket.data.userName,
          raised: true,
          timestamp: raisedHandInfo?.timestamp || new Date().toISOString(),
        });
      }

      respond?.({ ok: true });
    } catch (err) {
      if (env.nodeEnv === 'development') {
        console.error('raise-hand error:', err);
      }
      respond?.({ ok: false, message: 'Could not raise hand' });
    }
  });

  // Authoritative hand lowering
  socket.on('lower-hand', async (payload, ack) => {
    const respond = asAck(ack);
    try {
      const vRoom = validateRoomIdPayload(payload);
      if (!vRoom.ok) {
        respond?.({ ok: false, message: vRoom.message });
        return;
      }
      const roomId = vRoom.roomId;

      const auth = await assertAuthorizedParticipant(socket, roomId, presenceStore);
      if (!auth.ok) {
        respond?.({ ok: false, message: auth.message });
        return;
      }

      const targetSocketId = typeof payload?.targetSocketId === 'string' ? payload.targetSocketId : socket.id;

      // If user is trying to lower someone else's hand, they must be the Host
      if (targetSocketId !== socket.id) {
        const isHost = auth.room.createdBy.toString() === socket.data.userId.toString();
        if (!isHost) {
          respond?.({ ok: false, message: 'Only the host can lower another participant\'s hand' });
          return;
        }
      }

      const changed = roomSessionStore.lowerHand(roomId, targetSocketId);
      if (changed) {
        // Fetch target details if possible
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        io.to(roomId).emit('hand-state-changed', {
          socketId: targetSocketId,
          userId: targetSocket ? targetSocket.data.userId : null,
          name: targetSocket ? targetSocket.data.userName : 'Participant',
          raised: false,
        });
      }

      respond?.({ ok: true });
    } catch (err) {
      if (env.nodeEnv === 'development') {
        console.error('lower-hand error:', err);
      }
      respond?.({ ok: false, message: 'Could not lower hand' });
    }
  });

  // Fetch list of currently raised hands in the room
  socket.on('get-raised-hands', async (payload, ack) => {
    const respond = asAck(ack);
    try {
      const vRoom = validateRoomIdPayload(payload);
      if (!vRoom.ok) {
        respond?.({ ok: false, message: vRoom.message });
        return;
      }
      const roomId = vRoom.roomId;

      const auth = await assertAuthorizedParticipant(socket, roomId, presenceStore);
      if (!auth.ok) {
        respond?.({ ok: false, message: auth.message });
        return;
      }

      const list = roomSessionStore.getRaisedHands(roomId);
      socket.emit('raised-hands-list', list);
      respond?.({ ok: true, raisedHands: list });
    } catch (err) {
      if (env.nodeEnv === 'development') {
        console.error('get-raised-hands error:', err);
      }
      respond?.({ ok: false, message: 'Could not fetch raised hands list' });
    }
  });

  // Clean up hand state on explicit room leave
  socket.on('leave-room', (payload) => {
    const roomId = typeof payload?.roomId === 'string' ? payload.roomId.trim().toUpperCase() : '';
    if (!roomId) return;

    roomSessionStore.lowerHand(roomId, socket.id);

    // Clean up empty room immediately
    const active = presenceStore.getActiveUsers(roomId);
    const remaining = active.filter((u) => u.socketId !== socket.id);
    if (remaining.length === 0) {
      roomSessionStore.clearRoomSession(roomId);
    }
  });

  // Host reconnect handler: cancel cleanup when host joins
  socket.on('join-room', async (payload) => {
    const roomId = typeof payload?.roomId === 'string' ? payload.roomId.trim().toUpperCase() : '';
    if (!roomId) return;

    try {
      const room = await Room.findOne({ roomId });
      if (room && room.createdBy.toString() === socket.data.userId.toString()) {
        roomSessionStore.cancelHostCleanup(roomId);
      }
    } catch (err) {
      // Ignore errors in join-room reconnect checker
    }
  });

  // Clean up raised hands and monitor host disconnects
  socket.on('disconnecting', async () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id || roomId.startsWith('user_')) {
        continue;
      }

      try {
        // Idempotently lower the disconnecting user's hand
        const changed = roomSessionStore.lowerHand(roomId, socket.id);
        if (changed) {
          io.to(roomId).emit('hand-state-changed', {
            socketId: socket.id,
            userId: socket.data.userId,
            name: socket.data.userName,
            raised: false,
          });
        }

        // Fetch room info to check host presence and empty room state
        const room = await Room.findOne({ roomId });
        if (!room) continue;

        const active = presenceStore.getActiveUsers(roomId);
        const remainingSockets = active.filter((u) => u.socketId !== socket.id);

        // Last user leaves room -> clean up instantly
        if (remainingSockets.length === 0) {
          roomSessionStore.clearRoomSession(roomId);
          continue;
        }

      } catch (err) {
        // Ignore disconnect cleanup errors
      }
    }
  });
}

module.exports = { registerRaiseHandHandlers };
