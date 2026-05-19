function emitSignalingError(socket, message, meta = {}) {
  socket.emit('signaling-error', { message, ...meta });
}

function assertRelayAllowed(io, socket, roomId, targetSocketId) {
  if (!socket.rooms.has(roomId)) {
    return {
      ok: false,
      message: 'You must join the room before signaling',
      field: 'roomId',
    };
  }

  const members = io.sockets.adapter.rooms.get(roomId);
  if (!members || !members.has(targetSocketId)) {
    return {
      ok: false,
      message: 'Target peer is not in this room',
      field: 'targetSocketId',
    };
  }

  return { ok: true };
}

function relayToPeer(io, targetSocketId, eventName, body) {
  io.to(targetSocketId).emit(eventName, body);
}

module.exports = {
  emitSignalingError,
  assertRelayAllowed,
  relayToPeer,
};
