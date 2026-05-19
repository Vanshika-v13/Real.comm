const express = require('express');
const rateLimit = require('express-rate-limit');
const roomController = require('../controllers/roomController');
const fileController = require('../controllers/fileController');
const { protect } = require('../middleware/auth');
const validateRequest = require('../middleware/validate');
const { roomIdParamRules } = require('../validators/roomValidators');
const { uploadSingle } = require('../middleware/uploadFile');

const router = express.Router();

const fileUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many file uploads, try again later' },
});

router.use(protect);

router.post('/create', roomController.create);

router.post(
  '/:roomId/files',
  fileUploadLimiter,
  roomIdParamRules,
  validateRequest,
  uploadSingle('file'),
  fileController.createForRoom,
);

router.get(
  '/:roomId/files',
  roomIdParamRules,
  validateRequest,
  fileController.listByRoom,
);

router.get(
  '/:roomId',
  roomIdParamRules,
  validateRequest,
  roomController.getByRoomId,
);

module.exports = router;
