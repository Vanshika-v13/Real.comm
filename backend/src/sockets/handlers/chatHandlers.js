const env = require('../../config/env');
const { validateRoomIdPayload } = require('../utils/socketRoomPayload');
const { assertAuthorizedParticipant } = require('../utils/participantAuth');
const { roomSessionStore } = require('../store/roomSessionStore');

function asAck(ack) {
  return typeof ack === 'function' ? ack : null;
}

function registerChatHandlers(socket, io, presenceStore) {
  socket.on('send-message', async (payload, ack) => {
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

      const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
      if (!text) {
        respond?.({ ok: false, message: 'Message text cannot be empty' });
        return;
      }

      if (text.length > 1000) {
        respond?.({ ok: false, message: 'Message text exceeds 1000 characters' });
        return;
      }

      const message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        roomId,
        sender: {
          userId: socket.data.userId,
          name: socket.data.userName,
          profileImage: socket.data.profileImage || null,
          username: socket.data.username || null,
        },
        text,
        timestamp: new Date().toISOString(),
      };

      roomSessionStore.addChatMessage(roomId, message);
      io.to(roomId).emit('receive-message', message);
      respond?.({ ok: true, message });
    } catch (err) {
      if (env.nodeEnv === 'development') {
        console.error('send-message error:', err);
      }
      respond?.({ ok: false, message: 'Could not send message' });
    }
  });

  socket.on('get-chat-history', async (payload, ack) => {
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

      const history = roomSessionStore.getChatHistory(roomId);
      socket.emit('chat-history', history);
      respond?.({ ok: true, history });
    } catch (err) {
      if (env.nodeEnv === 'development') {
        console.error('get-chat-history error:', err);
      }
      respond?.({ ok: false, message: 'Could not fetch chat history' });
    }
  });
}

module.exports = { registerChatHandlers };
