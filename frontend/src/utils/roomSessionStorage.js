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

export function writeRoomSession(
  roomId,
  {
    micOn = false,
    cameraOn = false,
    unreadChat = 0,
    lastReadChatAt = null,
    presenterSocketId = null,
    presenterUserId = null,
    presenterName = null,
    joinedAt,
  } = {},
) {
  try {
    const prev = readRoomSession(roomId);
    sessionStorage.setItem(
      getRoomSessionKey(roomId),
      JSON.stringify({
        joinedAt: joinedAt ?? prev?.joinedAt ?? Date.now(),
        micOn: !!micOn,
        cameraOn: !!cameraOn,
        unreadChat: typeof unreadChat === 'number' ? unreadChat : (prev?.unreadChat ?? 0),
        lastReadChatAt: lastReadChatAt ?? prev?.lastReadChatAt ?? null,
        presenterSocketId: presenterSocketId ?? prev?.presenterSocketId ?? null,
        presenterUserId: presenterUserId ?? prev?.presenterUserId ?? null,
        presenterName: presenterName ?? prev?.presenterName ?? null,
      }),
    );
  } catch {
    /* ignore */
  }
}

/** Merge partial session fields without dropping existing values. */
export function patchRoomSession(roomId, patch = {}) {
  const prev = readRoomSession(roomId);
  writeRoomSession(roomId, {
    micOn: prev?.micOn ?? false,
    cameraOn: prev?.cameraOn ?? false,
    unreadChat: prev?.unreadChat ?? 0,
    lastReadChatAt: prev?.lastReadChatAt ?? null,
    presenterSocketId: prev?.presenterSocketId ?? null,
    presenterUserId: prev?.presenterUserId ?? null,
    presenterName: prev?.presenterName ?? null,
    joinedAt: prev?.joinedAt,
    ...patch,
  });
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
