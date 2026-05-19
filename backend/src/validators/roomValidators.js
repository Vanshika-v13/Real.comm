const { param } = require('express-validator');
const { ROOM_ID_PATTERN } = require('../utils/roomId');

const roomIdParamRules = [
  param('roomId')
    .trim()
    .notEmpty()
    .withMessage('Room code is required')
    .customSanitizer((value) => value.toUpperCase())
    .matches(ROOM_ID_PATTERN)
    .withMessage('Invalid room code'),
];

module.exports = { roomIdParamRules };
