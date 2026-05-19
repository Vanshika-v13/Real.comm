const { registerRoomHandlers } = require('./handlers/roomHandlers');
const { registerSignalingHandlers } = require('./handlers/signalingHandlers');
const { registerScreenShareHandlers } = require('./handlers/screenShareHandlers');
const { registerWhiteboardHandlers } = require('./handlers/whiteboardHandlers');
const env = require('../config/env');

function registerSocketHandlers(socket, io, presenceStore, screenShareState) {
  socket.on('error', (socketErr) => {
    if (env.nodeEnv === 'development') {
      console.error('Socket error', socket.id, socketErr?.message);
    }
  });

  registerRoomHandlers(socket, io, presenceStore, screenShareState);
  registerSignalingHandlers(socket, io);
  registerScreenShareHandlers(socket, io, screenShareState);
  registerWhiteboardHandlers(socket, io);
}

module.exports = { registerSocketHandlers };
