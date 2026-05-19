const { ROOM_ID_PATTERN } = require('../../utils/roomId');

const SDP_TYPES = new Set(['offer', 'answer', 'pranswer', 'rollback']);

const MAX_SDP_LENGTH = 500000;
const MAX_ICE_CANDIDATE_LENGTH = 20000;

function validateRoomAndTarget(payload, senderSocketId) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, message: 'Payload must be an object', field: 'payload' };
  }

  const roomId =
    typeof payload.roomId === 'string' ? payload.roomId.trim().toUpperCase() : '';
  if (!ROOM_ID_PATTERN.test(roomId)) {
    return { ok: false, message: 'Invalid room code', field: 'roomId' };
  }

  const targetSocketId =
    typeof payload.targetSocketId === 'string'
      ? payload.targetSocketId.trim()
      : '';
  if (!targetSocketId) {
    return { ok: false, message: 'targetSocketId is required', field: 'targetSocketId' };
  }
  if (targetSocketId.length > 100) {
    return { ok: false, message: 'Invalid targetSocketId', field: 'targetSocketId' };
  }
  if (targetSocketId === senderSocketId) {
    return { ok: false, message: 'Cannot signal to yourself', field: 'targetSocketId' };
  }

  return { ok: true, value: { roomId, targetSocketId } };
}

function validateSessionDescription(sdp, expectedType) {
  if (!sdp || typeof sdp !== 'object') {
    return { ok: false, message: 'sdp must be an object', field: 'sdp' };
  }

  const type = typeof sdp.type === 'string' ? sdp.type : '';
  if (!SDP_TYPES.has(type)) {
    return { ok: false, message: 'Invalid sdp.type', field: 'sdp.type' };
  }
  if (expectedType && type !== expectedType) {
    return {
      ok: false,
      message: `sdp.type must be "${expectedType}"`,
      field: 'sdp.type',
    };
  }

  if (typeof sdp.sdp !== 'string') {
    return { ok: false, message: 'sdp.sdp must be a string', field: 'sdp.sdp' };
  }
  if (sdp.sdp.length > MAX_SDP_LENGTH) {
    return { ok: false, message: 'sdp.sdp exceeds maximum length', field: 'sdp.sdp' };
  }

  return { ok: true, value: { type, sdp: sdp.sdp } };
}

function validateIceCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return { ok: false, message: 'candidate must be an object', field: 'candidate' };
  }

  if (typeof candidate.candidate !== 'string') {
    return {
      ok: false,
      message: 'candidate.candidate must be a string',
      field: 'candidate.candidate',
    };
  }
  if (candidate.candidate.length > MAX_ICE_CANDIDATE_LENGTH) {
    return {
      ok: false,
      message: 'candidate.candidate exceeds maximum length',
      field: 'candidate.candidate',
    };
  }

  if (
    'sdpMid' in candidate &&
    candidate.sdpMid != null &&
    typeof candidate.sdpMid !== 'string'
  ) {
    return { ok: false, message: 'sdpMid must be a string or null', field: 'sdpMid' };
  }

  if (
    'sdpMLineIndex' in candidate &&
    candidate.sdpMLineIndex != null &&
    typeof candidate.sdpMLineIndex !== 'number'
  ) {
    return {
      ok: false,
      message: 'sdpMLineIndex must be a number or null',
      field: 'sdpMLineIndex',
    };
  }

  if (
    'usernameFragment' in candidate &&
    candidate.usernameFragment != null &&
    typeof candidate.usernameFragment !== 'string'
  ) {
    return {
      ok: false,
      message: 'usernameFragment must be a string or null',
      field: 'usernameFragment',
    };
  }

  const forward = { candidate: candidate.candidate };
  if ('sdpMid' in candidate) {
    forward.sdpMid = candidate.sdpMid;
  }
  if ('sdpMLineIndex' in candidate) {
    forward.sdpMLineIndex = candidate.sdpMLineIndex;
  }
  if ('usernameFragment' in candidate) {
    forward.usernameFragment = candidate.usernameFragment;
  }

  return { ok: true, value: forward };
}

module.exports = {
  validateRoomAndTarget,
  validateSessionDescription,
  validateIceCandidate,
};
