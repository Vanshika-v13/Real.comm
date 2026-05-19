/** Matches backend ROOM_ID_PATTERN — 8 chars, no I/O/0/1 */
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_ID_PATTERN = new RegExp(`^[${ROOM_CODE_CHARS}]{8}$`);

export const normalizeRoomCode = (input) => {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
};

export const formatRoomCodeDisplay = (code) => {
  const n = normalizeRoomCode(code);
  if (n.length <= 4) return n;
  return `${n.slice(0, 4)}-${n.slice(4)}`;
};

export const isValidRoomCode = (input) => ROOM_ID_PATTERN.test(normalizeRoomCode(input));
