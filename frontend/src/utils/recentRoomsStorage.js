const MAX_RECENT_ROOMS = 50;

export function getRecentRoomsKey(user) {
  if (!user) return null;
  return `real_comm_recent_rooms_${user.id || user._id}`;
}

export function readRecentRooms(user) {
  const key = getRecentRoomsKey(user);
  if (!key) return [];
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function writeRecentRooms(user, entries) {
  const key = getRecentRoomsKey(user);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(entries.slice(0, MAX_RECENT_ROOMS)));
  } catch {
    /* ignore quota errors */
  }
}

export function upsertRecentRoom(user, entry) {
  if (!user || !entry?.roomId) return;
  const normalized = {
    roomId: entry.roomId.trim().toUpperCase(),
    roomName: entry.roomName || 'Meeting Room',
    role: entry.role || 'joiner',
    joinedAt:
      typeof entry.joinedAt === 'number'
        ? new Date(entry.joinedAt).toISOString()
        : entry.joinedAt || new Date().toISOString(),
    hostName: entry.hostName || 'Meeting',
    isActive: entry.isActive ?? false,
  };

  const saved = readRecentRooms(user);
  const idx = saved.findIndex((r) => {
    const id = typeof r === 'string' ? r : r?.roomId;
    return id && id.trim().toUpperCase() === normalized.roomId;
  });

  if (idx >= 0) {
    const prev = typeof saved[idx] === 'string' ? { roomId: saved[idx] } : saved[idx];
    saved[idx] = { ...prev, ...normalized };
  } else {
    saved.unshift(normalized);
  }

  writeRecentRooms(user, saved);
}

export function markRecentRoomInactive(user, roomId) {
  if (!user || !roomId) return;
  const target = roomId.trim().toUpperCase();
  const saved = readRecentRooms(user).map((r) => {
    const entry = typeof r === 'string' ? { roomId: r } : r;
    if (entry?.roomId?.trim().toUpperCase() === target) {
      return { ...entry, isActive: false };
    }
    return entry;
  });
  writeRecentRooms(user, saved);
}

export function resolveRoomDisplayName(room, cachedName) {
  const fromApi = room?.name || room?.roomName || room?.title;
  if (typeof fromApi === 'string' && fromApi.trim()) return fromApi.trim();
  if (typeof cachedName === 'string' && cachedName.trim()) return cachedName.trim();
  return 'Meeting Room';
}
