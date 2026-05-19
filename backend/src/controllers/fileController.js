const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Room = require('../models/Room');
const File = require('../models/File');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { uploadRoot } = require('../middleware/uploadFile');

function sanitizeClientFileName(name) {
  if (typeof name !== 'string') {
    return 'file';
  }
  const base = path.basename(name).replace(/[\x00-\x1f]/g, '').trim();
  return base.slice(0, 255) || 'file';
}

async function assertRoomParticipant(roomId, userId) {
  const room = await Room.findOne({
    roomId,
    participants: userId,
  });
  if (!room) {
    throw new AppError('Room not found or access denied', 404);
  }
  return room;
}

function buildPublicFileUrl(fileId) {
  return `/api/files/${fileId}/download`;
}

const createForRoom = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  const { roomId } = req.params;
  await assertRoomParticipant(roomId, req.user._id);

  const safeName = sanitizeClientFileName(req.file.originalname);
  const id = new mongoose.Types.ObjectId();
  const fileUrl = buildPublicFileUrl(id.toString());

  const fileDoc = await File.create({
    _id: id,
    roomId,
    uploadedBy: req.user._id,
    fileName: safeName,
    storageFileName: req.file.filename,
    fileUrl,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
  });

  const populated = await File.findById(fileDoc._id).populate(
    'uploadedBy',
    'name email',
  );

  const io = req.app.get('io');
  if (io) {
    io.to(roomId).emit('file-shared', {
      file: populated.toJSON(),
    });
  }

  res.status(201).json({
    status: 'success',
    data: {
      file: populated.toJSON(),
    },
  });
});

const listByRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  await assertRoomParticipant(roomId, req.user._id);

  const files = await File.find({ roomId })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('uploadedBy', 'name email');

  res.status(200).json({
    status: 'success',
    results: files.length,
    data: {
      files: files.map((f) => f.toJSON()),
    },
  });
});

const download = asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  const file = await File.findById(fileId).select('+storageFileName');
  if (!file) {
    throw new AppError('File not found', 404);
  }

  await assertRoomParticipant(file.roomId, req.user._id);

  const absolutePath = path.join(uploadRoot, file.storageFileName);
  const resolvedRoot = path.resolve(uploadRoot);
  const resolvedFile = path.resolve(absolutePath);
  if (
    resolvedFile !== resolvedRoot
    && !resolvedFile.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    throw new AppError('Invalid file path', 500);
  }

  if (!fs.existsSync(absolutePath)) {
    throw new AppError('File no longer available', 404);
  }

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(file.fileName)}"`,
  );
  res.setHeader('Content-Type', file.fileType);
  res.setHeader('Content-Length', String(file.fileSize));
  return res.sendFile(absolutePath);
});

module.exports = {
  createForRoom,
  listByRoom,
  download,
};
