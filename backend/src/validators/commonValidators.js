const { param } = require('express-validator');
const mongoose = require('mongoose');

const mongoObjectIdParamRules = (paramName = 'id') => [
  param(paramName)
    .trim()
    .notEmpty()
    .withMessage(`${paramName} is required`)
    .custom((value) => mongoose.isValidObjectId(value))
    .withMessage(`Invalid ${paramName}`),
];

module.exports = {
  mongoObjectIdParamRules,
};
