/**
 * In-memory presence: which sockets are in which logical rooms (room codes).
 * Tracks multiple tabs per user; user-left is signaled only when the last
 * socket for that user disconnects from the room.
 */
class RoomPresenceStore {
  constructor() {
    /** @type {Map<string, Map<string, { userId: string, userName: string }>>} */
    this.byRoom = new Map();
  }

  /**
   * @returns {{ userId: string, userName: string, socketId: string, isNewSocketForUser: boolean }}
   */
  add(roomId, socketId, { userId, userName }) {
    if (!this.byRoom.has(roomId)) {
      this.byRoom.set(roomId, new Map());
    }
    const sockets = this.byRoom.get(roomId);
    const hadAnotherSocketForUser = [...sockets.entries()].some(
      ([id, v]) => id !== socketId && v.userId === userId,
    );
    sockets.set(socketId, { userId, userName });
    return {
      userId,
      userName,
      socketId,
      isNewSocketForUser: !hadAnotherSocketForUser,
    };
  }

  /**
   * @returns {{ userId: string, userName: string, socketId: string, fullyLeft: boolean } | null}
   */
  remove(roomId, socketId) {
    const sockets = this.byRoom.get(roomId);
    if (!sockets) {
      return null;
    }
    const entry = sockets.get(socketId);
    if (!entry) {
      return null;
    }
    const { userId, userName } = entry;
    sockets.delete(socketId);
    const stillInRoom = [...sockets.values()].some((v) => v.userId === userId);
    if (sockets.size === 0) {
      this.byRoom.delete(roomId);
    }
    return {
      userId,
      userName,
      socketId,
      fullyLeft: !stillInRoom,
    };
  }

  /**
   * Active sockets in a room (one entry per connection).
   * @returns {Array<{ userId: string, name: string, socketId: string }>}
   */
  getActiveUsers(roomId) {
    const sockets = this.byRoom.get(roomId);
    if (!sockets) {
      return [];
    }
    return [...sockets.entries()].map(([socketId, v]) => ({
      userId: v.userId,
      name: v.userName,
      socketId,
    }));
  }

  /**
   * Room codes where the user has at least one active socket.
   * @param {string} userId
   * @returns {string[]}
   */
  getRoomIdsForUser(userId) {
    const id = String(userId);
    const roomIds = [];
    for (const [roomId, sockets] of this.byRoom.entries()) {
      const present = [...sockets.values()].some((v) => v.userId === id);
      if (present) {
        roomIds.push(roomId);
      }
    }
    return roomIds;
  }
}

module.exports = { RoomPresenceStore };
