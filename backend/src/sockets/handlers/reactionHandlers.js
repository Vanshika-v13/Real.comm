const env = require('../../config/env');
const { validateRoomIdPayload } = require('../utils/socketRoomPayload');
const { assertAuthorizedParticipant } = require('../utils/participantAuth');
const { roomSessionStore } = require('../store/roomSessionStore');

const ALLOWED_EMOJIS = new Set(['👍', '❤️', '😂', '😮', '👏']);

// In-memory rate limiting map: socketId -> Array of recent timestamps
const socketReactions = new Map();

function asAck(ack) {
  return typeof ack === 'function' ? ack : null;
}

function registerReactionHandlers(socket, io, presenceStore) {
  socket.on('send-reaction', async (payload, ack) => {
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

      const emoji = typeof payload?.emoji === 'string' ? payload.emoji.trim() : '';
      if (!ALLOWED_EMOJIS.has(emoji)) {
        respond?.({ ok: false, message: 'Invalid emoji reaction' });
        return;
      }

      // Rate limit & Burst protection check
      const now = Date.now();
      const history = socketReactions.get(socket.id) || [];
      const recent = history.filter((t) => now - t < 5000); // last 5 seconds

      // 1. Cooldown check (400ms)
      const lastReactionTime = recent[recent.length - 1] || 0;
      if (now - lastReactionTime < 400) {
        respond?.({ ok: false, message: 'Please wait before reacting again' });
        return;
      }

      // 2. Burst limit check (max 10 reactions in 5s)
      if (recent.length >= 10) {
        respond?.({ ok: false, message: 'Reaction rate limit exceeded' });
        return;
      }

      // Record this reaction
      recent.push(now);
      socketReactions.set(socket.id, recent);

      // Touch activity timestamp for the room session
      roomSessionStore.touchActivity(roomId);

      // Broadcast reaction to room
      io.to(roomId).emit('receive-reaction', {
        socketId: socket.id,
        userId: socket.data.userId,
        name: socket.data.userName,
        emoji,
        reactionId: `react-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      });

      respond?.({ ok: true });
    } catch (err) {
      if (env.nodeEnv === 'development') {
        console.error('send-reaction error:', err);
      }
      respond?.({ ok: false, message: 'Could not send reaction' });
    }
  });

  // Clean up socket history on disconnect to prevent memory leak
  socket.on('disconnect', () => {
    socketReactions.delete(socket.id);
  });
}

module.exports = { registerReactionHandlers };
