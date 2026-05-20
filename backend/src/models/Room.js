const mongoose = require('mongoose');
const { ROOM_ID_PATTERN } = require('../utils/roomId');

const roomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 8,
      maxlength: 8,
      match: [ROOM_ID_PATTERN, 'Invalid room code format'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    name: {
      type: String,
      trim: true,
      maxlength: 100,
      default: 'Meeting Room',
    },
    joinApprovalEnabled: {
      type: Boolean,
      default: false,
    },
    pendingParticipants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        socketId: {
          type: String,
          required: true,
          trim: true,
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

roomSchema.set('toJSON', {
  transform(_doc, ret) {
    const obj = ret;
    obj.id = obj._id.toString();
    delete obj._id;
    delete obj.__v;
    return obj;
  },
});

module.exports = mongoose.model('Room', roomSchema);
