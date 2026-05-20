const { registerRoomHandlers } = require('./handlers/roomHandlers');
const { registerSignalingHandlers } = require('./handlers/signalingHandlers');
const { registerScreenShareHandlers } = require('./handlers/screenShareHandlers');
const { registerWhiteboardHandlers } = require('./handlers/whiteboardHandlers');
const { registerChatHandlers } = require('./handlers/chatHandlers');
const { registerRaiseHandHandlers } = require('./handlers/raiseHandHandlers');
const { registerReactionHandlers } = require('./handlers/reactionHandlers');
const { roomSessionStore } = require('./store/roomSessionStore');
const env = require('../config/env');

let ttlStarted = false;

function registerSocketHandlers(socket, io, presenceStore, screenShareState) {
  socket.on('error', (socketErr) => {
    if (env.nodeEnv === 'development') {
      console.error('Socket error', socket.id, socketErr?.message);
    }
  });

  socket.join(`user_${socket.data.userId}`);

  // Order of registration is critical. Room handlers must be registered first.
  registerRoomHandlers(socket, io, presenceStore, screenShareState);
  registerChatHandlers(socket, io, presenceStore);
  registerRaiseHandHandlers(socket, io, presenceStore);
  registerReactionHandlers(socket, io, presenceStore);

  registerSignalingHandlers(socket, io);
  registerScreenShareHandlers(socket, io, screenShareState);
  registerWhiteboardHandlers(socket, io);

  if (!ttlStarted) {
    ttlStarted = true;
    roomSessionStore.startTTLInterval(presenceStore);
  }
}

module.exports = { registerSocketHandlers };
