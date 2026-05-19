const { Server } = require('socket.io');
const { socketAuthMiddleware } = require('./middleware/socketAuth');
const { registerSocketHandlers } = require('./registerHandlers');
const { RoomPresenceStore } = require('./store/roomPresenceStore');
const { ScreenShareStateByRoom } = require('./store/screenShareState');

function initSocket(httpServer, { allowedOrigins, app }) {
  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin) {
          return callback(null, true);
        }
        return callback(null, allowedOrigins.includes(origin));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  const presenceStore = new RoomPresenceStore();
  const screenShareState = new ScreenShareStateByRoom();

  if (app) {
    app.set('io', io);
    app.set('presenceStore', presenceStore);
  }

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    registerSocketHandlers(socket, io, presenceStore, screenShareState);
  });

  return io;
}

module.exports = { initSocket };
