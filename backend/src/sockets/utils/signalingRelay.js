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

  // Permissive check: log if target isn't confirmed in the room adapter,
  // but still allow the relay. io.to(socketId).emit() is a safe no-op
  // if the socket doesn't exist. Blocking here caused a silent regression
  // when room-adapter membership lagged behind socket.join().
  const members = io.sockets.adapter.rooms.get(roomId);
  const targetInRoom = members && members.has(targetSocketId);
  if (!targetInRoom) {
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    console.warn('[SIGNAL] target not confirmed in room adapter — relaying anyway', {
      roomId,
      targetSocketId,
      targetConnected: !!targetSocket,
      memberCount: members ? members.size : 0,
    });
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
