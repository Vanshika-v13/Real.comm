const env = require('../../config/env');
const {
  validateWhiteboardDraw,
  validateWhiteboardClear,
} = require('../utils/whiteboardPayload');
const { emitWhiteboardError } = require('../utils/featureSocketErrors');

function asAck(ack) {
  return typeof ack === 'function' ? ack : null;
}

function registerWhiteboardHandlers(socket, io) {
  socket.on('whiteboard-draw', (payload, ack) => {
    const respond = asAck(ack);
    try {
      const v = validateWhiteboardDraw(payload, socket);
      if (!v.ok) {
        emitWhiteboardError(socket, v.message, {
          field: v.field,
          event: 'whiteboard-draw',
        });
        respond?.({ ok: false, message: v.message });
        return;
      }

      socket.to(v.roomId).emit('whiteboard-draw', {
        fromSocketId: socket.id,
        fromUserId: socket.data.userId,
        fromUserName: socket.data.userName,
        stroke: v.stroke,
      });

      respond?.({ ok: true });
    } catch (err) {
      if (env.nodeEnv === 'development') {
        console.error('whiteboard-draw error:', err);
      }
      emitWhiteboardError(socket, 'Could not broadcast draw', {
        event: 'whiteboard-draw',
      });
      respond?.({ ok: false, message: 'Could not broadcast draw' });
    }
  });

  socket.on('whiteboard-clear', (payload, ack) => {
    const respond = asAck(ack);
    try {
      const v = validateWhiteboardClear(payload, socket);
      if (!v.ok) {
        emitWhiteboardError(socket, v.message, {
          field: v.field,
          event: 'whiteboard-clear',
        });
        respond?.({ ok: false, message: v.message });
        return;
      }

      io.to(v.roomId).emit('whiteboard-clear', {
        clearedBySocketId: socket.id,
        clearedByUserId: socket.data.userId,
        clearedByUserName: socket.data.userName,
      });

      respond?.({ ok: true });
    } catch (err) {
      if (env.nodeEnv === 'development') {
        console.error('whiteboard-clear error:', err);
      }
      emitWhiteboardError(socket, 'Could not broadcast clear', {
        event: 'whiteboard-clear',
      });
      respond?.({ ok: false, message: 'Could not broadcast clear' });
    }
  });
}

module.exports = {
  registerWhiteboardHandlers,
};
