/** Grace period before treating socket disconnect as an intentional leave (page refresh). */
const RECONNECT_GRACE_MS = 20000;

/**
 * In-memory presence: which sockets are in which logical rooms (room codes).
 * Tracks multiple tabs per user; user-left is signaled only when the last
 * socket for that user disconnects from the room.
 */
class RoomPresenceStore {
  constructor() {
    /** @type {Map<string, Map<string, { userId: string, userName: string }>>} */
    this.byRoom = new Map();
    /** @type {Map<string, { timer: NodeJS.Timeout, socketId: string }>} */
    this.pendingRemovalByUser = new Map();
  }

  _pendingKey(roomId, userId) {
    return `${roomId}:${userId}`;
  }

  cancelPendingRemoval(roomId, userId) {
    const key = this._pendingKey(roomId, userId);
    const pending = this.pendingRemovalByUser.get(key);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingRemovalByUser.delete(key);
    }
  }

  /**
   * Defer removing a socket so page refresh can reconnect without leaving the room.
   * @returns {boolean} true if removal was scheduled
   */
  scheduleDeferredRemove(roomId, socketId, onFinalize) {
    const sockets = this.byRoom.get(roomId);
    const entry = sockets?.get(socketId);
    if (!entry) {
      return false;
    }

    const userId = entry.userId;
    const key = this._pendingKey(roomId, userId);
    this.cancelPendingRemoval(roomId, userId);

    const timer = setTimeout(() => {
      this.pendingRemovalByUser.delete(key);
      onFinalize();
    }, RECONNECT_GRACE_MS);

    this.pendingRemovalByUser.set(key, { timer, socketId });
    return true;
  }

  /**
   * Drop stale sockets for the same user before adding a refreshed connection.
   */
  pruneStaleSocketsForUser(roomId, userId, keepSocketId) {
    const sockets = this.byRoom.get(roomId);
    if (!sockets) {
      return 0;
    }
    let removed = 0;
    for (const [sid] of [...sockets.entries()]) {
      if (sid !== keepSocketId && sockets.get(sid).userId === userId) {
        sockets.delete(sid);
        removed += 1;
      }
    }
    if (sockets.size === 0) {
      this.byRoom.delete(roomId);
    }
    return removed;
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
