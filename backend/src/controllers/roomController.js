const Room = require('../models/Room');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { generateUniqueRoomId } = require('../utils/roomId');

const create = asyncHandler(async (req, res) => {
  const roomId = await generateUniqueRoomId(Room);
  const room = await Room.create({
    roomId,
    createdBy: req.user._id,
    participants: [req.user._id],
  });

  const populated = await Room.findById(room._id)
    .populate('createdBy', 'name email')
    .populate('participants', 'name email');

  res.status(201).json({
    status: 'success',
    data: {
      room: populated.toJSON(),
    },
  });
});

const getByRoomId = asyncHandler(async (req, res) => {
  const { roomId } = req.params;

  const room = await Room.findOne({ roomId })
    .populate('createdBy', 'name email')
    .populate('participants', 'name email');

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      room: room.toJSON(),
    },
  });
});

module.exports = {
  create,
  getByRoomId,
};
