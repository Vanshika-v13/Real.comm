const Room = require('../models/Room');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { generateUniqueRoomId } = require('../utils/roomId');
const { formatPublicUser } = require('../utils/userProfileFormat');

const USER_PROFILE_FIELDS = 'name username email profileImage bio';

const create = asyncHandler(async (req, res) => {
  const joinApprovalEnabled = Boolean(req.body?.joinApprovalEnabled);
  const rawName = req.body?.name ?? req.body?.roomName ?? '';
  const name =
    typeof rawName === 'string' && rawName.trim() ? rawName.trim().slice(0, 100) : 'Meeting Room';
  const roomId = await generateUniqueRoomId(Room);
  const room = await Room.create({
    roomId,
    name,
    createdBy: req.user._id,
    participants: [req.user._id],
    joinApprovalEnabled,
    pendingParticipants: [],
  });

  const populated = await Room.findById(room._id)
    .populate('createdBy', USER_PROFILE_FIELDS)
    .populate('participants', USER_PROFILE_FIELDS);

  const roomJson = populated.toJSON();
  roomJson.createdBy = formatPublicUser(populated.createdBy);
  roomJson.participants = populated.participants.map((p) => formatPublicUser(p));

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Room created',
    data: { room: roomJson },
  });
});

const getByRoomId = asyncHandler(async (req, res) => {
  const { roomId } = req.params;

  const room = await Room.findOne({ roomId })
    .populate('createdBy', USER_PROFILE_FIELDS)
    .populate('participants', USER_PROFILE_FIELDS)
    .populate('pendingParticipants.userId', USER_PROFILE_FIELDS);

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  const isHost = room.createdBy._id.toString() === req.user._id.toString();

  const roomJson = room.toJSON();
  roomJson.createdBy = formatPublicUser(room.createdBy);
  roomJson.participants = room.participants.map((p) => formatPublicUser(p));

  if (isHost) {
    roomJson.pendingParticipants = (room.pendingParticipants || []).map((entry) => ({
      userId: entry.userId?._id?.toString() || entry.userId?.toString(),
      socketId: entry.socketId,
      requestedAt: entry.requestedAt,
      user: formatPublicUser(entry.userId),
    }));
  } else {
    delete roomJson.pendingParticipants;
  }

  const presenceStore = req.app?.get('presenceStore');
  if (presenceStore) {
    const hostUserId = room.createdBy._id?.toString() || room.createdBy.toString();
    const activeUsers = presenceStore.getActiveUsers(roomId);
    roomJson.isActive = activeUsers.some((u) => u.userId.toString() === hostUserId);
  } else {
    roomJson.isActive = false;
  }

  return sendSuccess(res, {
    message: 'Room fetched',
    data: { room: roomJson },
  });
});

module.exports = {
  create,
  getByRoomId,
};
