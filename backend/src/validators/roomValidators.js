const { body, param } = require('express-validator');
const { ROOM_ID_PATTERN } = require('../utils/roomId');

const createRoomRules = [
  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Room name must be at most 100 characters'),
  body('joinApprovalEnabled')
    .optional()
    .isBoolean()
    .withMessage('joinApprovalEnabled must be a boolean')
    .toBoolean(),
];

const roomIdParamRules = [
  param('roomId')
    .trim()
    .notEmpty()
    .withMessage('Room code is required')
    .customSanitizer((value) => value.toUpperCase())
    .matches(ROOM_ID_PATTERN)
    .withMessage('Invalid room code'),
];

module.exports = { createRoomRules, roomIdParamRules };
