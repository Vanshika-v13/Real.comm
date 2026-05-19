/**
 * Tracks at most one active screen sharer per logical room (roomId string).
 */
class ScreenShareStateByRoom {
  constructor() {
    /** @type {Map<string, { socketId: string, userId: string, userName: string }>} */
    this.activeByRoom = new Map();
  }

  get(roomId) {
    return this.activeByRoom.get(roomId) || null;
  }

  tryStart(roomId, { socketId, userId, userName }) {
    const cur = this.activeByRoom.get(roomId);
    if (cur && cur.socketId !== socketId) {
      return {
        ok: false,
        message: 'Another participant is already sharing their screen',
      };
    }
    if (cur && cur.socketId === socketId) {
      return { ok: true, already: true };
    }
    this.activeByRoom.set(roomId, {
      socketId,
      userId,
      userName,
    });
    return { ok: true, already: false };
  }

  tryStop(roomId, socketId) {
    const cur = this.activeByRoom.get(roomId);
    if (!cur) {
      return { ok: false, message: 'No active screen share in this room' };
    }
    if (cur.socketId !== socketId) {
      return { ok: false, message: 'You are not the active screen sharer' };
    }
    this.activeByRoom.delete(roomId);
    return { ok: true };
  }

  /**
   * Used on disconnect: remove sharer if this socket was sharing.
   * @returns {boolean} whether state changed
   */
  tryStopBySocket(roomId, socketId) {
    const cur = this.activeByRoom.get(roomId);
    if (!cur || cur.socketId !== socketId) {
      return false;
    }
    this.activeByRoom.delete(roomId);
    return true;
  }
}

function inactiveScreenShareStatus() {
  return {
    active: false,
    sharerSocketId: null,
    sharerUserId: null,
    sharerName: null,
  };
}

function activeScreenShareStatus(entry) {
  return {
    active: true,
    sharerSocketId: entry.socketId,
    sharerUserId: entry.userId,
    sharerName: entry.userName,
  };
}

module.exports = {
  ScreenShareStateByRoom,
  inactiveScreenShareStatus,
  activeScreenShareStatus,
};
