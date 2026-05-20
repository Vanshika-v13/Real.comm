/**
 * In-memory room sessions: chat, hand raises, activity tracking, and cleanup.
 */
class RoomSessionStore {
  constructor() {
    this.chatHistories = new Map(); // roomId -> Array<Message>
    this.raisedHands = new Map(); // roomId -> Map<socketId, { userId, name, timestamp }>
    this.hostDisconnectTimers = new Map(); // roomId -> Timeout
    this.lastActivity = new Map(); // roomId -> timestamp
  }

  touchActivity(roomId) {
    this.lastActivity.set(roomId, Date.now());
  }

  getChatHistory(roomId) {
    return this.chatHistories.get(roomId) || [];
  }

  addChatMessage(roomId, message) {
    this.touchActivity(roomId);
    if (!this.chatHistories.has(roomId)) {
      this.chatHistories.set(roomId, []);
    }
    const history = this.chatHistories.get(roomId);
    history.push(message);
    // Limit in-memory history per room to 500 messages to prevent memory abuse
    if (history.length > 500) {
      history.shift();
    }
  }

  getRaisedHands(roomId) {
    const handsMap = this.raisedHands.get(roomId);
    if (!handsMap) return [];
    const list = [];
    for (const [socketId, info] of handsMap.entries()) {
      list.push({
        socketId,
        userId: info.userId,
        name: info.name,
        timestamp: info.timestamp,
      });
    }
    return list;
  }

  /**
   * Idempotent raise hand. Returns true if state actually changed.
   */
  raiseHand(roomId, socketId, { userId, name }) {
    this.touchActivity(roomId);
    if (!this.raisedHands.has(roomId)) {
      this.raisedHands.set(roomId, new Map());
    }
    const handsMap = this.raisedHands.get(roomId);
    if (handsMap.has(socketId)) {
      return false; // Already raised, no state change
    }
    handsMap.set(socketId, {
      userId,
      name,
      timestamp: new Date().toISOString(),
    });
    return true;
  }

  /**
   * Idempotent lower hand. Returns true if state actually changed.
   */
  lowerHand(roomId, socketId) {
    this.touchActivity(roomId);
    const handsMap = this.raisedHands.get(roomId);
    if (!handsMap || !handsMap.has(socketId)) {
      return false; // Not raised, no state change
    }
    handsMap.delete(socketId);
    if (handsMap.size === 0) {
      this.raisedHands.delete(roomId);
    }
    return true;
  }

  startHostCleanup(roomId, cleanupCallback) {
    this.cancelHostCleanup(roomId);
    const timer = setTimeout(() => {
      this.clearRoomSession(roomId);
      cleanupCallback?.();
    }, 30000); // 30 seconds host disconnect grace period
    this.hostDisconnectTimers.set(roomId, timer);
  }

  cancelHostCleanup(roomId) {
    const timer = this.hostDisconnectTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.hostDisconnectTimers.delete(roomId);
    }
  }

  clearRoomSession(roomId) {
    this.cancelHostCleanup(roomId);
    this.chatHistories.delete(roomId);
    this.raisedHands.delete(roomId);
    this.lastActivity.delete(roomId);
  }

  /**
   * Scans and prunes rooms inactive for >30 minutes with 0 active sockets.
   */
  runTTLCheck(presenceStore) {
    const now = Date.now();
    const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes

    // Scan all rooms tracked in our activity map
    for (const roomId of this.lastActivity.keys()) {
      const activeSockets = presenceStore.getActiveUsers(roomId);
      const activeCount = activeSockets.length;
      const lastTime = this.lastActivity.get(roomId) || 0;

      if (activeCount === 0 && (now - lastTime > INACTIVITY_LIMIT)) {
        this.clearRoomSession(roomId);
        if (process.env.NODE_ENV === 'development') {
          console.log(`[RTC:sessionStore] Pruned inactive empty room: ${roomId}`);
        }
      }
    }
  }

  startTTLInterval(presenceStore) {
    // Run TTL check every 10 minutes
    setInterval(() => {
      try {
        this.runTTLCheck(presenceStore);
      } catch (err) {
        console.error('TTL check error:', err);
      }
    }, 10 * 60 * 1000);
  }
}

const roomSessionStore = new RoomSessionStore();
module.exports = { roomSessionStore };
