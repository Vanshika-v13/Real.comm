function emitScreenShareError(socket, message, meta = {}) {
  socket.emit('screen-share-error', { message, ...meta });
}

function emitWhiteboardError(socket, message, meta = {}) {
  socket.emit('whiteboard-error', { message, ...meta });
}

module.exports = {
  emitScreenShareError,
  emitWhiteboardError,
};
