/**
 * Deduplicate room participants: unique socketId, then one entry per userId (newest wins).
 */
export const dedupeParticipants = (list) => {
  if (!Array.isArray(list)) return [];

  const out = [];
  const seenSocket = new Set();
  const seenUser = new Set();

  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    if (!p) continue;

    if (p.socketId) {
      if (seenSocket.has(p.socketId)) continue;
      seenSocket.add(p.socketId);
      if (p.userId) seenUser.add(p.userId);
      out.unshift(p);
      continue;
    }

    if (p.userId && seenUser.has(p.userId)) continue;
    if (p.userId) seenUser.add(p.userId);
    out.unshift(p);
  }

  return out;
};

/** Merge a participant by socketId (update) or append, then dedupe. */
export const upsertParticipant = (list, incoming) => {
  if (!incoming?.socketId) return dedupeParticipants(list);

  const idx = list.findIndex((p) => p.socketId === incoming.socketId);
  const merged =
    idx >= 0
      ? list.map((p, i) =>
          i === idx
            ? {
                ...p,
                userId: incoming.userId ?? p.userId,
                name: incoming.name ?? p.name,
                socketId: incoming.socketId,
              }
            : p,
        )
      : [
          ...list,
          {
            userId: incoming.userId,
            name: incoming.name,
            socketId: incoming.socketId,
          },
        ];

  return dedupeParticipants(merged);
};

export const findDuplicateParticipants = (list) => {
  const socketIds = new Set();
  const userIds = new Set();
  const dupes = [];

  (list || []).forEach((p) => {
    if (p?.socketId && socketIds.has(p.socketId)) dupes.push({ type: 'socketId', id: p.socketId });
    if (p?.socketId) socketIds.add(p.socketId);
    if (p?.userId && userIds.has(p.userId)) dupes.push({ type: 'userId', id: p.userId });
    if (p?.userId) userIds.add(p.userId);
  });

  return dupes;
};

export const excludeLocalParticipant = (list, localSocketId) => {
  if (!localSocketId) return dedupeParticipants(list);
  return dedupeParticipants(list).filter((p) => p.socketId !== localSocketId);
};

export const logParticipantDedupe = (source, before, after, extra) => {
  if (!import.meta.env.DEV || before === after) return;
  console.log('[RTC:participants] Deduped list', { source, before, after, ...extra });
};
