const mongoose = require('mongoose');
const { ROOM_ID_PATTERN } = require('../utils/roomId');

const fileSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true,
      uppercase: true,
      trim: true,
      match: [ROOM_ID_PATTERN, 'Invalid room code'],
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    /** Stored disk filename under uploadDir (never exposed to clients). */
    storageFileName: {
      type: String,
      required: true,
      select: false,
    },
    fileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    fileSize: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

fileSchema.index({ roomId: 1, createdAt: -1 });

fileSchema.set('toJSON', {
  transform(_doc, ret) {
    const obj = ret;
    obj.id = obj._id.toString();
    delete obj._id;
    delete obj.__v;
    delete obj.storageFileName;
    return obj;
  },
});

module.exports = mongoose.model('File', fileSchema);
