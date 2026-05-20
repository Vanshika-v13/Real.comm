const PREFIX = 'rc_room_session_';

export function getRoomSessionKey(roomId) {
  return `${PREFIX}${roomId?.trim().toUpperCase()}`;
}

export function readRoomSession(roomId) {
  try {
    const raw = sessionStorage.getItem(getRoomSessionKey(roomId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.joinedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeRoomSession(roomId, { micOn = false, cameraOn = false } = {}) {
  try {
    sessionStorage.setItem(
      getRoomSessionKey(roomId),
      JSON.stringify({
        joinedAt: Date.now(),
        micOn: !!micOn,
        cameraOn: !!cameraOn,
      }),
    );
  } catch {
    /* ignore */
  }
}

export function clearRoomSession(roomId) {
  try {
    sessionStorage.removeItem(getRoomSessionKey(roomId));
    sessionStorage.removeItem(`${PREFIX}prejoin_${roomId?.trim().toUpperCase()}`);
  } catch {
    /* ignore */
  }
}

export function writePrejoinPrefs(roomId, { micOn = false, cameraOn = false } = {}) {
  try {
    sessionStorage.setItem(
      `${PREFIX}prejoin_${roomId?.trim().toUpperCase()}`,
      JSON.stringify({ micOn: !!micOn, cameraOn: !!cameraOn }),
    );
  } catch {
    /* ignore */
  }
}

export function readPrejoinPrefs(roomId) {
  try {
    const raw = sessionStorage.getItem(`${PREFIX}prejoin_${roomId?.trim().toUpperCase()}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
